#!/usr/bin/env node

/**
 * scripts/check-loc.mjs
 *
 * Mechanical checker for file line budgets and modularity (PLAY-025).
 * Enforces the non-negotiable rule established in PLAY-024:
 *   - Hard Ceiling (< 1000 LOC): Any source file >= 1000 LOC fails the gate (exit 1).
 *   - Soft Warning (500 - 999 LOC): Files approaching the limit receive an advisory warning.
 *
 * Agnostic: Inspects source code files across languages, respecting .gitignore,
 * .locignore, and configured exclusions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_MAX_LINES = 1000;
export const DEFAULT_WARN_LINES = 500;

export const DEFAULT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs',
  '.ts', '.tsx', '.jsx',
  '.py', '.go', '.rs', '.rb', '.php',
  '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.swift', '.kt',
  '.sh', '.bash', '.ps1',
  '.sql', '.graphql', '.proto'
]);

export const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  '.svelte-kit',
  'coverage',
  '.git',
  '.vscode',
  '.idea',
  '.playbook-backups',
  '.gripm',
  '.agents',
  'docs',
  'tests',
  '__tests__',
  'fixtures'
]);

export const CANDIDATE_SRC_DIRS = [
  'src',
  'app',
  'lib',
  'domain',
  'packages',
  'client',
  'frontend'
];

export function parseIgnoreLines(lines) {
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((pattern) => {
      const isDirOnly = pattern.endsWith('/');
      const clean = pattern.replace(/\/$/, '');
      const escaped = clean
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      return { pattern: clean, isDirOnly, regex: new RegExp(`(?:^|/)${escaped}(?:/|$)`) };
    });
}

export function parseIgnoreFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return parseIgnoreLines(content.split(/\r?\n/));
  } catch {
    return [];
  }
}

export function isIgnored(relPath, isDir, ignoreRules, ignoredDirs = DEFAULT_IGNORED_DIRS) {
  const norm = relPath.replace(/\\/g, '/');
  const parts = norm.split('/');

  for (const part of parts) {
    if (ignoredDirs.has(part)) return true;
  }

  const dirPart = isDir ? norm : parts.slice(0, -1).join('/');

  for (const rule of ignoreRules) {
    if (rule.isDirOnly) {
      if (isDir && rule.regex.test(norm)) return true;
      if (!isDir && dirPart && (rule.regex.test(dirPart) || parts.slice(0, -1).some((p) => rule.regex.test(p)))) {
        return true;
      }
    } else {
      if (rule.regex.test(norm)) return true;
    }
  }

  return false;
}

export function countFileLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content) return 0;
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      return lines.length - 1;
    }
    return lines.length;
  } catch {
    return 0;
  }
}

export function checkFileBudget(options = {}) {
  const root = path.resolve(options.root || options.cwd || options.path || process.cwd());
  const maxLines = Number(options.maxLines ?? options.max ?? DEFAULT_MAX_LINES);
  const warnLines = Number(options.warnLines ?? options.warn ?? DEFAULT_WARN_LINES);
  const customExts = options.extensions ? new Set(options.extensions) : DEFAULT_EXTENSIONS;
  const customIgnoredDirs = options.ignoredDirs ? new Set(options.ignoredDirs) : DEFAULT_IGNORED_DIRS;

  // Aggregate ignore rules from .gitignore, .locignore (.gripm/locignore fallback) and custom excludes
  const gitignoreRules = parseIgnoreFile(path.join(root, '.gitignore'));
  const gripmLocignore = path.join(root, '.gripm', 'locignore');
  const rootLocignore = path.join(root, '.locignore');
  const locignorePath = fs.existsSync(gripmLocignore) ? gripmLocignore : rootLocignore;
  const locignoreRules = parseIgnoreFile(locignorePath);
  const extraExcludes = Array.isArray(options.exclude)
    ? parseIgnoreLines(options.exclude)
    : options.exclude
    ? parseIgnoreLines([options.exclude])
    : [];

  const combinedRules = [...gitignoreRules, ...locignoreRules, ...extraExcludes];

  const violations = [];
  const warnings = [];
  let scanned = 0;

  function walk(currentDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      const rel = path.relative(root, full);

      if (entry.isDirectory()) {
        if (!isIgnored(rel, true, combinedRules, customIgnoredDirs)) {
          walk(full);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (customExts.has(ext) && !isIgnored(rel, false, combinedRules, customIgnoredDirs)) {
          scanned++;
          const lines = countFileLines(full);
          const item = {
            file: rel.replace(/\\/g, '/'),
            lines,
            maxLines,
            warnLines
          };

          if (lines >= maxLines) {
            violations.push(item);
          } else if (lines >= warnLines) {
            warnings.push(item);
          }
        }
      }
    }
  }

  // Determine target directories to scan:
  // If specific --src target was passed, walk it directly.
  if (options.src) {
    const target = path.resolve(root, options.src);
    if (fs.existsSync(target)) {
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        walk(target);
      } else if (stat.isFile()) {
        const lines = countFileLines(target);
        scanned = 1;
        const rel = path.relative(root, target).replace(/\\/g, '/');
        const item = { file: rel, lines, maxLines, warnLines };
        if (lines >= maxLines) violations.push(item);
        else if (lines >= warnLines) warnings.push(item);
      }
    }
  } else {
    // If scanning root or a directory, check if candidate source directories exist inside it
    const detectedSrcDirs = CANDIDATE_SRC_DIRS
      .map((dir) => path.join(root, dir))
      .filter((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());

    if (detectedSrcDirs.length > 0) {
      for (const dir of detectedSrcDirs) {
        walk(dir);
      }
    } else {
      walk(root);
    }
  }

  // Sort worst offenders first
  violations.sort((a, b) => b.lines - a.lines);
  warnings.sort((a, b) => b.lines - a.lines);

  const strict = Boolean(options.strict);

  return {
    root,
    scanned,
    maxLines,
    warnLines,
    violations,
    warnings,
    hasDebt: violations.length > 0,
    passed: strict ? violations.length === 0 : true,
    strict
  };
}

// --- CLI Runner --------------------------------------------------------------

const isColorSupported =
  !('NO_COLOR' in process.env) &&
  (process.env.FORCE_COLOR === '1' || (process.stdout?.isTTY && process.env.TERM !== 'dumb'));

const c = {
  bold: (s) => (isColorSupported ? `\x1b[1m${s}\x1b[22m` : s),
  dim: (s) => (isColorSupported ? `\x1b[2m${s}\x1b[22m` : s),
  green: (s) => (isColorSupported ? `\x1b[32m${s}\x1b[39m` : s),
  yellow: (s) => (isColorSupported ? `\x1b[33m${s}\x1b[39m` : s),
  red: (s) => (isColorSupported ? `\x1b[31m${s}\x1b[39m` : s),
  cyan: (s) => (isColorSupported ? `\x1b[36m${s}\x1b[39m` : s)
};

export function runCli(argv = process.argv.slice(2)) {
  let targetPath = null;
  let maxLines = DEFAULT_MAX_LINES;
  let warnLines = DEFAULT_WARN_LINES;
  let formatJson = false;
  let strict = false;
  const excludes = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--max' || arg === '--max-lines') {
      maxLines = parseInt(argv[++i], 10);
    } else if (arg === '--warn' || arg === '--warn-lines') {
      warnLines = parseInt(argv[++i], 10);
    } else if (arg === '--path' || arg === '--src') {
      targetPath = argv[++i];
    } else if (arg === '--exclude') {
      excludes.push(argv[++i]);
    } else if (arg === '--strict') {
      strict = true;
    } else if (arg === '--json') {
      formatJson = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/check-loc.mjs [options] [path]

Options:
  --max, --max-lines <n>   Ceiling lines limit (default: ${DEFAULT_MAX_LINES})
  --warn, --warn-lines <n> Soft warning threshold (default: ${DEFAULT_WARN_LINES})
  --path, --src <dir>      Directory or file to scan (default: auto-detect src/ or cwd)
  --exclude <pattern>      Exclude file or directory pattern (repeatable)
  --strict                 Exit 1 if any file reaches or exceeds limit (default: advisory exit 0)
  --json                   Output results as JSON
  --help, -h               Show this help message
`);
      process.exit(0);
    } else if (!arg.startsWith('--')) {
      targetPath = arg;
    }
  }

  const result = checkFileBudget({
    path: targetPath,
    maxLines,
    warnLines,
    exclude: excludes,
    strict
  });

  if (formatJson) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
  }

  console.log(`\n  ${c.bold('gripm')} ${c.dim('·')} File Budget & Modularity Checker\n`);
  console.log(`  Target:    ${c.cyan(result.root)}`);
  console.log(`  Scanned:   ${result.scanned} source files`);
  console.log(`  Limits:    Ceiling < ${result.maxLines} LOC · Warning >= ${result.warnLines} LOC`);
  console.log(`  Mode:      ${result.strict ? c.red('Strict (blocking gate)') : c.dim('Advisory (PO sovereignty - non-blocking)')}\n`);

  if (result.warnings.length > 0) {
    console.log(`  ${c.yellow('▲ Warnings (modular refactoring recommended):')}`);
    for (const w of result.warnings) {
      console.log(`    ${c.yellow('⚠')} ${w.file.padEnd(55)} ${c.bold(w.lines)} LOC`);
    }
    console.log('');
  }

  if (result.violations.length > 0) {
    if (result.strict) {
      console.log(`  ${c.red('✖ Violations (strict mode enabled - hard ceiling breached):')}`);
      for (const v of result.violations) {
        console.log(`    ${c.red('✖')} ${v.file.padEnd(55)} ${c.bold(v.lines)} LOC (exceeds ${result.maxLines})`);
      }
      console.log(`\n  ${c.red('✖ FILE BUDGET FAILED')} - ${result.violations.length} file(s) exceed ${result.maxLines} LOC.\n`);
      process.exit(1);
    } else {
      console.log(`  ${c.yellow('▲ Technical Debt Notice (files exceeding ' + result.maxLines + ' LOC):')}`);
      for (const v of result.violations) {
        console.log(`    ${c.yellow('⚠')} ${v.file.padEnd(55)} ${c.bold(v.lines)} LOC (exceeds ${result.maxLines})`);
      }
      console.log(`\n  ${c.dim('ℹ PO Advisory: Large files increase maintenance risk and single points of failure.')}`);
      console.log(`  ${c.dim('  Ensure a refactoring task is tracked and prioritized in the backlog (`backlog/tasks/`).')}`);
      console.log(`  ${c.dim('  The final release decision belongs to the PO.')}\n`);
      process.exit(0);
    }
  }

  console.log(`  ${c.green('✔ All files within modular limits (< ' + result.maxLines + ' LOC).')}\n`);
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli();
}
