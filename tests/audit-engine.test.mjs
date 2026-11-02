import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  scanCodebase,
  detectStack,
  detectTests,
  computeHealthScore,
  checkAntiSlop,
  ANTI_SLOP_PATTERNS,
  TS_IGNORE_RE,
  TS_NOCHECK_RE,
  ESLINT_DISABLE_RE,
  CONSOLE_LOG_RE,
  TODO_RE
} from '../scripts/audit-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT_ENGINE_BIN = path.join(ROOT, 'scripts', 'audit-engine.mjs');

function createTempDir(prefix = 'audit-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createFile(dir, relPath, content) {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

describe('audit-engine: stack detection (detectStack)', () => {
  test('detects Node.js project from package.json', () => {
    const dir = createTempDir();
    createFile(dir, 'package.json', JSON.stringify({ name: 'test-node-app' }));
    const stack = detectStack(dir);
    assert.ok(stack.includes('Node'), 'should detect Node');
  });

  test('detects React project from dependencies or devDependencies', () => {
    const dir = createTempDir();
    createFile(dir, 'package.json', JSON.stringify({
      name: 'test-react-app',
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' }
    }));
    const stack = detectStack(dir);
    assert.ok(stack.includes('Node'), 'should detect Node');
    assert.ok(stack.includes('React'), 'should detect React');
  });

  test('detects Vue project from dependencies', () => {
    const dir = createTempDir();
    createFile(dir, 'package.json', JSON.stringify({
      name: 'test-vue-app',
      dependencies: { vue: '^3.0.0' }
    }));
    const stack = detectStack(dir);
    assert.ok(stack.includes('Node'), 'should detect Node');
    assert.ok(stack.includes('Vue'), 'should detect Vue');
  });

  test('detects TypeScript from package.json, tsconfig.json, or .ts files', () => {
    const dir = createTempDir();
    createFile(dir, 'tsconfig.json', '{}');
    createFile(dir, 'src/index.ts', 'export const x: number = 1;\n');
    const stack = detectStack(dir);
    assert.ok(stack.includes('TypeScript'), 'should detect TypeScript');
  });

  test('detects Python from pyproject.toml, requirements.txt, or .py files', () => {
    const dir = createTempDir();
    createFile(dir, 'pyproject.toml', '[tool.poetry]\nname = "app"\n');
    createFile(dir, 'main.py', 'print("hello")\n');
    const stack = detectStack(dir);
    assert.ok(stack.includes('Python'), 'should detect Python');
  });

  test('detects Rust from Cargo.toml', () => {
    const dir = createTempDir();
    createFile(dir, 'Cargo.toml', '[package]\nname = "rust-app"\n');
    const stack = detectStack(dir);
    assert.ok(stack.includes('Rust'), 'should detect Rust');
  });

  test('detects Go from go.mod', () => {
    const dir = createTempDir();
    createFile(dir, 'go.mod', 'module example.com/app\n');
    const stack = detectStack(dir);
    assert.ok(stack.includes('Go'), 'should detect Go');
  });

  test('returns empty array when no stack indicators exist', () => {
    const dir = createTempDir();
    createFile(dir, 'readme.txt', 'notes');
    const stack = detectStack(dir);
    assert.deepEqual(stack, []);
  });
});

describe('audit-engine: test infrastructure detection (detectTests)', () => {
  test('detects vitest from package.json script', () => {
    const dir = createTempDir();
    createFile(dir, 'package.json', JSON.stringify({
      scripts: { test: 'vitest run' }
    }));
    const res = detectTests(dir);
    assert.equal(res.detected, true);
    assert.equal(res.framework, 'vitest');
    assert.equal(res.verifyCommand, 'npm test');
  });

  test('detects jest from jest.config.js', () => {
    const dir = createTempDir();
    createFile(dir, 'jest.config.js', 'module.exports = {};');
    const res = detectTests(dir);
    assert.equal(res.detected, true);
    assert.equal(res.framework, 'jest');
    assert.equal(res.verifyCommand, 'npx jest');
  });

  test('detects node:test from package.json script', () => {
    const dir = createTempDir();
    createFile(dir, 'package.json', JSON.stringify({
      scripts: { test: 'node --test' }
    }));
    const res = detectTests(dir);
    assert.equal(res.detected, true);
    assert.equal(res.framework, 'node:test');
    assert.equal(res.verifyCommand, 'npm test');
  });

  test('detects pytest from pytest.ini', () => {
    const dir = createTempDir();
    createFile(dir, 'pytest.ini', '[pytest]');
    const res = detectTests(dir);
    assert.equal(res.detected, true);
    assert.equal(res.framework, 'pytest');
    assert.equal(res.verifyCommand, 'pytest');
  });

  test('detects cargo test from Cargo.toml', () => {
    const dir = createTempDir();
    createFile(dir, 'Cargo.toml', '[package]\nname = "test"');
    const res = detectTests(dir);
    assert.equal(res.detected, true);
    assert.equal(res.framework, 'cargo');
    assert.equal(res.verifyCommand, 'cargo test');
  });

  test('detects go test from go.mod', () => {
    const dir = createTempDir();
    createFile(dir, 'go.mod', 'module test');
    const res = detectTests(dir);
    assert.equal(res.detected, true);
    assert.equal(res.framework, 'go');
    assert.equal(res.verifyCommand, 'go test ./...');
  });

  test('returns detected=false when no test infrastructure exists', () => {
    const dir = createTempDir();
    createFile(dir, 'src/main.js', 'console.log("hello");');
    const res = detectTests(dir);
    assert.equal(res.detected, false);
    assert.equal(res.framework, null);
    assert.equal(res.verifyCommand, null);
  });
});

describe('audit-engine: LOC counting and modularity budget', () => {
  test('passes with 0 violations when all files are under limits', async () => {
    const dir = createTempDir();
    createFile(dir, 'src/small.js', 'const x = 1;\n'.repeat(50));
    createFile(dir, 'src/medium.js', 'const y = 2;\n'.repeat(200));

    const report = await scanCodebase(dir, { maxLines: 1000, warnLines: 500 });
    assert.equal(report.summary.locViolationsCount, 0);
    assert.equal(report.loc.violations.length, 0);
  });

  test('reports warning status for files between 500 and 999 LOC', async () => {
    const dir = createTempDir();
    createFile(dir, 'src/warning.js', 'const w = 1;\n'.repeat(600));

    const report = await scanCodebase(dir, { maxLines: 1000, warnLines: 500 });
    assert.equal(report.summary.locViolationsCount, 1);
    assert.equal(report.loc.violations[0].status, 'warning');
    assert.equal(report.loc.violations[0].lines, 600);
    assert.equal(report.loc.violations[0].file, 'src/warning.js');
  });

  test('reports error status for files >= 1000 LOC', async () => {
    const dir = createTempDir();
    createFile(dir, 'src/monolith.js', 'const m = 1;\n'.repeat(1200));

    const report = await scanCodebase(dir, { maxLines: 1000, warnLines: 500 });
    assert.equal(report.summary.locViolationsCount, 1);
    assert.equal(report.loc.violations[0].status, 'error');
    assert.equal(report.loc.violations[0].lines, 1200);
  });

  test('ignores default ignored directories (node_modules, dist, .git)', async () => {
    const dir = createTempDir();
    createFile(dir, 'node_modules/pkg/giant.js', 'const x = 1;\n'.repeat(1500));
    createFile(dir, 'dist/bundle.js', 'const b = 1;\n'.repeat(1500));
    createFile(dir, '.git/config.js', 'const g = 1;\n'.repeat(1500));
    createFile(dir, 'src/clean.js', 'const c = 1;\n'.repeat(50));

    const report = await scanCodebase(dir);
    assert.equal(report.summary.totalFilesScanned, 1);
    assert.equal(report.summary.locViolationsCount, 0);
  });

  test('respects custom excludes and .locignore file', async () => {
    const dir = createTempDir();
    createFile(dir, 'legacy/monolith.js', 'const old = 1;\n'.repeat(1500));
    createFile(dir, '.locignore', 'legacy/\n');

    const report = await scanCodebase(dir);
    assert.equal(report.summary.locViolationsCount, 0);
  });
});

describe('audit-engine: anti-slop patterns and quality suppressions', () => {
  test('ANTI_SLOP_PATTERNS correctly identify degradation patterns', () => {
    assert.ok(ANTI_SLOP_PATTERNS.tsIgnore.test('// @ts-ignore ignore type error'));
    assert.ok(ANTI_SLOP_PATTERNS.tsNocheck.test('/* @ts-nocheck full file */'));
    assert.ok(ANTI_SLOP_PATTERNS.eslintDisable.test('// eslint-disable-next-line no-undef'));
    assert.ok(ANTI_SLOP_PATTERNS.eslintDisable.test('/* eslint-disable */'));
    assert.ok(ANTI_SLOP_PATTERNS.consoleLog.test('console.log("debug message");'));

    // Should not match clean code or directives mentioned inside strings/help text
    assert.equal(ANTI_SLOP_PATTERNS.tsIgnore.test('const ignore = true;'), false);
    assert.equal(ANTI_SLOP_PATTERNS.tsIgnore.test('console.log("quality suppressions (@ts-ignore, eslint-disable)");'), false);
    assert.equal(ANTI_SLOP_PATTERNS.eslintDisable.test('console.log("disable eslint here");'), false);
    assert.equal(ANTI_SLOP_PATTERNS.consoleLog.test('console.error("error");'), false);
  });

  test('checkAntiSlop returns correct violation type or null', () => {
    assert.deepEqual(checkAntiSlop('// @ts-ignore'), { type: '@ts-ignore' });
    assert.deepEqual(checkAntiSlop('/* @ts-nocheck */'), { type: '@ts-nocheck' });
    assert.deepEqual(checkAntiSlop('// eslint-disable-line'), { type: 'eslint-disable' });
    assert.deepEqual(checkAntiSlop('console.log("test")'), { type: 'console.log' });
    assert.equal(checkAntiSlop('const clean = 1;'), null);
    assert.equal(checkAntiSlop(null), null);
    assert.equal(checkAntiSlop(''), null);
  });

  test('scanCodebase extracts suppressions with exact file, line, and type', async () => {
    const dir = createTempDir();
    const slopContent = [
      '// Line 1: header',
      '// @ts-ignore bypass check',
      'const a: any = 1;',
      '/* @ts-nocheck ignore all */',
      '// eslint-disable-next-line',
      'const b = 2;'
    ].join('\n');
    createFile(dir, 'src/slop.ts', slopContent);

    const report = await scanCodebase(dir);
    assert.equal(report.quality.suppressions.length, 3);

    const tsIgnore = report.quality.suppressions.find((s) => s.type === '@ts-ignore');
    const tsNocheck = report.quality.suppressions.find((s) => s.type === '@ts-nocheck');
    const eslintDisable = report.quality.suppressions.find((s) => s.type === 'eslint-disable');

    assert.equal(tsIgnore.line, 2);
    assert.equal(tsNocheck.line, 4);
    assert.equal(eslintDisable.line, 5);
  });

  test('scanCodebase detects console.log when includeConsoleLog option is enabled', async () => {
    const dir = createTempDir();
    const code = [
      'function compute() {',
      '  console.log("intermediate value");',
      '  return 42;',
      '}'
    ].join('\n');
    createFile(dir, 'src/calc.js', code);

    const reportNoLog = await scanCodebase(dir);
    assert.equal(reportNoLog.quality.suppressions.length, 0);

    const reportWithLog = await scanCodebase(dir, { includeConsoleLog: true });
    assert.equal(reportWithLog.quality.suppressions.length, 1);
    assert.equal(reportWithLog.quality.suppressions[0].type, 'console.log');
    assert.equal(reportWithLog.quality.suppressions[0].line, 2);
  });
});

describe('audit-engine: hidden debt extraction (TODO_RE)', () => {
  test('TODO_RE matches TODO, FIXME, HACK, BUG, and XXX markers', () => {
    assert.ok(TODO_RE.test('// TODO: implement feature'));
    assert.ok(TODO_RE.test('// TODO implement feature'));
    assert.ok(TODO_RE.test('// todo: implement feature with colon'));
    assert.ok(TODO_RE.test('// todo(user): scoped todo'));
    assert.ok(TODO_RE.test('// FIXME: solve memory leak'));
    assert.ok(TODO_RE.test('/* HACK: workaround node bug */'));
    assert.ok(TODO_RE.test('# BUG: crash when empty'));
    assert.ok(TODO_RE.test('// XXX: review security context'));

    // Anti-false-positive: Spanish word 'todo' (all/every) or words in prose should NOT match
    assert.equal(TODO_RE.test('// todo proyecto importado recibia codigos con prefijo'), false);
    assert.equal(TODO_RE.test('// Check for section header (e.g. ## Sprint 1, ### Modulo Auth, ## Bugs)'), false);
    assert.equal(TODO_RE.test('if (/(\\[bug\\]|#bug|\\(bug\\)|fix:|bug:)/i.test(title))'), false);
  });

  test('scanCodebase extracts debt markers with type, line, and message', async () => {
    const dir = createTempDir();
    const code = [
      '// Header',
      '// TODO: add validation for email',
      'const email = "";',
      '// FIXME(author): null pointer exception on missing header',
      '/* HACK: bypass network timeout */',
      '// BUG: duplicate entries created on double click',
      '// XXX: investigate leak in stream handler'
    ].join('\n');
    createFile(dir, 'src/api.js', code);

    const report = await scanCodebase(dir);
    assert.equal(report.todos.length, 5);

    const todo = report.todos.find((t) => t.type === 'TODO');
    const fixme = report.todos.find((t) => t.type === 'FIXME');
    const hack = report.todos.find((t) => t.type === 'HACK');
    const bug = report.todos.find((t) => t.type === 'BUG');
    const xxx = report.todos.find((t) => t.type === 'XXX');

    assert.ok(todo && todo.line === 2 && todo.text.includes('add validation'));
    assert.ok(fixme && fixme.line === 4 && fixme.text.includes('null pointer exception'));
    assert.ok(hack && hack.line === 5 && hack.text.includes('bypass network timeout'));
    assert.ok(bug && bug.line === 6 && bug.text.includes('duplicate entries'));
    assert.ok(xxx && xxx.line === 7 && xxx.text.includes('investigate leak'));
  });
});

describe('audit-engine: deterministic health score (computeHealthScore)', () => {
  test('returns 100 for empty repository or clean code with tests', () => {
    assert.equal(computeHealthScore({ totalFilesScanned: 0 }), 100);

    const cleanScore = computeHealthScore({
      totalFilesScanned: 5,
      locViolations: [],
      suppressions: [],
      todos: [],
      tests: { detected: true, hasTests: true }
    });
    assert.equal(cleanScore, 100);
  });

  test('deducts penalties for LOC violations, suppressions, debt markers, and missing tests', () => {
    const score = computeHealthScore({
      totalFilesScanned: 10,
      locViolations: [{ status: 'error' }, { status: 'warning' }],
      suppressions: [{ type: '@ts-ignore' }],
      todos: [{ type: 'BUG' }, { type: 'TODO' }],
      tests: { detected: false, hasTests: false }
    });
    // 100 - 10 (err) - 3 (warn) - 5 (suppression) - 3 (bug) - 1 (todo) - 15 (no tests) = 63
    assert.equal(score, 63);
  });

  test('bounds score strictly between 0 and 100', () => {
    const heavilyDegraded = computeHealthScore({
      totalFilesScanned: 10,
      locViolations: [
        ...new Array(10).fill({ status: 'error' }),
        ...new Array(10).fill({ status: 'warning' })
      ],
      suppressions: new Array(20).fill({ type: '@ts-ignore' }),
      todos: new Array(20).fill({ type: 'BUG' }),
      tests: { detected: false, hasTests: false }
    });
    assert.ok(heavilyDegraded >= 0 && heavilyDegraded <= 100);
    assert.equal(heavilyDegraded, 0);
  });

  test('never returns NaN on empty or invalid params', () => {
    assert.equal(computeHealthScore({}), 100);
    assert.equal(computeHealthScore({ totalFilesScanned: -1 }), 100);
  });
});

describe('audit-engine: CLI runner', () => {
  test('exits 0 with --help flag and shows usage', () => {
    const res = spawnSync(process.execPath, [AUDIT_ENGINE_BIN, '--help'], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Usage:/);
    assert.match(res.stdout, /--strict/);
    assert.match(res.stdout, /--format json/);
  });

  test('exits 0 and outputs valid structured JSON with --format json', () => {
    const dir = createTempDir();
    createFile(dir, 'src/index.js', 'console.log("ok");\n');

    const res = spawnSync(process.execPath, [AUDIT_ENGINE_BIN, '--repo', dir, '--format', 'json'], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 0);
    const parsed = JSON.parse(res.stdout);
    assert.equal(typeof parsed.score, 'number');
    assert.equal(parsed.summary.totalFilesScanned, 1);
  });

  test('exits 0 and outputs minimal line with --quiet flag', () => {
    const dir = createTempDir();
    createFile(dir, 'src/index.js', 'const x = 1;\n');

    const res = spawnSync(process.execPath, [AUDIT_ENGINE_BIN, '--repo', dir, '--quiet'], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /gripm audit: Health Score/);
    assert.match(res.stdout, /\[PASS\]/);
  });

  test('exits 0 with --strict flag when no critical violations exist', () => {
    const dir = createTempDir();
    createFile(dir, 'src/clean.js', 'const x = 1;\n'.repeat(50));

    const res = spawnSync(process.execPath, [AUDIT_ENGINE_BIN, '--repo', dir, '--strict'], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 0);
  });

  test('exits 1 with --strict flag when critical LOC violation (>= 1000 LOC) exists', () => {
    const dir = createTempDir();
    createFile(dir, 'src/monolith.js', 'const x = 1;\n'.repeat(1050));

    const res = spawnSync(process.execPath, [AUDIT_ENGINE_BIN, '--repo', dir, '--strict'], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /Strict audit failed/);
  });

  test('exits 1 with --strict flag when critical suppression exists', () => {
    const dir = createTempDir();
    createFile(dir, 'src/bad.ts', '// @ts-ignore\nconst x = 1;\n');

    const res = spawnSync(process.execPath, [AUDIT_ENGINE_BIN, '--repo', dir, '--strict'], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /Strict audit failed/);
  });
});
