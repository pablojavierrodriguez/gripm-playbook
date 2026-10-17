import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkFileBudget,
  countFileLines,
  parseIgnoreLines,
  parseIgnoreFile,
  isIgnored,
  DEFAULT_MAX_LINES,
  DEFAULT_WARN_LINES
} from '../scripts/check-loc.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_LOC_BIN = path.join(ROOT, 'scripts', 'check-loc.mjs');

function createTempDir(prefix = 'check-loc-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createFile(dir, relPath, content) {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

describe('check-loc: countFileLines', () => {
  test('returns 0 for non-existent file', () => {
    assert.equal(countFileLines('/non/existent/path.js'), 0);
  });

  test('returns 0 for empty file', () => {
    const dir = createTempDir();
    const file = createFile(dir, 'empty.js', '');
    assert.equal(countFileLines(file), 0);
  });

  test('counts lines correctly with trailing newline (LF)', () => {
    const dir = createTempDir();
    const file = createFile(dir, 'test.js', 'line 1\nline 2\nline 3\n');
    assert.equal(countFileLines(file), 3);
  });

  test('counts lines correctly without trailing newline (LF)', () => {
    const dir = createTempDir();
    const file = createFile(dir, 'test.js', 'line 1\nline 2\nline 3');
    assert.equal(countFileLines(file), 3);
  });

  test('counts lines correctly with CRLF endings', () => {
    const dir = createTempDir();
    const file = createFile(dir, 'test.js', 'line 1\r\nline 2\r\nline 3\r\n');
    assert.equal(countFileLines(file), 3);
  });
});

describe('check-loc: ignore parsing and matching', () => {
  test('parseIgnoreLines filters comments and blank lines', () => {
    const lines = [
      '# Comment',
      '',
      'dist/',
      '*.log',
      'scripts/legacy.js'
    ];
    const rules = parseIgnoreLines(lines);
    assert.equal(rules.length, 3);
    assert.equal(rules[0].pattern, 'dist');
    assert.equal(rules[0].isDirOnly, true);
  });

  test('isIgnored checks default ignored dirs and custom rules', () => {
    const rules = parseIgnoreLines(['legacy/*.js', 'vendor/']);
    assert.equal(isIgnored('node_modules/foo/index.js', false, rules), true);
    assert.equal(isIgnored('.git/HEAD', false, rules), true);
    assert.equal(isIgnored('dist/bundle.js', false, rules), true);
    assert.equal(isIgnored('vendor/lib.js', false, rules), true);
    assert.equal(isIgnored('src/index.js', false, rules), false);
  });
});

describe('check-loc: checkFileBudget API', () => {
  test('passes when all files are under limits', () => {
    const dir = createTempDir();
    createFile(dir, 'src/small.js', 'const a = 1;\n'.repeat(50));
    createFile(dir, 'src/medium.js', 'const b = 2;\n'.repeat(200));

    const result = checkFileBudget({ path: dir, maxLines: 500, warnLines: 250 });
    assert.equal(result.passed, true);
    assert.equal(result.scanned, 2);
    assert.equal(result.violations.length, 0);
    assert.equal(result.warnings.length, 0);
  });

  test('identifies warnings when files are in the warning zone', () => {
    const dir = createTempDir();
    createFile(dir, 'src/warning.js', 'console.log("warn");\n'.repeat(600));

    const result = checkFileBudget({ path: dir, maxLines: 1000, warnLines: 500 });
    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].file, 'src/warning.js');
    assert.equal(result.warnings[0].lines, 600);
  });

  test('identifies violations and keeps passed=true in advisory mode', () => {
    const dir = createTempDir();
    createFile(dir, 'src/huge.js', 'console.log("huge");\n'.repeat(1050));
    createFile(dir, 'src/ok.js', 'console.log("ok");\n'.repeat(100));

    const result = checkFileBudget({ path: dir, maxLines: 1000, warnLines: 500 });
    assert.equal(result.passed, true); // Advisory by default
    assert.equal(result.hasDebt, true);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0].file, 'src/huge.js');
    assert.equal(result.violations[0].lines, 1050);
  });

  test('fails (passed=false) when strict: true is passed and violations exist', () => {
    const dir = createTempDir();
    createFile(dir, 'src/huge.js', 'console.log("huge");\n'.repeat(1050));

    const result = checkFileBudget({ path: dir, maxLines: 1000, strict: true });
    assert.equal(result.passed, false);
    assert.equal(result.violations.length, 1);
  });

  test('respects .locignore in target root', () => {
    const dir = createTempDir();
    createFile(dir, 'src/monolith.js', 'console.log("big");\n'.repeat(1200));
    createFile(dir, '.locignore', 'src/monolith.js\n');

    const result = checkFileBudget({ path: dir, maxLines: 1000, strict: true });
    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
  });

  test('respects options.exclude parameter', () => {
    const dir = createTempDir();
    createFile(dir, 'src/legacy.js', 'console.log("legacy");\n'.repeat(1200));

    const result = checkFileBudget({ path: dir, maxLines: 1000, exclude: ['src/legacy.js'], strict: true });
    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
  });

  test('auto-detects candidate source directories (src/)', () => {
    const dir = createTempDir();
    createFile(dir, 'src/app.js', 'console.log("app");\n'.repeat(20));
    createFile(dir, 'auxiliary/tool.js', 'console.log("tool");\n'.repeat(20));

    const result = checkFileBudget({ path: dir });
    assert.equal(result.scanned, 1);
    assert.equal(result.passed, true);
  });
});

describe('check-loc: CLI runner', () => {
  test('exits 0 when within budget', () => {
    const dir = createTempDir();
    createFile(dir, 'src/ok.js', 'console.log("ok");\n'.repeat(10));

    const res = spawnSync(process.execPath, [CHECK_LOC_BIN, '--path', dir], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /All files within modular limits/);
  });

  test('exits 0 with PO advisory notice on violation in default (advisory) mode', () => {
    const dir = createTempDir();
    createFile(dir, 'src/bad.js', 'console.log("bad");\n'.repeat(1050));

    const res = spawnSync(process.execPath, [CHECK_LOC_BIN, '--path', dir], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /PO Advisory/);
    assert.match(res.stdout, /Technical Debt Notice/);
  });

  test('exits 1 on violation when --strict flag is used', () => {
    const dir = createTempDir();
    createFile(dir, 'src/bad.js', 'console.log("bad");\n'.repeat(1050));

    const res = spawnSync(process.execPath, [CHECK_LOC_BIN, '--path', dir, '--strict'], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 1);
    assert.match(res.stdout, /FILE BUDGET FAILED/);
  });

  test('outputs valid JSON with --json flag', () => {
    const dir = createTempDir();
    createFile(dir, 'src/ok.js', 'console.log("ok");\n'.repeat(10));

    const res = spawnSync(process.execPath, [CHECK_LOC_BIN, '--path', dir, '--json'], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 0);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.passed, true);
    assert.equal(parsed.scanned, 1);
  });
});
