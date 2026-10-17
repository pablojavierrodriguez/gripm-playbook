import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectTask, loadTasks, mutateTaskFrontmatter, readFrontmatter, resolvePyramid } from '../scripts/gate-qa.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(ROOT, 'scripts', 'gate-qa.mjs');

/** Builds a task file in a throwaway directory and returns its path. */
function makeTask({ id = 'PLAY-900', status = 'review', acs, dependencies = [], extra = '' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  const file = path.join(dir, `${id}.md`);

  const depLines = dependencies.length
    ? `dependencies:\n${dependencies.map((dep) => `  - ${dep}`).join('\n')}`
    : 'dependencies: []';

  const criteria = acs ?? ['- [x] #1 done', '- [x] #2 done'];

  fs.writeFileSync(
    file,
    [
      '---',
      `id: ${id}`,
      `title: "Fixture"`,
      `status: ${status}`,
      `created_date: '2026-10-12'`,
      `updated_date: '2026-10-12'`,
      depLines,
      extra,
      'priority: high',
      '---',
      '',
      '## Description',
      '',
      '<!-- SECTION:DESCRIPTION:BEGIN -->',
      'x',
      '<!-- SECTION:DESCRIPTION:END -->',
      '',
      '## Acceptance Criteria',
      '',
      '<!-- AC:BEGIN -->',
      ...criteria,
      '<!-- AC:END -->',
      '',
    ].join('\n'),
  );

  return { dir, file };
}

/**
 * Parses a task file with the production parser and inspects it.
 *
 * This deliberately does NOT reimplement the frontmatter parser: a forked copy
 * can agree with a broken original and hide the bug. See PLAY-010 — a test that
 * passes for the wrong reason is a defect.
 */
function inspectFile(file, siblings = []) {
  const content = fs.readFileSync(file, 'utf8');
  return inspectTask({ content, frontmatter: readFrontmatter(content) }, new Map(siblings));
}

/** Runs the gate CLI and returns { code, stdout } without throwing. */
function runGate(args) {
  try {
    const stdout = execFileSync(process.execPath, [GATE, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout };
  } catch (err) {
    if (err.status === undefined) throw err;
    return { code: err.status, stdout: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

describe('task inspection', () => {
  test('a complete task in review passes inspection', () => {
    const { file } = makeTask();
    assert.deepEqual(inspectFile(file), []);
  });

  test('rejects a task whose status is not review', () => {
    const { file } = makeTask({ status: 'doing' });
    const failures = inspectFile(file);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /status is "doing"/);
  });

  test('rejects unchecked acceptance criteria and names them', () => {
    const { file } = makeTask({ acs: ['- [x] #1 ok', '- [ ] #2 not done', '- [ ] #3 also open'] });
    const failures = inspectFile(file);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /2 of 3 acceptance criteria are still unchecked/);
    assert.match(failures[0], /#2 not done/);
    assert.match(failures[0], /#3 also open/);
  });

  test('parses values from a CRLF checkout without absorbing the carriage return', () => {
    const { dir, file } = makeTask();
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));

    // loadTasks is the parser under test; do not reimplement it here.
    const parsed = loadTasks(dir).tasks.get('PLAY-900');
    assert.ok(parsed, 'a CRLF task file must still parse');
    assert.equal(parsed.frontmatter.status, 'review', 'status must not be parsed as "review\\r"');
    assert.deepEqual(parsed.frontmatter.dependencies, []);
  });

  test('rejects a task with no AC block at all', () => {
    const { file } = makeTask();
    const stripped = fs
      .readFileSync(file, 'utf8')
      .replace('<!-- AC:BEGIN -->', '')
      .replace('<!-- AC:END -->', '');
    fs.writeFileSync(file, stripped);
    assert.match(inspectFile(file)[0], /no <!-- AC:BEGIN -->/);
  });

  test('rejects an empty AC block', () => {
    const { file } = makeTask({ acs: [] });
    assert.match(inspectFile(file)[0], /acceptance criteria block is empty/);
  });
});

describe('dependency gate (PLAY-016 AC #3)', () => {
  test('accepts dependencies that are all done', () => {
    const { file } = makeTask({ dependencies: ['PLAY-001', 'PLAY-002'] });
    const siblings = [
      ['PLAY-001', { file: 'a.md', content: '', frontmatter: { status: 'done' } }],
      ['PLAY-002', { file: 'b.md', content: '', frontmatter: { status: 'done' } }],
    ];
    assert.deepEqual(inspectFile(file, siblings), []);
  });

  test('rejects a dependency that is not done and names it', () => {
    const { file } = makeTask({ dependencies: ['PLAY-007'] });
    const siblings = [['PLAY-007', { file: 'c.md', content: '', frontmatter: { status: 'draft' } }]];
    const failures = inspectFile(file, siblings);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /dependency "PLAY-007" is "draft"/);
  });

  test('a duplicate dependencies key fails closed', () => {
    const { file } = makeTask();
    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf8').replace('dependencies: []', 'dependencies: []\ndependencies:\n  - PLAY-007'),
    );
    const parsed = readFrontmatter(fs.readFileSync(file, 'utf8'));
    // Both defences must hold: collectList refuses to pick a winner between two
    // top-level keys, AND the duplicate-key guard rejects the document. Assert
    // each separately so a revert of either one is observable.
    assert.deepEqual(parsed.dependencies, [], 'an ambiguous key must not resolve to a list');
    assert.deepEqual(parsed.__duplicateKeys, ['dependencies']);

    const failures = inspectFile(file);
    assert.ok(
      failures.some((f) => /duplicate frontmatter key/.test(f)),
      'a duplicate key must be reported, not silently resolved',
    );
  });

  test('two top-level dependency declarations resolve to no list at all', () => {
  // Asserts collectList's refusal to pick a winner in isolation: no duplicate
  // key here, so the __duplicateKeys guard is not what rejects it. The only
  // thing standing between this document and a silently-shadowed list is
  // collectList returning nothing when the key count is not exactly one.
  const single = readFrontmatter('---\nid: X\ndependencies:\n  - PLAY-001\n---\n');
  assert.deepEqual(single.dependencies, ['PLAY-001'], 'one key must resolve normally');

  const doubled = readFrontmatter('---\nid: X\ndependencies:\n  - PLAY-001\ndependencies:\n  - PLAY-002\n---\n');
  assert.deepEqual(doubled.dependencies, [], 'two keys must resolve to nothing, never to the first');
});

test('a nested dependencies key fails closed', () => {
    const { file } = makeTask();
    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf8').replace('dependencies: []', 'meta:\n  dependencies:\n    - PLAY-007'),
    );
    const failures = inspectFile(file);
    assert.ok(
      failures.some((f) => /nested under another key/.test(f)),
      'a nested key must be reported, not silently ignored',
    );
  });

  test('rejects a dependency that does not exist on disk', () => {
    const { file } = makeTask({ dependencies: ['PLAY-404'] });
    assert.match(inspectFile(file)[0], /dependency "PLAY-404" does not exist/);
  });

  test('a capitalised Dependencies key cannot void the gate', () => {
    const { file } = makeTask();
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('dependencies: []', 'Dependencies:\n  - PLAY-007'));
    // Assert the resolved list directly: a done dependency proves the key was
    // parsed. Asserting only "it failed" would pass even if the key were
    // ignored, because PLAY-007 is not done.
    const parsed = readFrontmatter(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(parsed.dependencies, ['PLAY-007'], 'Dependencies: must parse case-insensitively');

    const done = [['PLAY-007', { file: 'c.md', content: '', frontmatter: { status: 'done' } }]];
    assert.deepEqual(inspectFile(file, done), [], 'a done dependency under a capitalised key must pass');
  });

  test('whitespace before the colon cannot void the gate', () => {
    const { file } = makeTask();
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('dependencies: []', 'dependencies :\n  - PLAY-007'));
    const parsed = readFrontmatter(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(parsed.dependencies, ['PLAY-007'], '"dependencies :" must still parse');

    const done = [['PLAY-007', { file: 'c.md', content: '', frontmatter: { status: 'done' } }]];
    assert.deepEqual(inspectFile(file, done), []);
  });

  test('quoted block-list items are unquoted, as in production', () => {
    const { file } = makeTask();
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('dependencies: []', 'dependencies:\n  - "PLAY-001"'));
    const siblings = [['PLAY-001', { file: 'a.md', content: '', frontmatter: { status: 'done' } }]];
    assert.deepEqual(inspectFile(file, siblings), []);
  });
});

