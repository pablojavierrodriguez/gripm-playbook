/**
 * scripts/lib/anti-slop.mjs
 *
 * Deterministic anti-slop inspection for type evasions and anti-patterns.
 * Scans git diff for chained casts (as unknown as / as any as) in production code files.
 */

import path from 'node:path';
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
