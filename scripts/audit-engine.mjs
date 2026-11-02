/**
 * scripts/audit-engine.mjs
 *
 * Core static analysis and codebase health auditing engine (DEV-353, PLAY-053).
 * Headless inspection of source code files across languages and tech stacks:
 * - Stack detection (Node, React, Vue, TypeScript, Python, Rust, Go)
 * - Line budgets (LOC violations > 500 warning, > 1000 error)
 * - Quality suppressions and anti-slop (type suppression, linter bypass, console.log)
 * - Test infrastructure and verifyCommand suggestions
 * - Hidden debt markers (TODO, FIXME, HACK, BUG, XXX)
 * - Deterministic Health Score (0 - 100)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseIgnoreFile,
  parseIgnoreLines,
  isIgnored,
  DEFAULT_EXTENSIONS,
  DEFAULT_IGNORED_DIRS,
  DEFAULT_MAX_LINES,
  DEFAULT_WARN_LINES
} from './check-loc.mjs';

const __filename = fileURLToPath(import.meta.url);

const COMMENT_PREFIX = '(?:\\/\\/|#|\\/\\*+|\\*)\\s*';

export const TODO_RE = /(?:\/\/|#|\/\*+|\*)\s*(?:(TODO|FIXME|HACK|BUG|XXX)(?:\([^)]*\))?[:\-\s]|(TODO|FIXME|HACK|BUG|XXX)$|(todo|fixme|hack|bug|xxx)(?:\([^)]*\))?[:\-])\s*(.*?)(?:\*\/|$)/;

export const ANTI_SLOP_PATTERNS = {
  tsIgnore: new RegExp(COMMENT_PREFIX + '@' + 'ts-ignore\\b'),
  tsNocheck: new RegExp(COMMENT_PREFIX + '@' + 'ts-nocheck\\b'),
  eslintDisable: new RegExp(COMMENT_PREFIX + 'eslint-' + 'disable(?:-next-line|-line)?\\b'),
  consoleLog: new RegExp('\\bconsole\\.' + 'log\\s*\\(')
};

export const TS_IGNORE_RE = ANTI_SLOP_PATTERNS.tsIgnore;
export const TS_NOCHECK_RE = ANTI_SLOP_PATTERNS.tsNocheck;
export const ESLINT_DISABLE_RE = ANTI_SLOP_PATTERNS.eslintDisable;
export const CONSOLE_LOG_RE = ANTI_SLOP_PATTERNS.consoleLog;

export function checkAntiSlop(line) {
  if (!line || typeof line !== 'string') return null;
  if (ANTI_SLOP_PATTERNS.tsIgnore.test(line)) return { type: '@' + 'ts-ignore' };
  if (ANTI_SLOP_PATTERNS.tsNocheck.test(line)) return { type: '@' + 'ts-nocheck' };
  if (ANTI_SLOP_PATTERNS.eslintDisable.test(line)) return { type: 'eslint-' + 'disable' };
  if (ANTI_SLOP_PATTERNS.consoleLog.test(line)) return { type: 'console.log' };
  return null;
}

export function detectStack(rootPath) {
  const root = path.resolve(rootPath || process.cwd());
  const detected = new Set();
  const candidateDirs = [root];
  const parent = path.dirname(root);
  if (parent && parent !== root) candidateDirs.push(parent);

  for (const dir of candidateDirs) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        detected.add('Node');
        if (deps.react || deps['react-dom'] || deps.next) detected.add('React');
        if (deps.vue || deps.nuxt) detected.add('Vue');
        if (deps.typescript) detected.add('TypeScript');
        break;
      } catch {}
    }
  }

  const exists = (file) => fs.existsSync(path.join(root, file));
  if (exists('tsconfig.json')) detected.add('TypeScript');
  if (['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile', 'environment.yml'].some(exists)) detected.add('Python');
  if (exists('Cargo.toml')) detected.add('Rust');
  if (exists('go.mod')) detected.add('Go');

  if (fs.existsSync(root) && fs.statSync(root).isDirectory()) {
    try {
      const files = fs.readdirSync(root);
      if (files.some((f) => f.endsWith('.py'))) detected.add('Python');
      if (files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'))) detected.add('TypeScript');
      if (files.some((f) => f.endsWith('.rs'))) detected.add('Rust');
      if (files.some((f) => f.endsWith('.go'))) detected.add('Go');
    } catch {}
  }
  return [...detected];
}

const TEST_CONFIG_MAP = [
  { file: 'vitest.config.ts', fw: 'vitest' }, { file: 'vitest.config.js', fw: 'vitest' },
  { file: 'vitest.config.mjs', fw: 'vitest' }, { file: 'vitest.workspace.ts', fw: 'vitest' },
  { file: 'jest.config.ts', fw: 'jest' }, { file: 'jest.config.js', fw: 'jest' },
  { file: 'jest.config.mjs', fw: 'jest' }, { file: 'jest.config.json', fw: 'jest' },
  { file: 'pytest.ini', fw: 'pytest', cmd: 'pytest' }, { file: 'conftest.py', fw: 'pytest', cmd: 'pytest' },
  { file: 'Cargo.toml', fw: 'cargo', cmd: 'cargo test' }, { file: 'go.mod', fw: 'go', cmd: 'go test ./...' }
];

const VERIFY_COMMAND_FALLBACKS = {
  vitest: 'npx vitest run', jest: 'npx jest', 'node:test': 'node --test',
  pytest: 'pytest', cargo: 'cargo test', go: 'go test ./...'
};

export function detectTests(rootPath) {
  const root = path.resolve(rootPath || process.cwd());
  let framework = null, verifyCommand = null, hasTests = false;
  const candidateDirs = [root];
  const parent = path.dirname(root);
  if (parent && parent !== root) candidateDirs.push(parent);

  for (const dir of candidateDirs) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const testScript = pkg.scripts?.test;
        if (testScript && !/no test specified/i.test(testScript)) {
          hasTests = true;
          if (!verifyCommand) verifyCommand = 'npm test';
          if (/vitest/i.test(testScript)) framework ??= 'vitest';
          else if (/jest/i.test(testScript)) framework ??= 'jest';
          else if (/node\s+(?:--test|scripts\/run-tests|scripts\/test)|node:test/i.test(testScript)) framework ??= 'node:test';
          else if (/mocha/i.test(testScript)) framework ??= 'mocha';
          else if (/playwright/i.test(testScript)) framework ??= 'playwright';
        }
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (!framework) {
          framework = deps.vitest ? 'vitest' : deps.jest ? 'jest' : deps.mocha ? 'mocha' : deps['@playwright/test'] ? 'playwright' : null;
        }
        if (deps.vitest || deps.jest || deps.mocha || deps['@playwright/test']) hasTests = true;
      } catch {}
    }

    for (const cfg of TEST_CONFIG_MAP) {
      if (fs.existsSync(path.join(dir, cfg.file))) {
        if (!framework) framework = cfg.fw;
        if (!verifyCommand && cfg.cmd) verifyCommand = cfg.cmd;
        hasTests = true;
      }
    }

    const pyprojectPath = path.join(dir, 'pyproject.toml');
    if (fs.existsSync(pyprojectPath)) {
      try {
        const content = fs.readFileSync(pyprojectPath, 'utf8');
        if (/tool\.pytest|pytest/i.test(content)) {
          if (!framework) framework = 'pytest';
          if (!verifyCommand) verifyCommand = 'pytest';
          hasTests = true;
        }
      } catch {}
    }

    for (const folder of ['test', 'tests', '__tests__', 'spec', 'specs']) {
      const p = path.join(dir, folder);
      if (fs.existsSync(p) && fs.readdirSync(p).length > 0) hasTests = true;
    }
    if (framework && hasTests) break;
  }

  if (framework && !verifyCommand) verifyCommand = VERIFY_COMMAND_FALLBACKS[framework] || null;
  return { detected: Boolean(hasTests || framework), framework: framework || null, verifyCommand: verifyCommand || null, hasTests };
}

export function computeHealthScore(params = {}) {
  const { totalFilesScanned = 0, locViolations = [], suppressions = [], todos = [], tests = { detected: false, hasTests: false } } = params;
  if (!totalFilesScanned || totalFilesScanned <= 0) return 100;

  let score = 100;
  const errorCount = locViolations.filter((v) => v.status === 'error').length;
  const warnCount = locViolations.filter((v) => v.status === 'warning').length;
  score -= Math.min(40, errorCount * 10);
  score -= Math.min(15, warnCount * 3);
  score -= Math.min(25, suppressions.length * 5);

  let todoPenalty = 0;
  for (const item of todos) {
    if (item.type === 'BUG' || item.type === 'FIXME') todoPenalty += 3;
    else if (item.type === 'HACK' || item.type === 'XXX') todoPenalty += 2;
    else todoPenalty += 1;
  }
  score -= Math.min(15, todoPenalty);
  if (!tests.detected && !tests.hasTests) score -= 15;

  if (Number.isNaN(score) || !Number.isFinite(score)) return 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function createEmptyReport(maxLines = DEFAULT_MAX_LINES, warnLines = DEFAULT_WARN_LINES) {
  return {
    score: 100, stack: [],
    summary: { totalFilesScanned: 0, locViolationsCount: 0, suppressionsCount: 0, todosCount: 0, testFramework: null, verifyCommand: null, stack: null },
    loc: { maxLines, warnLines, violations: [] },
    quality: { suppressions: [] },
    todos: [],
    tests: { detected: false, framework: null, verifyCommand: null, hasTests: false }
  };
}

export async function scanCodebase(targetPath, options = {}) {
  const root = path.resolve(targetPath || options.cwd || options.root || process.cwd());
  const maxLines = Number(options.maxLines ?? options.max ?? DEFAULT_MAX_LINES);
  const warnLines = Number(options.warnLines ?? options.warn ?? DEFAULT_WARN_LINES);
  const customExts = options.extensions ? new Set(options.extensions) : DEFAULT_EXTENSIONS;
  const customIgnoredDirs = options.ignoredDirs ? new Set(options.ignoredDirs) : DEFAULT_IGNORED_DIRS;

  if (!fs.existsSync(root)) return createEmptyReport(maxLines, warnLines);
  const stat = fs.statSync(root);

  const gitignoreRules = parseIgnoreFile(path.join(root, '.gitignore'));
  const locignorePath = [
    path.join(root, '.gripm', 'locignore'), path.join(root, '.gripm', '.locignore'), path.join(root, '.locignore')
  ].find((p) => fs.existsSync(p)) || path.join(root, '.locignore');
  const locignoreRules = parseIgnoreFile(locignorePath);
  const extraExcludes = parseIgnoreLines(Array.isArray(options.exclude) ? options.exclude : options.exclude ? [options.exclude] : []);
  const combinedRules = [...gitignoreRules, ...locignoreRules, ...extraExcludes];

  const locViolations = [], suppressions = [], todos = [];
  let totalFilesScanned = 0;

  function scanSingleFile(filePath, relPath) {
    totalFilesScanned++;
    let content = '';
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { return; }

    const normRel = relPath.replace(/\\/g, '/');
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const lineCount = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;

    if (lineCount >= maxLines) locViolations.push({ file: normRel, lines: lineCount, status: 'error' });
    else if (lineCount >= warnLines) locViolations.push({ file: normRel, lines: lineCount, status: 'warning' });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], lineNum = i + 1, trimmed = line.trim();
      if (!trimmed) continue;

      if (ANTI_SLOP_PATTERNS.tsIgnore.test(line)) {
        suppressions.push({ file: normRel, line: lineNum, type: '@' + 'ts-ignore', snippet: trimmed });
      } else if (ANTI_SLOP_PATTERNS.tsNocheck.test(line)) {
        suppressions.push({ file: normRel, line: lineNum, type: '@' + 'ts-nocheck', snippet: trimmed });
      } else if (ANTI_SLOP_PATTERNS.eslintDisable.test(line)) {
        suppressions.push({ file: normRel, line: lineNum, type: 'eslint-' + 'disable', snippet: trimmed });
      } else if (options.includeConsoleLog && ANTI_SLOP_PATTERNS.consoleLog.test(line)) {
        suppressions.push({ file: normRel, line: lineNum, type: 'console.log', snippet: trimmed });
      }

      const todoMatch = line.match(TODO_RE);
      if (todoMatch) {
        const type = (todoMatch[1] || todoMatch[2] || todoMatch[3]).toUpperCase();
        const text = (todoMatch[4] || '').replace(/\*\/$/, '').trim();
        todos.push({
          id: `${normRel}:${lineNum}`, file: normRel, line: lineNum,
          type, text, snippet: trimmed
        });
      }
    }
  }

  function walk(currentDir) {
    let entries = [];
    try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      const rel = path.relative(root, full);
      if (entry.isDirectory()) {
        if (!isIgnored(rel, true, combinedRules, customIgnoredDirs)) walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (customExts.has(ext) && !isIgnored(rel, false, combinedRules, customIgnoredDirs)) scanSingleFile(full, rel);
      }
    }
  }

  if (stat.isFile()) {
    if (customExts.has(path.extname(root).toLowerCase())) scanSingleFile(root, path.basename(root));
  } else if (stat.isDirectory()) {
    walk(root);
  }

  locViolations.sort((a, b) => b.lines - a.lines);
  const targetDir = stat.isDirectory() ? root : path.dirname(root);
  const tests = detectTests(targetDir);
  const stack = detectStack(targetDir);
  const score = computeHealthScore({ totalFilesScanned, locViolations, suppressions, todos, tests });

  return {
    score, stack,
    summary: {
      totalFilesScanned, locViolationsCount: locViolations.length, suppressionsCount: suppressions.length,
      todosCount: todos.length, testFramework: tests.framework, verifyCommand: tests.verifyCommand, stack: stack.join(', ') || null
    },
    loc: { maxLines, warnLines, violations: locViolations },
    quality: { suppressions },
    todos, tests
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

function stripAnsi(str) { return String(str).replace(/\x1b\[[0-9;]*m/g, ''); }

function makeBoxLine(label, value = '', width = 68) {
  const innerWidth = width - 4;
  const spaces = Math.max(1, innerWidth - (stripAnsi(label).length + stripAnsi(value).length));
  return `  │ ${label}${' '.repeat(spaces)}${value} │`;
}

export async function runCli(argv = process.argv.slice(2)) {
  if (Array.isArray(argv) && argv[0] === 'audit') argv = argv.slice(1);

  let targetPath = null, maxLines = DEFAULT_MAX_LINES, warnLines = DEFAULT_WARN_LINES;
  let formatJson = false, isStrict = false, isQuiet = false;
  const excludes = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--max' || arg === '--max-lines') maxLines = parseInt(argv[++i], 10);
    else if (arg === '--warn' || arg === '--warn-lines') warnLines = parseInt(argv[++i], 10);
    else if (arg === '--path' || arg === '--src' || arg === '--root' || arg === '--cwd' || arg === '--repo' || arg === '-r') targetPath = argv[++i];
    else if (arg.startsWith('--root=') || arg.startsWith('--cwd=') || arg.startsWith('--path=') || arg.startsWith('--repo=')) targetPath = arg.split('=')[1];
    else if (arg === '--exclude') excludes.push(argv[++i]);
    else if (arg === '--json' || arg === '--format=json' || (arg === '--format' && argv[++i] === 'json')) formatJson = true;
    else if (arg === '--strict') isStrict = true;
    else if (arg === '--quiet' || arg === '-q') isQuiet = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`\nUsage: gripm audit [options] [path]\n       node scripts/audit-engine.mjs [options] [path]\n\nOptions:\n  --format json, --json    Output results strictly as structured JSON\n  --strict                 Exit code 1 if critical violations (>= 1000 LOC or suppressions) exist\n  --quiet, -q              Minimal one-line summary output\n  --repo, -r <dir>         Directory to scan (default: current directory)\n  --max, --max-lines <n>   Ceiling lines limit (default: ${DEFAULT_MAX_LINES})\n  --warn, --warn-lines <n> Soft warning threshold (default: ${DEFAULT_WARN_LINES})\n  --exclude <pattern>      Exclude pattern (repeatable)\n  --help, -h               Show this help message\n`);
      process.exit(0);
    } else if (!arg.startsWith('-')) targetPath = arg;
  }

  const report = await scanCodebase(targetPath, { maxLines, warnLines, exclude: excludes });
  const criticalLocViolations = report.loc.violations.filter((v) => v.status === 'error' || v.lines >= maxLines);
  const criticalSuppressions = report.quality.suppressions;
  const hasCriticalViolations = criticalLocViolations.length > 0 || criticalSuppressions.length > 0;

  if (formatJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(isStrict && hasCriticalViolations ? 1 : 0);
  }

  if (isQuiet) {
    const statusTag = hasCriticalViolations ? 'FAIL' : 'PASS';
    console.log(`gripm audit: Health Score ${report.score}/100 - ${report.summary.totalFilesScanned} files - ${report.summary.locViolationsCount} LOC issues (${criticalLocViolations.length} critical) - ${criticalSuppressions.length} suppressions - ${report.summary.todosCount} TODOs [${statusTag}]`);
    process.exit(isStrict && hasCriticalViolations ? 1 : 0);
  }

  const scoreText = report.score >= 80 ? c.green(report.score + '/100') : report.score >= 50 ? c.yellow(report.score + '/100') : c.red(report.score + '/100');
  const runnerText = report.summary.testFramework ? `${report.summary.testFramework} (verify: ${report.summary.verifyCommand || 'npm test'})` : c.dim('None detected');
  const locDetail = `${report.summary.locViolationsCount} (${criticalLocViolations.length} critical >= ${maxLines} LOC)`;
  const stackText = report.summary.stack ? report.summary.stack : c.dim('Not detected');

  console.log('\n  ┌──────────────────────────────────────────────────────────────────┐');
  console.log(makeBoxLine(`${c.bold('gripm')} ${c.dim('·')} Static Codebase Health Audit`, ''));
  console.log('  ├──────────────────────────────────────────────────────────────────┤');
  console.log(makeBoxLine('Health Score:', scoreText));
  console.log(makeBoxLine('Files Scanned:', `${report.summary.totalFilesScanned} files`));
  console.log(makeBoxLine('Stack:', stackText));
  console.log(makeBoxLine('Test Runner:', runnerText));
  console.log(makeBoxLine('LOC Issues:', locDetail));
  console.log(makeBoxLine('Suppressions:', String(criticalSuppressions.length)));
  console.log(makeBoxLine('TODO / Debt:', `${report.summary.todosCount} markers`));
  console.log('  └──────────────────────────────────────────────────────────────────┘\n');

  if (report.loc.violations.length > 0) {
    console.log(`  ${c.yellow('▲ LOC Violations & Warnings:')}`);
    for (const v of report.loc.violations) {
      const color = v.status === 'error' ? c.red : c.yellow;
      console.log(`    ${color(v.status.padEnd(8))} ${v.file.padEnd(52)} ${c.bold(v.lines)} LOC`);
    }
    console.log('');
  }

  if (report.quality.suppressions.length > 0) {
    console.log(`  ${c.yellow('▲ Quality Suppressions:')}`);
    for (const s of report.quality.suppressions) {
      console.log(`    ${c.yellow(s.type.padEnd(16))} ${s.file}:${s.line} - ${c.dim(s.snippet)}`);
    }
    console.log('');
  }

  if (report.todos.length > 0) {
    console.log(`  ${c.dim('ℹ Hidden Debt & Notes:')}`);
    for (const t of report.todos.slice(0, 10)) {
      console.log(`    ${c.cyan(t.type.padEnd(8))} ${t.file}:${t.line} - ${t.text}`);
    }
    if (report.todos.length > 10) console.log(`    ${c.dim(`... and ${report.todos.length - 10} more`)}`);
    console.log('');
  }

  if (isStrict && hasCriticalViolations) {
    console.error(`  ${c.red('✖ Strict audit failed:')} ${criticalLocViolations.length} critical LOC violation(s) (>= ${maxLines} lines) and ${criticalSuppressions.length} suppression(s) detected.\n`);
    process.exit(1);
  }
  process.exit(0);
}

const entryBase = process.argv[1] ? path.basename(process.argv[1]).replace(/\.[cm]?js$/, '') : '';
const isCli =
  process.argv[1] &&
  (entryBase === 'audit-repo' ||
    entryBase === 'audit-engine' ||
    (path.resolve(process.argv[1]) === __filename && entryBase.includes('audit-engine')));

if (isCli) {
  runCli();
}
