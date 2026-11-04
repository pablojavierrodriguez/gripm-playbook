import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkStructuralHealth } from '../scripts/lib/anti-slop.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeGitSandbox(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-structural-delta-'));
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'backlog', 'tasks'), { recursive: true });

  for (const file of [
    'scripts/gate-qa.mjs',
    'scripts/audit-engine.mjs',
    'scripts/check-loc.mjs',
  ]) {
    fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
  }
  fs.cpSync(path.join(ROOT, 'scripts/lib'), path.join(dir, 'scripts/lib'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'structural-delta-fixture',
      scripts: {
        validate: 'node -e "process.exit(0)"',
        test: 'node -e "process.exit(0)"',
        'gate:review': 'node -e "process.exit(0)"',
        'audit:ux:strict': 'node -e "process.exit(0)"',
      },
    }),
  );
  fs.writeFileSync(
    path.join(dir, 'backlog', 'tasks', 'PLAY-999.md'),
    [
      '---',
      'id: PLAY-999',
      'title: "Structural gate fixture"',
      'status: review',
      'dependencies: []',
      'priority: high',
      '---',
      '<!-- AC:BEGIN -->',
      '- [x] #1 Fixture is ready for QA',
      '<!-- AC:END -->',
      '',
    ].join('\n'),
  );

  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(dir, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync(
    'git',
    ['-c', 'user.name=QA Test', '-c', 'user.email=qa@example.test', 'commit', '-qm', 'fixture baseline'],
    { cwd: dir },
  );
  return dir;
}

function runGate(dir, ...args) {
  const result = spawnSync(
    process.execPath,
    [path.join(dir, 'scripts', 'gate-qa.mjs'), path.join(dir, 'backlog', 'tasks', 'PLAY-999.md'), ...args],
    { cwd: dir, encoding: 'utf8', timeout: 30000 },
  );
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

test('clean directories pass structural health checks', async () => {
  const health = await checkStructuralHealth(makeGitSandbox());
  assert.equal(health.passed, true);
  assert.deepEqual(health.failures, []);
  assert.deepEqual(health.warnings, []);
});

test('normal gate warns about committed structural debt without blocking certification', () => {
  const dir = makeGitSandbox({
    'src/monolith.js': '// line\n'.repeat(1005),
    'src/suppressed.ts': 'const a = 1;\n// @ts-ignore\nconst b = 2;\n',
  });

  const result = runGate(dir, '--by', 'qa:peer');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Structural baseline: 1 existing LOC violation\(s\), 1 existing suppression\(s\); advisory in normal mode\./);
  assert.match(fs.readFileSync(path.join(dir, 'backlog', 'tasks', 'PLAY-999.md'), 'utf8'), /status:\s*ready/);
});

test('strict gate blocks certification for pre-existing repository-wide debt', () => {
  const dir = makeGitSandbox({
    'src/monolith.js': '// line\n'.repeat(1005),
    'src/suppressed.ts': 'const a = 1;\n// @ts-ignore\nconst b = 2;\n',
  });

  const result = runGate(dir, '--strict', '--by', 'qa:peer');
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /exceeding the 1000-line hard ceiling/);
  assert.match(result.output, /quality suppression "@ts-ignore"/);
  assert.match(fs.readFileSync(path.join(dir, 'backlog', 'tasks', 'PLAY-999.md'), 'utf8'), /status:\s*review/);
});

test('normal gate blocks a newly introduced LOC violation', async () => {
  const dir = makeGitSandbox();
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'monolith.js'), '// line\n'.repeat(1005), 'utf8');

  const health = await checkStructuralHealth(dir);
  assert.equal(health.passed, false);
  assert.ok(health.failures.some((failure) => failure.includes('src/monolith.js')));
});

test('normal gate blocks a newly introduced quality suppression', async () => {
  const dir = makeGitSandbox();
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'suppressed.ts'), '// @ts-ignore\nconst value = 1;\n', 'utf8');

  const health = await checkStructuralHealth(dir);
  assert.equal(health.passed, false);
  assert.ok(health.failures.some((failure) => failure.includes('introduced in src/suppressed.ts:1')));
});

test('normal gate refuses certification when structural regressions are introduced', () => {
  const dir = makeGitSandbox();
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'monolith.js'), '// line\n'.repeat(1005), 'utf8');
  fs.writeFileSync(path.join(dir, 'src', 'suppressed.ts'), '// @ts-ignore\nconst value = 1;\n', 'utf8');

  const result = runGate(dir, '--by', 'qa:peer');
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /newly exceeds the 1000-line hard ceiling/);
  assert.match(result.output, /quality suppression "@ts-ignore" introduced/);
  assert.match(fs.readFileSync(path.join(dir, 'backlog', 'tasks', 'PLAY-999.md'), 'utf8'), /status:\s*review/);
});

test('force bypasses introduced structural regressions and reports the override', () => {
  const dir = makeGitSandbox();
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'monolith.js'), '// line\n'.repeat(1005), 'utf8');
  fs.writeFileSync(path.join(dir, 'src', 'suppressed.ts'), '// @ts-ignore\nconst value = 1;\n', 'utf8');

  const result = runGate(dir, '--force', '--by', 'qa:peer');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Structural health bypassed \(--force\)/);
  assert.match(fs.readFileSync(path.join(dir, 'backlog', 'tasks', 'PLAY-999.md'), 'utf8'), /status:\s*ready/);
});

test('normal gate blocks growth of a file already over the LOC ceiling', async () => {
  const dir = makeGitSandbox({ 'src/monolith.js': '// line\n'.repeat(1005) });
  fs.appendFileSync(path.join(dir, 'src', 'monolith.js'), '// added line\n', 'utf8');

  const health = await checkStructuralHealth(dir);
  assert.equal(health.passed, false);
  assert.ok(health.failures.some((failure) => failure.includes('grew from 1005 to 1006 LOC')));
});

test('strict mode blocks pre-existing repository-wide structural debt', async () => {
  const dir = makeGitSandbox({
    'src/monolith.js': '// line\n'.repeat(1005),
    'src/suppressed.ts': 'const a = 1;\n// @ts-ignore\nconst b = 2;\n',
  });

  const health = await checkStructuralHealth(dir, { strict: true });
  assert.equal(health.passed, false);
  assert.equal(health.failures.length, 2);
});