describe('blocked invariant (PLAY-016 AC #2)', () => {
  test('rejects status blocked without a blocked_reason', () => {
    const { file } = makeTask({ status: 'blocked' });
    const failures = inspectFile(file);
    assert.ok(failures.some((f) => /blocked_reason is missing or empty/.test(f)));
  });

  test('rejects a whitespace-only blocked_reason', () => {
    const { file } = makeTask({ status: 'blocked', extra: 'blocked_reason: "   "' });
    assert.ok(
      inspectFile(file).some((f) => /blocked_reason is missing or empty/.test(f)),
      'whitespace is not a reason',
    );
  });

  test('accepts status blocked with a reason', () => {
    const { file } = makeTask({ status: 'blocked', extra: 'blocked_reason: "waiting on API"' });
    const failures = inspectFile(file);
    assert.ok(failures.every((f) => !/blocked_reason/.test(f)));
  });

  test('rejects a blocked_reason set on a task that is not blocked', () => {
    const { file } = makeTask({ status: 'review', extra: 'blocked_reason: "stale field"' });
    assert.match(inspectFile(file)[0], /blocked_reason is set but status is not "blocked"/);
  });
});

describe('unblock guard (PLAY-016 AC #4)', () => {
  test('an item with no id cannot be certified', () => {
    const { file } = makeTask();
    const stripped = fs.readFileSync(file, 'utf8').replace(/^id: PLAY-900$/m, 'id:');
    fs.writeFileSync(file, stripped);
    assert.ok(
      inspectFile(file).some((f) => /declares no "id"/.test(f)),
      'an unidentifiable item must not reach ready, where releases cite the id',
    );
  });

  test('a whitespace-only id is not an id', () => {
    const { file } = makeTask();
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^id: PLAY-900$/m, 'id: "   "'));
    assert.ok(
      inspectFile(file).some((f) => /declares no "id"/.test(f)),
      'whitespace is not an id, for the same reason it is not a blocked_reason',
    );
  });

  test('a blocked item may stay blocked while a dependency is unfinished', () => {
    const { file } = makeTask({ status: 'blocked', dependencies: ['PLAY-007'] });
    const siblings = [['PLAY-007', { file: 'c.md', content: '', frontmatter: { status: 'blocked' } }]];
    assert.ok(
      inspectFile(file, siblings).some((f) => /unblock refused: dependency "PLAY-007"/.test(f)),
      'the unblock guard must report the unfinished dependency',
    );
  });

  test('a blocked item is clean once its dependencies are done', () => {
    const { file } = makeTask({ status: 'blocked', extra: 'blocked_reason: "waiting on API"', dependencies: ['PLAY-001'] });
    const siblings = [['PLAY-001', { file: 'a.md', content: '', frontmatter: { status: 'done' } }]];
    // Assert the positive shape: the guard emits nothing. Asserting the absence
    // of a specific string is unfalsifiable once that string is renamed.
    assert.deepEqual(inspectFile(file, siblings).filter((f) => f.startsWith('unblock refused')), []);
  });

  test('a dependency that does not exist blocks the unblock', () => {
    const { file } = makeTask({ status: 'blocked', extra: 'blocked_reason: "waiting"', dependencies: ['PLAY-999'] });
    const blockers = inspectFile(file).filter((f) => f.startsWith('unblock refused'));
    assert.equal(blockers.length, 1, 'a dangling dependency is neither done nor unlinked');
    assert.match(blockers[0], /does not exist in backlog\/tasks\//);
  });
});

