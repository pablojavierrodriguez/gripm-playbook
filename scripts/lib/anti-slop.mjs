/**
 * scripts/lib/anti-slop.mjs
 *
 * Deterministic anti-slop inspection for type evasions and anti-patterns.
 * Scans git diff for chained casts (as unknown as / as any as) in production code files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const TYPE_EVASION_REGEX = /\bas\s+(?:unknown|any)\s+as\b/;
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export function isTestOrFixturePath(filePath) {
  if (!filePath) return false;
  const norm = `/${filePath.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()}`;
  return (
    norm.includes('/tests/') ||
    norm.includes('/test/') ||
    norm.includes('/__tests__/') ||
    norm.includes('/fixtures/') ||
    norm.includes('.test.') ||
    norm.includes('.spec.')
  );
}

export function isInspectableCodePath(filePath) {
  if (!filePath) return false;
  const ext = path.extname(filePath).toLowerCase();
  return CODE_EXTENSIONS.has(ext) && !isTestOrFixturePath(filePath);
}

export function inspectDiffText(diffText) {
  const failures = [];
  if (!diffText || !diffText.trim()) return failures;

  let currentFile = null;
  const lines = diffText.split('\n');

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const parts = line.split(' ');
      currentFile = parts[3] ? parts[3].replace(/^b\//, '') : null;
      continue;
    }

    if (!currentFile || !isInspectableCodePath(currentFile)) {
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const addedText = line.slice(1);
      const match = addedText.match(TYPE_EVASION_REGEX);
      if (match) {
        failures.push(
          `anti-slop: type evasion "${match[0]}" detected in ${currentFile}. Chained casts through unknown/any violate type safety invariants.`,
        );
      }
    }
  }
  return failures;
}

export function checkDiffAntiSlop(projectRoot) {
  const failures = [];
  const warnings = [];

  try {
    const gitRes = spawnSync('git', ['diff', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 15000,
    });

    if (gitRes.error || gitRes.status !== 0) {
      return { passed: true, failures, warnings };
    }

    failures.push(...inspectDiffText(gitRes.stdout || ''));
  } catch (err) {
    warnings.push(`anti-slop: git diff inspection skipped (${err.message})`);
  }

  return {
    passed: failures.length === 0,
    failures,
    warnings,
  };
}

function gitOutput(projectRoot, args) {
  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error || result.status !== 0) {
    return {
      ok: false,
      error: result.error?.message || (result.stderr || '').trim() || `git exited with ${result.status}`,
    };
  }

  return { ok: true, output: result.stdout || '' };
}

function getChangedFiles(projectRoot) {
  const tracked = gitOutput(projectRoot, ['diff', '--name-only', '-z', '--diff-filter=ACMRTUXB', 'HEAD', '--']);
  if (!tracked.ok) return { files: null, untracked: new Set(), error: tracked.error };

  const untracked = gitOutput(projectRoot, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (!untracked.ok) return { files: null, untracked: new Set(), error: untracked.error };

  const trackedFiles = tracked.output.split('\0').filter(Boolean);
  const untrackedFiles = new Set(untracked.output.split('\0').filter(Boolean).map((file) => file.replace(/\\/g, '/')));
  const files = new Set([...trackedFiles, ...untrackedFiles].map((file) => file.replace(/\\/g, '/')));
  return { files, untracked: untrackedFiles, error: null };
}

function countLines(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  return lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

function getAddedLineNumbers(projectRoot, file, isUntracked) {
  if (isUntracked) {
    const fullPath = path.join(projectRoot, file);
    if (!fs.existsSync(fullPath)) return { lines: new Set(), error: null };
    return {
      lines: new Set(Array.from({ length: countLines(fs.readFileSync(fullPath, 'utf8')) }, (_, index) => index + 1)),
      error: null,
    };
  }

  const diff = gitOutput(projectRoot, ['diff', '--unified=0', '--no-ext-diff', 'HEAD', '--', file]);
  if (!diff.ok) return { lines: null, error: diff.error };

  const addedLines = new Set();
  let newLine = 0;
  for (const line of diff.output.split('\n')) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('\\')) continue;
    if (line.startsWith('+')) {
      addedLines.add(newLine);
      newLine += 1;
    } else if (line.startsWith(' ')) {
      newLine += 1;
    }
  }
  return { lines: addedLines, error: null };
}

function getBaselineLineCount(projectRoot, file, isUntracked) {
  if (isUntracked) return 0;
  const baseline = gitOutput(projectRoot, ['show', `HEAD:${file}`]);
  return baseline.ok ? countLines(baseline.output) : null;
}

export async function checkStructuralHealth(projectRoot, options = {}) {
  const failures = [];
  const warnings = [];

  const root = path.resolve(projectRoot || process.cwd());
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(root, 'scripts', 'audit-engine.mjs'),
    path.resolve(scriptDir, '..', 'audit-engine.mjs'),
  ];
  const enginePath = candidates.find((p) => fs.existsSync(p));
  if (!enginePath) {
    return { passed: true, failures, warnings };
  }

  let scanCodebase;
  try {
    const mod = await import(pathToFileURL(enginePath).href);
    scanCodebase = mod.scanCodebase;
  } catch (err) {
    warnings.push(`structural health: failed to load audit engine (${err.message})`);
    return { passed: true, failures, warnings };
  }

  if (typeof scanCodebase !== 'function') {
    return { passed: true, failures, warnings };
  }

  const maxLines = options.maxLines || 1000;
  const report = await scanCodebase(root, { maxLines });

  const criticalLocViolations = (report?.loc?.violations || []).filter(
    (v) => v.status === 'error' || v.lines >= maxLines,
  );
  const criticalSuppressions = (report?.quality?.suppressions || []).filter(
    (s) => s.type !== 'console.log',
  );

  const strict = Boolean(options.strict);
  const baselineLineCounts = new Map();
  let blockingLocViolations = criticalLocViolations;
  let blockingSuppressions = criticalSuppressions;

  if (!strict) {
    const changes = getChangedFiles(root);
    if (!changes.files) {
      if (criticalLocViolations.length || criticalSuppressions.length) {
        warnings.push(`Structural baseline unavailable (${changes.error}); repository-wide findings remain advisory in normal mode.`);
      }
      blockingLocViolations = [];
      blockingSuppressions = [];
    } else {
      blockingLocViolations = criticalLocViolations.filter((violation) => {
        if (!changes.files.has(violation.file)) return false;
        const baselineLines = getBaselineLineCount(root, violation.file, changes.untracked.has(violation.file));
        baselineLineCounts.set(violation.file, baselineLines);
        if (baselineLines === null) {
          warnings.push(`Structural baseline unavailable for ${violation.file}; its LOC finding remains advisory in normal mode.`);
          return false;
        }
        return baselineLines < maxLines || violation.lines > baselineLines;
      });

      const addedLinesByFile = new Map();
      for (const file of changes.files) {
        const addedResult = getAddedLineNumbers(root, file, changes.untracked.has(file));
        if (addedResult.error) {
          warnings.push(`Structural diff unavailable for ${file} (${addedResult.error}); new suppressions remain advisory in normal mode.`);
        } else if (addedResult.lines) {
          addedLinesByFile.set(file, addedResult.lines);
        }
      }
      blockingSuppressions = criticalSuppressions.filter(
        (suppression) => addedLinesByFile.get(suppression.file)?.has(suppression.line),
      );

      const existingLocCount = criticalLocViolations.length - blockingLocViolations.length;
      const existingSuppressionCount = criticalSuppressions.length - blockingSuppressions.length;
      if (existingLocCount || existingSuppressionCount) {
        warnings.push(
          `Structural baseline: ${existingLocCount} existing LOC violation(s), ${existingSuppressionCount} existing suppression(s); advisory in normal mode.`,
        );
      }
    }
  }

  const locCount = blockingLocViolations.length;
  const suppCount = blockingSuppressions.length;

  if (locCount > 0 || suppCount > 0) {
    if (options.force) {
      warnings.push(
        `Structural health bypassed (--force): ${locCount} blocking LOC violation(s), ${suppCount} blocking suppression(s) skipped by PO authority.`,
      );
    } else {
      for (const v of blockingLocViolations) {
        const baselineLines = strict ? null : baselineLineCounts.get(v.file);
        const reason = strict
          ? `has ${v.lines} LOC, exceeding the ${maxLines}-line hard ceiling`
          : baselineLines !== null && baselineLines >= maxLines
            ? `grew from ${baselineLines} to ${v.lines} LOC while exceeding the ${maxLines}-line hard ceiling`
            : `newly exceeds the ${maxLines}-line hard ceiling with ${v.lines} LOC`;
        failures.push(`file budget: "${v.file}" ${reason}`);
      }
      for (const s of blockingSuppressions) {
        const finding = strict ? 'detected' : 'introduced';
        failures.push(`anti-slop: quality suppression "${s.type}" ${finding} in ${s.file}:${s.line}`);
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    warnings,
  };
}
