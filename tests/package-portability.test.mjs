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

// Copies the shipped package payload into a node_modules layout so the CLI
// runs exactly as an installed dependency would: the auto-detection branch
// (`shouldDefaultToLocalBundle`) keys off `.playbook-manifest.json` sitting at
// the package root, next to scripts/. Without this, that branch is never taken.
function installPackageInto(consumerDir) {
  const pkgDir = path.join(consumerDir, 'node_modules', '@gripm', 'playbook');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.playbook-manifest.json'), 'utf8'));
  const entries = new Set([...(manifest.core || manifest.files || []), '.playbook-manifest.json']);
  for (const rel of entries) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;
    const dest = path.join(pkgDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  return pkgDir;
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
    const lockExists = fs.existsSync(path.join(sandbox, '.gripm', 'playbook-lock.json')) || fs.existsSync(path.join(sandbox, '.playbook-lock.json'));
    assert.ok(lockExists, 'lockfile was not created');
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

  test('installed package auto-detects its own bundle with no --source and no network', () => {
    const sandbox = createTempDir('consumer-autodetect-');
    createFile(sandbox, 'package.json', JSON.stringify({ name: 'autodetect-app' }));
    const pkgDir = installPackageInto(sandbox);

    // Run the packaged CLI from inside node_modules, WITHOUT --source/--remote.
    // This is the only way to exercise `shouldDefaultToLocalBundle`.
    const cli = path.join(pkgDir, 'scripts', 'sync-playbook.mjs');
    const res = runNode(cli, ['sync', '--repo', sandbox, '--yes', '--init-agents'], {
      cwd: sandbox,
      env: { ...process.env, PLAYBOOK_OFFLINE: '1', HTTPS_PROXY: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9' },
    });

    assert.equal(res.status, 0, `auto-detected sync should succeed offline:\n${res.output}`);
    assert.match(res.output, /@local/, 'must resolve to the local bundle, not raw.githubusercontent.com');
    assert.ok(
      !res.output.includes('raw.githubusercontent.com'),
      'auto-detection fell back to the GitHub remote',
    );
    assert.ok(
      fs.existsSync(path.join(sandbox, '.agents', 'TEAM_PLAYBOOK.md')),
      'framework file was not installed via auto-detection',
    );
    const lockExists = fs.existsSync(path.join(sandbox, '.gripm', 'playbook-lock.json')) || fs.existsSync(path.join(sandbox, '.playbook-lock.json'));
    assert.ok(lockExists, 'lockfile was not written');
  });

  test('the local-bundle path is not taken when the target IS the package root', () => {
    // The guard `targetDir !== packageBundleRoot` only stops the bundle from
    // being treated as its own source (a pointless self-copy). Upstream sync
    // into the package root stays legitimate, so assert on the real contract:
    // the `@local` path is skipped. Blocked via PLAYBOOK_OFFLINE so it fails fast, offline.
    const pkgDir = installPackageInto(createTempDir('selfsync-'));
    const cli = path.join(pkgDir, 'scripts', 'sync-playbook.mjs');
    const res = runNode(cli, ['sync', '--repo', pkgDir, '--yes'], {
      cwd: pkgDir,
      env: { ...process.env, PLAYBOOK_OFFLINE: '1', HTTPS_PROXY: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9' },
    });
    assert.ok(!res.output.includes('@local'), 'bundle root must not resolve to itself as a local source');
    assert.notEqual(res.status, 0, 'blocked upstream must not report success');
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

  test('zero-clutter: consumer sync confines lockfile to .gripm/ and auto-prunes obsolete renamed skills', () => {
    const sandbox = createTempDir('consumer-zeroclutter-');
    createFile(sandbox, 'package.json', JSON.stringify({ name: 'consumer-legacy' }));

    // Simulate pre-existing legacy state: .playbook-lock.json in root, legacy skills and legacy scripts
    const legacySkillFile = '.agents/skills/worldclass-product-designer/SKILL.md';
    createFile(sandbox, legacySkillFile, '# Legacy Designer Skill\n');
    const legacyScriptContent = fs.readFileSync(path.join(ROOT, 'scripts', 'gate-qa.mjs'), 'utf8');
    createFile(sandbox, 'scripts/gate-qa.mjs', legacyScriptContent);
    createFile(sandbox, '.playbook-lock.json', JSON.stringify({
      playbook: 'local',
      ref: 'v2.5.0',
      files: {
        [legacySkillFile]: 'legacy-hash',
        'scripts/gate-qa.mjs': 'some-older-hash',
      },
      customizations: [],
    }));

    // Run sync in consumer mode
    const res = runNode(SYNC_CLI, ['sync', '--repo', sandbox, '--source', ROOT, '--yes'], {
      cwd: sandbox,
    });
    assert.equal(res.status, 0, `sync should succeed:\n${res.output}`);

    // Assert: lockfile migrated to .gripm/playbook-lock.json and removed from root
    assert.ok(fs.existsSync(path.join(sandbox, '.gripm', 'playbook-lock.json')), '.gripm/playbook-lock.json must exist');
    assert.ok(!fs.existsSync(path.join(sandbox, '.playbook-lock.json')), 'legacy root .playbook-lock.json must be removed');

    // Assert: obsolete legacy skill pruned and empty folder removed
    assert.ok(!fs.existsSync(path.join(sandbox, legacySkillFile)), 'obsolete skill file must be pruned');
    assert.ok(!fs.existsSync(path.join(sandbox, '.agents', 'skills', 'worldclass-product-designer')), 'obsolete skill folder must be removed');

    // Assert: canonical new skill installed
    assert.ok(fs.existsSync(path.join(sandbox, '.agents', 'skills', 'product-designer', 'SKILL.md')), 'new skill must be installed');

    // Assert: consumer does not get scripts/ directory populated, and legacy scripts were cleaned
    assert.ok(!fs.existsSync(path.join(sandbox, 'scripts', 'gate-qa.mjs')), 'legacy script in scripts/ must be removed');
  });

  test('playbook gate CLI router dispatches start, submit and unblock correctly', () => {
    const sandbox = createTempDir('consumer-router-sub-');
    createFile(sandbox, 'package.json', JSON.stringify({ name: 'router-sub-app' }));
    const taskPath = createFile(
      sandbox,
      'backlog/tasks/TASK-100.md',
      `---
id: TASK-100
status: draft
dependencies: []
---

## Description
Testing router dispatch.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Done
<!-- AC:END -->
`,
    );

    // 1. Dispatch start
    const startRes = runNode(SYNC_CLI, ['gate', 'start', 'TASK-100', '--by', 'human:tester'], { cwd: sandbox });
    assert.equal(startRes.status, 0, `gate start failed:\n${startRes.output}`);
    assert.match(startRes.output, /START ALLOWED/);
    assert.match(fs.readFileSync(taskPath, 'utf8'), /status:\s*doing/);

    // 2. Dispatch submit
    const submitRes = runNode(SYNC_CLI, ['gate', 'submit', 'TASK-100'], { cwd: sandbox });
    assert.equal(submitRes.status, 0, `gate submit failed:\n${submitRes.output}`);
    assert.match(submitRes.output, /SUBMIT ALLOWED/);
    assert.match(fs.readFileSync(taskPath, 'utf8'), /status:\s*review/);

    // 3. Mark blocked and dispatch unblock
    fs.writeFileSync(taskPath, fs.readFileSync(taskPath, 'utf8').replace('status: review', 'status: blocked\nblocked_reason: "waiting"'));
    const unblockRes = runNode(SYNC_CLI, ['gate', 'unblock', 'TASK-100'], { cwd: sandbox });
    assert.equal(unblockRes.status, 0, `gate unblock failed:\n${unblockRes.output}`);
    assert.match(unblockRes.output, /UNBLOCK ALLOWED/);
    assert.match(fs.readFileSync(taskPath, 'utf8'), /status:\s*doing/);
  });

  test('audit-ux and check-loc accept --root and --cwd without fatal errors', () => {
    const sandbox = createTempDir('consumer-explicit-root-');
    createFile(sandbox, 'package.json', JSON.stringify({ name: 'explicit-root-app' }));
    createFile(sandbox, 'src/Index.tsx', 'export const Index = () => <div>Hello</div>;\n');

    // Run audit-ux with explicit --root
    const auditRes = runNode(AUDIT_CLI, ['--root', sandbox, '--format', 'json']);
    assert.equal(auditRes.status, 0, `audit-ux failed with --root:\n${auditRes.output}`);

    // Run check-loc with explicit --root
    const locRes = runNode(CHECK_LOC_CLI, ['--root', sandbox, '--json']);
    assert.equal(locRes.status, 0, `check-loc failed with --root:\n${locRes.output}`);
  });

  test('pruneLegacyScripts preserves custom or unmanaged scripts in consumer repository', () => {
    const sandbox = createTempDir('consumer-custom-script-');
    createFile(sandbox, 'package.json', JSON.stringify({ name: 'consumer-custom' }));

    // User's own custom script that happens to share name with framework file
    createFile(sandbox, 'scripts/init.mjs', '// custom consumer init script\nconsole.log("mine");\n');
    createFile(sandbox, 'scripts/custom-tool.js', '// other tool\n');

    const res = runNode(SYNC_CLI, ['sync', '--repo', sandbox, '--source', ROOT, '--yes'], {
      cwd: sandbox,
    });
    assert.equal(res.status, 0, `sync should succeed:\n${res.output}`);

    // Assert: consumer's custom scripts/init.mjs was NOT deleted because it diverged from lock/canonical
    assert.ok(fs.existsSync(path.join(sandbox, 'scripts', 'init.mjs')), 'custom scripts/init.mjs must be preserved');
    assert.ok(fs.existsSync(path.join(sandbox, 'scripts', 'custom-tool.js')), 'unrelated scripts must be preserved');
  });
});
