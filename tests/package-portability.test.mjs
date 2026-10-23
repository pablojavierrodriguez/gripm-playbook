import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNC_CLI = path.join(ROOT, 'scripts', 'sync-playbook.mjs');
const GATE_CLI = path.join(ROOT, 'scripts', 'gate-qa.mjs');
const AUDIT_CLI = path.join(ROOT, 'scripts', 'audit-ux-code.cjs');
const CHECK_LOC_CLI = path.join(ROOT, 'scripts', 'check-loc.mjs');
const INIT_CLI = path.join(ROOT, 'scripts', 'init.mjs');

function createTempDir(prefix = 'portability-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createFile(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function runNode(script, args = [], options = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    ...options,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

describe('package portability & dynamic root resolution (PLAY-037)', () => {
  test('gate-qa resolves root to target consumer repo (not to package dir)', () => {
    const sandbox = createTempDir('consumer-gate-');
    createFile(sandbox, 'package.json', JSON.stringify({ name: 'consumer-app', scripts: {} }));
    createFile(
      sandbox,
      'backlog/tasks/APP-001.md',
      `---
id: APP-001
status: review
dependencies: []
---

## Description
Consumer task.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Done
<!-- AC:END -->
`,
    );

    // Run gate-qa from inside consumer repo, pointing at packaged script
    const res = runNode(GATE_CLI, ['APP-001', '--no-run'], { cwd: sandbox });
    assert.equal(res.status, 2, `expected inspection exit 2 (no-run), got ${res.status}:\n${res.output}`);
    assert.match(res.output, /APP-001 satisfies the task checks/);
    assert.ok(!res.output.includes('no task found for "APP-001"'), 'failed to find task in consumer repo');
  });

  test('audit-ux resolves root to process.cwd() instead of package dir', () => {
    const sandbox = createTempDir('consumer-audit-');
    createFile(sandbox, 'package.json', JSON.stringify({ name: 'consumer-app' }));
    createFile(sandbox, 'src/App.tsx', 'export const Button = () => <button>Click</button>;\n');

    // Run from cwd=sandbox (no AUDIT_UX_ROOT). Root must resolve to sandbox via cwd.
    const res = runNode(AUDIT_CLI, ['--format', 'json'], { cwd: sandbox });
    assert.equal(res.status, 0, `audit should pass cleanly on valid file:\n${res.output}`);
    const parsed = JSON.parse(res.stdout);
    // src is set when the src/ directory is detected in the resolved root
    assert.equal(parsed.src, 'src', 'src must reflect the consumer sandbox root, not the package dir');
    assert.equal(typeof parsed.summary.total, 'number', 'summary.total must be a number');
  });

  test('playbook init and sync use zero-network local package bundle by default', () => {
    const sandbox = createTempDir('consumer-sync-');
    createFile(sandbox, 'package.json', JSON.stringify({ name: 'consumer-app' }));

    // Simulate consumer installing the package: sync from local bundle (--source ROOT)
    // In a real installed package, the auto-detect kicks in; in tests, we pass --source.
    const res = runNode(SYNC_CLI, ['sync', '--repo', sandbox, '--source', ROOT, '--yes', '--init-agents'], {
      cwd: sandbox,
    });

    assert.equal(res.status, 0, `sync should succeed with local source:\n${res.output}`);
    assert.ok(fs.existsSync(path.join(sandbox, '.agents', 'TEAM_PLAYBOOK.md')), 'TEAM_PLAYBOOK.md was not synced');
    assert.ok(fs.existsSync(path.join(sandbox, 'AGENTS.md')), 'AGENTS.md was not initialized');
    assert.ok(fs.existsSync(path.join(sandbox, '.playbook-lock.json')), '.playbook-lock.json was not created');
    assert.match(res.output, /@local/, 'upstream banner must reflect local source');
  });

  test('playbook CLI router dispatches gate, audit, check-loc, review and help', () => {
    const sandbox = createTempDir('consumer-router-');
    createFile(sandbox, 'package.json', JSON.stringify({ name: 'router-app' }));

    // 1. Help
    const help = runNode(SYNC_CLI, ['help'], { cwd: sandbox });
    assert.equal(help.status, 0);
    assert.match(help.output, /Commands:/);
    assert.match(help.output, /gate/);
    assert.match(help.output, /audit/);
    assert.match(help.output, /check-loc/);

    // 2. Audit dispatch
    createFile(sandbox, 'src/App.tsx', 'export const App = () => <div>Hello</div>;\n');
    const audit = runNode(SYNC_CLI, ['audit', '--format', 'json'], { cwd: sandbox });
    assert.equal(audit.status, 0);

    // 3. Check-loc dispatch
    const loc = runNode(SYNC_CLI, ['check-loc', '--json'], { cwd: sandbox });
    assert.equal(loc.status, 0);
    assert.match(loc.output, /"passed":\s*true/);

    // 4. Review dispatch
    const review = runNode(SYNC_CLI, ['review'], { cwd: sandbox });
    assert.equal(review.status, 0);
    assert.match(review.output, /No backlog\/tasks directory|No items in review/);
  });

  test('autonomous gate-qa certifies consumer repo without internal playbook scripts', () => {
    const sandbox = createTempDir('consumer-autonomous-');
    createFile(
      sandbox,
      'package.json',
      JSON.stringify({
        name: 'clean-consumer',
        scripts: {
          validate: 'node -e "process.exit(0)"',
          test: 'node -e "process.exit(0)"',
        },
      }),
    );
    createFile(sandbox, 'src/Component.tsx', 'export const C = () => <span>Clean</span>;\n');
    const taskPath = createFile(
      sandbox,
      'backlog/tasks/FEAT-001.md',
      `---
id: FEAT-001
status: review
dependencies: []
---

## Description
Feature ready for certification.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tested and validated
<!-- AC:END -->
`,
    );

    // Run gate via CLI with autonomous fallback enabled
    const res = runNode(SYNC_CLI, ['gate', 'FEAT-001', '--by', 'qa-auditor:test-session'], {
      cwd: sandbox,
    });

    assert.equal(res.status, 0, `gate should pass under autonomous mode:\n${res.output}`);
    assert.match(res.output, /GATE PASSED - FEAT-001 promoted review → ready/);

    // Assert file status mutated on disk
    const content = fs.readFileSync(taskPath, 'utf8');
    assert.match(content, /status:\s*ready/);
  });

  test('init adds non-destructive scripts to consumer package.json', () => {
    const sandbox = createTempDir('consumer-init-scripts-');
    createFile(
      sandbox,
      'package.json',
      JSON.stringify({
        name: 'custom-app',
        scripts: {
          test: 'jest',
        },
      }),
    );

    const res = runNode(INIT_CLI, ['--repo', sandbox, '--yes', '--no-board'], {
      cwd: sandbox,
    });
    assert.equal(res.status, 0, `init failed:\n${res.output}`);

    const pkg = JSON.parse(fs.readFileSync(path.join(sandbox, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts.test, 'jest', 'must preserve original consumer test script');
    assert.equal(pkg.scripts['gate:qa'], 'playbook gate');
    assert.equal(pkg.scripts['gate:review'], 'playbook review');
    assert.equal(pkg.scripts['audit:ux'], 'playbook audit');
    assert.equal(pkg.scripts['audit:ux:strict'], 'playbook audit --strict');
    assert.equal(pkg.scripts['check:loc'], 'playbook check-loc');
  });

  test('package.json exports all CLI binaries and files exist on disk', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.ok(pkg.bin, 'package.json must declare bin');
    const requiredBins = ['playbook', 'gripm-playbook', 'gate-qa', 'audit-ux', 'check-loc'];
    for (const bin of requiredBins) {
      assert.ok(pkg.bin[bin], `missing bin "${bin}"`);
      const binPath = path.join(ROOT, pkg.bin[bin]);
      assert.ok(fs.existsSync(binPath), `bin target for "${bin}" does not exist: ${binPath}`);
    }
  });
});
