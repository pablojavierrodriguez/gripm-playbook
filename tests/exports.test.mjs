import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkLocalCatalog } from '../scripts/validate-repo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT_BIN = path.join(ROOT, 'scripts', 'audit-ux-code.cjs');

function createTempDir(prefix = 'exports-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createFile(dir, relPath, content) {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

describe('exports map (PLAY-008)', () => {
  test('package.json exports map has stable paths and backwards-compatible wildcard', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.ok(pkg.exports, 'package.json must declare an exports field');

    assert.equal(pkg.exports['.'], './scripts/sync-playbook.mjs');
    assert.equal(pkg.exports['./audit'], './scripts/audit-ux-code.cjs');
    assert.equal(pkg.exports['./gate'], './scripts/gate-qa.mjs');
    assert.equal(pkg.exports['./check-loc'], './scripts/check-loc.mjs');
    assert.equal(pkg.exports['./scripts/*'], './scripts/*');

    for (const [subpath, target] of Object.entries(pkg.exports)) {
      if (subpath.includes('*')) continue;
      const targetPath = path.resolve(ROOT, target);
      assert.ok(
        fs.existsSync(targetPath),
        `Export target for ${subpath} does not exist on disk: ${targetPath}`
      );
    }
  });
});

describe('local catalog error messaging in audit-ux-code (PLAY-008 AC #4 & #5)', () => {
  test('rejects local rule using reserved canonical pattern with specific pattern message', () => {
    const dir = createTempDir();
    createFile(dir, 'src/App.tsx', 'export const App = () => <div>Hello</div>;\n');
    createFile(
      dir,
      '.uxaudit.json',
      JSON.stringify({
        src: 'src',
        rules: 'local-rules.json'
      })
    );
    createFile(
      dir,
      'local-rules.json',
      JSON.stringify({
        version: 1,
        rules: [
          {
            id: 'UX-999',
            title: 'Custom reserved',
            severity: 'WARNING',
            message: 'Reserved pattern violation',
            check: { line: ['<div'] },
            fix: 'Fix it'
          }
        ]
      })
    );

    const res = spawnSync(process.execPath, [AUDIT_BIN], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, AUDIT_UX_ROOT: dir }
    });

    assert.equal(res.status, 2);
    assert.match(res.stderr, /uses the reserved canonical pattern/);
    assert.match(res.stderr, /UX-NNN belongs to scripts\/ux-rules\.json/);
  });

  test('names canonical rule title when local rule collides with canonical rule', () => {
    const dir = createTempDir();
    createFile(dir, 'src/App.tsx', 'export const App = () => <div>Hello</div>;\n');
    createFile(
      dir,
      '.uxaudit.json',
      JSON.stringify({
        src: 'src',
        rules: 'local-rules.json'
      })
    );

    const canonical = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/ux-rules.json'), 'utf8'));
    const canonical001 = canonical.rules.find((r) => r.id === 'UX-001');

    createFile(
      dir,
      'local-rules.json',
      JSON.stringify({
        version: 1,
        rules: [
          {
            id: 'UX-001',
            title: 'Colliding rule',
            severity: 'WARNING',
            message: 'Collides',
            check: { line: ['<div'] },
            fix: 'Fix it'
          }
        ]
      })
    );

    const res = spawnSync(process.execPath, [AUDIT_BIN], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, AUDIT_UX_ROOT: dir }
    });

    assert.equal(res.status, 2);
    assert.ok(
      res.stderr.includes(canonical001.title),
      `stderr should include canonical title "${canonical001.title}"`
    );
    assert.match(res.stderr, /collides with canonical rule/);
  });
});

describe('validate-repo: checkLocalCatalog (PLAY-008 AC #3, #4, #5)', () => {
  test('checkLocalCatalog passes with 0 errors for valid local catalog', () => {
    const dir = createTempDir();
    createFile(
      dir,
      '.uxaudit.json',
      JSON.stringify({
        rules: 'my-rules.json'
      })
    );
    createFile(
      dir,
      'my-rules.json',
      JSON.stringify({
        version: 1,
        rules: [
          {
            id: 'MYAPP-001',
            title: 'Custom valid rule',
            severity: 'WARNING',
            message: 'Valid message',
            check: { line: ['<div'] }
          }
        ]
      })
    );

    const errs = checkLocalCatalog(dir);
    assert.deepEqual(errs, []);
  });

  test('checkLocalCatalog rejects canonical collision and names the canonical signature', () => {
    const dir = createTempDir();
    const canonical = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/ux-rules.json'), 'utf8'));
    const canonical001 = canonical.rules.find((r) => r.id === 'UX-001');

    createFile(dir, '.uxaudit.json', JSON.stringify({ rules: 'my-rules.json' }));
    createFile(
      dir,
      'my-rules.json',
      JSON.stringify({
        version: 1,
        rules: [
          {
            id: 'UX-001',
            title: 'Local collision',
            severity: 'WARNING',
            message: 'Collides',
            check: { line: ['<div'] }
          }
        ]
      })
    );

    const errs = checkLocalCatalog(dir);
    assert.equal(errs.length, 1);
    assert.ok(errs[0].includes(canonical001.title));
    assert.match(errs[0], /collides with canonical rule/);
  });

  test('checkLocalCatalog rejects reserved pattern UX-NNN with distinct message', () => {
    const dir = createTempDir();
    createFile(dir, '.uxaudit.json', JSON.stringify({ rules: 'my-rules.json' }));
    createFile(
      dir,
      'my-rules.json',
      JSON.stringify({
        version: 1,
        rules: [
          {
            id: 'UX-099',
            title: 'Local reserved pattern',
            severity: 'WARNING',
            message: 'Reserved',
            check: { line: ['<div'] }
          }
        ]
      })
    );

    const errs = checkLocalCatalog(dir);
    assert.equal(errs.length, 1);
    assert.match(errs[0], /uses the reserved canonical pattern "UX-NNN"/);
  });

  test('checkLocalCatalog rejects local rule missing valid check definition', () => {
    const dir = createTempDir();
    createFile(dir, '.uxaudit.json', JSON.stringify({ rules: 'my-rules.json' }));
    createFile(
      dir,
      'my-rules.json',
      JSON.stringify({
        version: 1,
        rules: [
          {
            id: 'MYAPP-002',
            title: 'No check rule',
            severity: 'WARNING',
            message: 'Missing check'
          }
        ]
      })
    );

    const errs = checkLocalCatalog(dir);
    assert.equal(errs.length, 1);
    assert.match(errs[0], /missing a valid "check" definition/);
  });
});