describe('id collision enforcement (PLAY-015)', () => {
  // The detector in loadTasks is only half the protection. What matters is that
  // main() acts on it: without that wiring, an item certifies against a
  // fabricated dependency that a duplicate id declared as done.
  function sandboxWithImpostor() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-impostor-'));
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'backlog', 'tasks'), { recursive: true });
    fs.copyFileSync(GATE, path.join(dir, 'scripts', 'gate-qa.mjs'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"repro","scripts":{}}');

    const real = makeTask({ id: 'PLAY-010', status: 'review' });
    const impostor = makeTask({ id: 'PLAY-010', status: 'done' });
    // The impostor must sort FIRST so it wins the loadTasks Map and shadows the
    // real task. `000-` sorts before `PLAY-`; `zz-` would not.
    fs.copyFileSync(impostor.file, path.join(dir, 'backlog', 'tasks', '000-impostor.md'));
    fs.copyFileSync(real.file, path.join(dir, 'backlog', 'tasks', 'PLAY-010.md'));

    const victim = makeTask({ id: 'PLAY-500', status: 'review', dependencies: ['PLAY-010'] });
    fs.copyFileSync(victim.file, path.join(dir, 'victim.md'));
    return dir;
  }

  function runGateIn(dir, args) {
    try {
      const stdout = execFileSync(process.execPath, [path.join(dir, 'scripts', 'gate-qa.mjs'), ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, stdout };
    } catch (err) {
      if (err.status === undefined) throw err;
      return { code: err.status, stdout: `${err.stdout || ''}${err.stderr || ''}` };
    }
  }

  test('a duplicate id in the backlog blocks certification', () => {
    const dir = sandboxWithImpostor();
    const { code, stdout } = runGateIn(dir, [path.join(dir, 'victim.md'), '--no-run']);
    assert.match(stdout, /declared by two files/, 'the collision must be reported, not silently resolved');
    assert.notEqual(code, 0, 'a forged dependency must not certify');
  });

  test('without the collision wiring the victim would certify', () => {
    // Control: proves the previous assertion is discriminating. Removing the
    // enforcement loop must flip this to a pass, otherwise the test above is
    // asserting something else.
    const dir = sandboxWithImpostor();
    const gatePath = path.join(dir, 'scripts', 'gate-qa.mjs');
    const src = fs.readFileSync(gatePath, 'utf8');
    const loop = /\n\s*for \(const collision of collisions\) \{\n\s*failures\.push\(`task id[^`]*`\);\n\s*\}/;
    const mutated = src.replace(loop, '');
    assert.notEqual(mutated, src, 'the collision-enforcement loop must exist to be removed');
    fs.writeFileSync(gatePath, mutated, 'utf8');

    const { code, stdout } = runGateIn(dir, [path.join(dir, 'victim.md'), '--no-run']);
    assert.match(stdout, /dependencies are valid|GATE PASSED/);
  });
});

describe('unblock command (PLAY-016 AC #4)', () => {
  // Every test here drives the real CLI. unblockMain is the entry point that
  // gives AC #4 its teeth, so exercising inspectTask alone leaves the shipped
  // path untested.
  function sandboxWith(backlog) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-unblock-'));
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'backlog', 'tasks'), { recursive: true });
    fs.copyFileSync(GATE, path.join(dir, 'scripts', 'gate-qa.mjs'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"repro","scripts":{}}');
    for (const [name, body] of Object.entries(backlog)) {
      fs.writeFileSync(path.join(dir, 'backlog', 'tasks', name), body);
    }
    return dir;
  }

  const task = (id, status, extra = '') =>
    `---\nid: ${id}\nstatus: ${status}\nblocked_reason: "waiting on the payments API"\n${extra}---\n<!-- AC:BEGIN -->\n- [x] #1 a\n<!-- AC:END -->\n`;

  function runUnblock(dir, name) {
    try {
      const stdout = execFileSync(
        process.execPath,
        [path.join(dir, 'scripts', 'gate-qa.mjs'), 'unblock', path.join(dir, 'backlog', 'tasks', name)],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      return { code: 0, stdout };
    } catch (err) {
      if (err.status === undefined) throw err;
      return { code: err.status, stdout: `${err.stdout || ''}${err.stderr || ''}` };
    }
  }

  test('refuses the unblock while a dependency is unfinished', () => {
    const dir = sandboxWith({
      'DONE.md': task('PLAY-001', 'done'),
      'REVW.md': task('PLAY-010', 'review'),
      'ME.md': task('PLAY-500', 'blocked', 'dependencies:\n  - PLAY-010\n'),
    });
    const { code, stdout } = runUnblock(dir, 'ME.md');
    assert.equal(code, 1);
    assert.match(stdout, /UNBLOCK REFUSED/);
    assert.match(stdout, /PLAY-010/);
  });

  test('allows the unblock once the dependency is done', () => {
    const dir = sandboxWith({
      'DONE.md': task('PLAY-001', 'done'),
      'ME.md': task('PLAY-500', 'blocked', 'dependencies:\n  - PLAY-001\n'),
    });
    const { code, stdout } = runUnblock(dir, 'ME.md');
    assert.equal(code, 0);
    assert.match(stdout, /UNBLOCK ALLOWED/);
  });

  test('refuses the unblock when a dependency does not exist', () => {
    const dir = sandboxWith({ 'ME.md': task('PLAY-500', 'blocked', 'dependencies:\n  - PLAY-999\n') });
    const { code, stdout } = runUnblock(dir, 'ME.md');
    assert.equal(code, 1, 'a dangling dependency must not fail open');
    assert.match(stdout, /does not exist/);
  });

  test('does not apply the guard to an item that is not blocked', () => {
    const dir = sandboxWith({
      'REVW.md': task('PLAY-010', 'review'),
      'ME.md': task('PLAY-500', 'review', 'dependencies:\n  - PLAY-010\n'),
    });
    const { code, stdout } = runUnblock(dir, 'ME.md');
    assert.equal(code, 0);
    assert.match(stdout, /T_unblock does not apply/);
    assert.doesNotMatch(stdout, /UNBLOCK ALLOWED/);
  });

  test('refuses the unblock when the backlog declares a colliding id', () => {
    // An impostor that sorts first would otherwise shadow the real dependency
    // and let a genuinely blocked item through.
    const dir = sandboxWith({
      '000-impostor.md': task('PLAY-012', 'done'),
      'PLAY-012.md': task('PLAY-012', 'review'),
      'ME.md': task('PLAY-500', 'blocked', 'dependencies:\n  - PLAY-012\n'),
    });
    const { code, stdout } = runUnblock(dir, 'ME.md');
    assert.equal(code, 1, 'a forged dependency must not clear a block');
    assert.match(stdout, /declared by two files/);
  });

  test('exits 2 when no target is given', () => {
    const dir = sandboxWith({});
    try {
      execFileSync(process.execPath, [path.join(dir, 'scripts', 'gate-qa.mjs'), 'unblock'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      assert.fail('expected a non-zero exit');
    } catch (err) {
      assert.equal(err.status, 2);
    }
  });

  test('the command reports a missing task instead of crashing', () => {
    const dir = sandboxWith({});
    try {
      execFileSync(
        process.execPath,
        [path.join(dir, 'scripts', 'gate-qa.mjs'), 'unblock', path.join(dir, 'nope.md')],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      assert.fail('expected a non-zero exit');
    } catch (err) {
      assert.equal(err.status, 1);
      assert.match(`${err.stdout || ''}`, /no task found/);
    }
  });
  test('refuses to unblock while a dependency is unfinished', () => {
    const { file } = makeTask({ status: 'blocked', dependencies: ['PLAY-007'] });
    const siblings = [['PLAY-007', { file: 'c.md', content: '', frontmatter: { status: 'review' } }]];
    const failures = inspectFile(file, siblings);
    const blockers = failures.filter((f) => f.startsWith('unblock refused'));
    assert.equal(blockers.length, 1, 'the guard must be the thing that reports the blocker');
    assert.match(blockers[0], /must be "done" or unlinked/);
  });

  test('allows the unblock once the dependency is done', () => {
    const { file } = makeTask({ status: 'blocked', extra: 'blocked_reason: "waiting"', dependencies: ['PLAY-001'] });
    const siblings = [['PLAY-001', { file: 'a.md', content: '', frontmatter: { status: 'done' } }]];
    const blockers = inspectFile(file, siblings).filter((f) => f.startsWith('unblock refused'));
    assert.deepEqual(blockers, []);
  });

  test('the guard is not reachable through certification, so it needs its own entry point', () => {
    // A blocked item always fails the T2 status check, so the unblock guard
    // alone cannot change a certification verdict. That is why `gate:unblock`
    // exists; this test documents why the guard is not dead code.
    const { file } = makeTask({ status: 'blocked', dependencies: ['PLAY-007'] });
    const siblings = [['PLAY-007', { file: 'c.md', content: '', frontmatter: { status: 'review' } }]];
    const failures = inspectFile(file, siblings);
    assert.ok(failures.some((f) => /only certifies items in "review"/.test(f)));
    assert.ok(
      failures.some((f) => f.startsWith('unblock refused')),
      'the guard must be reported alongside, as a distinct signal',
    );
  });
});

describe('frontmatter parser (PLAY-015 AC #1)', () => {
  test('returns null for a file with no frontmatter', () => {
    assert.equal(readFrontmatter('# Just a heading\n'), null);
  });

  test('returns null for unclosed frontmatter', () => {
    assert.equal(readFrontmatter('---\nid: PLAY-001\nstatus: draft\n'), null);
  });

  test('parses a scalar field', () => {
    assert.equal(readFrontmatter('---\nid: PLAY-001\nstatus: review\n---\n').status, 'review');
  });

  test('scalar keys are case-insensitive', () => {
    // YAML keys are case-insensitive; a capitalised Status must not become an
    // unknown field that silently leaves `status` undefined.
    assert.equal(readFrontmatter('---\nid: PLAY-001\nStatus: review\n---\n').status, 'review');
  });
});

describe('pyramid resolution', () => {
  test('steps without a script are marked unavailable, never assumed green', () => {
    const steps = resolvePyramid(ROOT);
    const build = steps.find((step) => step.id === 'build');
    assert.equal(build.available, false, 'this package defines no build script, so build must be skipped');
  });

  test('this repo does define the three runnable steps', () => {
    const steps = resolvePyramid(ROOT);
    for (const id of ['validate', 'test', 'audit:ux']) {
      assert.equal(steps.find((step) => step.id === id).available, true, `${id} should be available`);
    }
  });

  test('resolves typecheck as a fallback when validate is absent in a consumer project', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-fallback-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { typecheck: 'tsc --noEmit' } }));
    const validateStep = resolvePyramid(dir).find((step) => step.id === 'validate');
    assert.equal(validateStep.available, true);
    assert.equal(validateStep.script, 'typecheck');
  });
});

describe('gate cli', () => {
  test('exits 2 for a complete task in inspection-only mode', () => {
    const { file } = makeTask();
    const { code, stdout } = runGate([file, '--no-run']);
    assert.equal(code, 2);
    assert.match(stdout, /TASK INSPECTION PASSED/);
  });

  test('exits 1 when an acceptance criterion is unchecked', () => {
    const { file } = makeTask({ acs: ['- [x] #1 ok', '- [ ] #2 open'] });
    const { code, stdout } = runGate([file, '--no-run']);
    assert.equal(code, 1);
    assert.match(stdout, /GATE FAILED/);
    assert.match(stdout, /has no effect/);
  });

  test('exits 1 when the task file does not exist', () => {
    const { code, stdout } = runGate(['PLAY-NOPE', '--no-run']);
    assert.equal(code, 1);
    assert.match(stdout, /no task found/);
  });

  test('exits 2 when no target is given', () => {
    const { code, stdout } = runGate(['--no-run']);
    assert.equal(code, 2);
    assert.match(stdout, /usage:/);
  });

  test('a pyramid where nothing ran fails instead of passing', () => {
    // Replica whose package.json defines none of the four verification scripts.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-norun-'));
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    fs.copyFileSync(GATE, path.join(dir, 'scripts', 'gate-qa.mjs'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"repro","scripts":{}}');

    const { file } = makeTask({ id: 'QA-TMP-001' });
    let result;
    try {
      const stdout = execFileSync(process.execPath, [path.join(dir, 'scripts', 'gate-qa.mjs'), file], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      result = { code: 0, stdout };
    } catch (err) {
      if (err.status === undefined) throw err;
      result = { code: err.status, stdout: `${err.stdout || ''}${err.stderr || ''}` };
    }

    assert.match(result.stdout, /SKIPPED/, 'the runner must report unavailable steps');
    assert.notEqual(result.code, 0, 'zero executed steps must not certify an item');
  });

  test('inspection-only mode never certifies', () => {
    const { file } = makeTask();
    const { code, stdout } = runGate([file, '--no-run']);
    assert.equal(code, 2, 'inspection-only must exit 2, never 0');
    assert.match(stdout, /NOT a certification/);
    assert.doesNotMatch(stdout, /may be promoted/);
  });
});

describe('dismissed invariant', () => {
  test('rejects status dismissed without a dismissed_reason', () => {
    const { file } = makeTask({ status: 'dismissed' });
    assert.ok(
      inspectFile(file).some((f) => /dismissed_reason is missing or empty/.test(f)),
      'a dismissal without a reason is indistinguishable from an item someone forgot about',
    );
  });

  test('rejects a whitespace-only dismissed_reason', () => {
    const { file } = makeTask({ status: 'dismissed', extra: 'dismissed_reason: "   "' });
    assert.ok(inspectFile(file).some((f) => /dismissed_reason is missing or empty/.test(f)));
  });

  test('accepts status dismissed with a reason', () => {
    const { file } = makeTask({ status: 'dismissed', extra: 'dismissed_reason: "la premisa era falsa"' });
    assert.ok(inspectFile(file).every((f) => !/dismissed_reason/.test(f)));
  });

  test('rejects a dismissed_reason on an item that is not dismissed', () => {
    const { file } = makeTask({ status: 'review', extra: 'dismissed_reason: "stale field"' });
    assert.match(inspectFile(file)[0], /dismissed_reason is set but status is not "dismissed"/);
  });
});

describe('blocking steps (PLAY-015 AC #1)', () => {
  function sandboxWithScripts(scripts) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-block-'));
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'backlog', 'tasks'), { recursive: true });
    fs.copyFileSync(GATE, path.join(dir, 'scripts', 'gate-qa.mjs'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'repro', scripts }));
    fs.writeFileSync(
      path.join(dir, 'backlog', 'tasks', 'T.md'),
      '---\nid: QA-TMP-1\nstatus: review\ndependencies: []\n---\n<!-- AC:BEGIN -->\n- [x] #1 a\n<!-- AC:END -->\n',
    );
    return dir;
  }

  function runFull(dir) {
    try {
      const stdout = execFileSync(
        process.execPath,
        [path.join(dir, 'scripts', 'gate-qa.mjs'), path.join(dir, 'backlog', 'tasks', 'T.md')],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      return { code: 0, stdout };
    } catch (err) {
      if (err.status === undefined) throw err;
      return { code: err.status, stdout: `${err.stdout || ''}${err.stderr || ''}` };
    }
  }

  test('a blocking step with no script fails the gate instead of being skipped', () => {
    // The defect this closes: a pyramid where only `validate` ran certified with
    // exit 0 while every other declared-blocking step was SKIPPED.
    const dir = sandboxWithScripts({ validate: 'node -e "process.exit(0)"' });
    const { code, stdout } = runFull(dir);
    assert.notEqual(code, 0, 'certifying on steps that never ran is the failure this gate exists to prevent');
    assert.match(stdout, /blocking step has no "test" script/);
    assert.match(stdout, /blocking step has no "gate:review" script/);
    assert.match(stdout, /blocking step has no "audit:ux:strict" script/);
  });

  test('an optional step with no script is skipped and does not block', () => {
    // `build` is declared optional with its reason inline: this package ships
    // documentation and a Node CLI, there is no bundle to build.
    const dir = sandboxWithScripts({
      validate: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"',
      'gate:review': 'node -e "process.exit(0)"',
      'audit:ux:strict': 'node -e "process.exit(0)"',
    });
    const { code, stdout } = runFull(dir);
    assert.equal(code, 0, 'every blocking step ran');
    assert.match(stdout, /Production build: SKIPPED \(not applicable/);
  });
});

describe('real backlog', () => {
  test('every task on disk parses and exposes an id', () => {
    const { tasks } = loadTasks();
    assert.ok(tasks.size >= 12, `expected the full backlog, found ${tasks.size}`);
  });

  test('no two files declare the same task id', () => {
    // Deduping a Map's keys can never fail: assert the collision detector
    // directly against a purpose-built directory instead.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-dupid-'));
    const dup = makeTask({ id: 'PLAY-900', status: 'done' });
    fs.copyFileSync(dup.file, path.join(dir, 'PLAY-900.md'));
    fs.copyFileSync(dup.file, path.join(dir, 'zz-impostor.md'));

    const { collisions } = loadTasks(dir);
    assert.equal(collisions.length, 1, 'a duplicate id must be detected');
    assert.equal(collisions[0].id, 'PLAY-900');
    assert.ok(collisions[0].files.includes('zz-impostor.md'));
  });

  test('the shipped backlog has no id collisions', () => {
    assert.deepEqual(loadTasks().collisions, []);
  });

  test('every task in review has all its criteria checked', () => {
    const { tasks } = loadTasks();
    for (const [id, task] of tasks) {
      if (task.frontmatter.status !== 'review') continue;
      assert.deepEqual(inspectTask(task, tasks), [], `${id} is in review but is not gate-ready`);
    }
  });
});

describe('mechanical state transitions (T0, T1, T2, T_unblock)', () => {
  test('rejects an invalid priority value in inspectTask', () => {
    const { file } = makeTask();
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('priority: high', 'priority: urgent'));
    const failures = inspectFile(file);
    assert.ok(failures.some((f) => /invalid priority "urgent"/.test(f)));
  });

  test('mutateTaskFrontmatter updates status, removes keys, and sets new keys', () => {
    const raw = '---\nid: PLAY-900\nstatus: blocked\nblocked_reason: "waiting"\n---\nBody\n';
    const next = mutateTaskFrontmatter(raw, {
      status: 'doing',
      remove: ['blocked_reason'],
      set: { claimed_by: 'antigravity:test-1' },
    });
    const fm = readFrontmatter(next);
    assert.equal(fm.status, 'doing');
    assert.equal(fm.blocked_reason, undefined);
    assert.equal(fm.claimed_by, 'antigravity:test-1');
  });

  test('start (T0) moves a draft task to doing on disk and sets claimed_by', () => {
    const { file } = makeTask({ status: 'draft' });
    const { code, stdout } = runGate(['start', file, '--by', 'antigravity:dev-1']);
    assert.equal(code, 0);
    assert.match(stdout, /START ALLOWED/);
    const fm = readFrontmatter(fs.readFileSync(file, 'utf8'));
    assert.equal(fm.status, 'doing');
    assert.equal(fm.claimed_by, 'antigravity:dev-1');
  });

  test('submit (T1) moves a doing task with checked ACs to review on disk', () => {
    const { file } = makeTask({ status: 'doing', acs: ['- [x] #1 done', '- [x] #2 done'] });
    const { code, stdout } = runGate(['submit', file]);
    assert.equal(code, 0);
    assert.match(stdout, /SUBMIT ALLOWED/);
    const fm = readFrontmatter(fs.readFileSync(file, 'utf8'));
    assert.equal(fm.status, 'review');
  });

  test('submit (T1) refuses to move a doing task when an AC is unchecked', () => {
    const { file } = makeTask({ status: 'doing', acs: ['- [x] #1 done', '- [ ] #2 open'] });
    const { code, stdout } = runGate(['submit', file]);
    assert.equal(code, 1);
    assert.match(stdout, /SUBMIT REFUSED/);
    const fm = readFrontmatter(fs.readFileSync(file, 'utf8'));
    assert.equal(fm.status, 'doing');
  });

  test('unblock (T_unblock) mutates status to doing and removes blocked_reason on disk', () => {
    const { file } = makeTask({ status: 'blocked', extra: 'blocked_reason: "waiting on API"' });
    const { code, stdout } = runGate(['unblock', file]);
    assert.equal(code, 0);
    assert.match(stdout, /UNBLOCK ALLOWED/);
    const fm = readFrontmatter(fs.readFileSync(file, 'utf8'));
    assert.equal(fm.status, 'doing');
    assert.equal(fm.blocked_reason, undefined);
  });

  test('full gate certification (T2) mutates status to ready on disk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-promote-'));
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'backlog', 'tasks'), { recursive: true });
    fs.copyFileSync(GATE, path.join(dir, 'scripts', 'gate-qa.mjs'));
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'repro',
        scripts: {
          validate: 'node -e "process.exit(0)"',
          test: 'node -e "process.exit(0)"',
          'gate:review': 'node -e "process.exit(0)"',
          'audit:ux:strict': 'node -e "process.exit(0)"',
        },
      }),
    );
    const taskFile = path.join(dir, 'backlog', 'tasks', 'T.md');
    fs.writeFileSync(
      taskFile,
      '---\nid: QA-TMP-2\nstatus: review\ndependencies: []\npriority: high\n---\n<!-- AC:BEGIN -->\n- [x] #1 a\n<!-- AC:END -->\n',
    );

    const stdout = execFileSync(process.execPath, [path.join(dir, 'scripts', 'gate-qa.mjs'), taskFile], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.match(stdout, /GATE PASSED/);
    assert.equal(readFrontmatter(fs.readFileSync(taskFile, 'utf8')).status, 'ready');
  });
});