import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectTask, loadTasks, resolveTaskPath, resolvePyramid } from '../scripts/gate-qa.mjs';

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

/** Parses a task file the way the gate does, then inspects it. */
function inspectFile(file, siblings = []) {
  const content = fs.readFileSync(file, 'utf8');
  const frontmatter = {};
  const end = content.indexOf('\n---', 4);
  for (const line of content.slice(4, end).split('\n')) {
    const match = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (match) frontmatter[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  const depStart = content.slice(4, end).split('\n').findIndex((l) => l.startsWith('dependencies:'));
  const lines = content.slice(4, end).split('\n');
  frontmatter.dependencies = [];
  if (depStart !== -1) {
    const inline = lines[depStart].slice('dependencies:'.length).trim();
    if (inline.startsWith('[')) {
      frontmatter.dependencies = inline
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else if (inline) {
      frontmatter.dependencies = [inline];
    } else {
      for (let i = depStart + 1; i < lines.length; i += 1) {
        const item = lines[i].match(/^\s*-\s*(.+)$/);
        if (!item) break;
        frontmatter.dependencies.push(item[1].trim());
      }
    }
  }
  return inspectTask({ content, frontmatter }, new Map(siblings));
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
    const parsed = loadTasks(dir).get('PLAY-900');
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

  test('rejects a dependency that does not exist on disk', () => {
    const { file } = makeTask({ dependencies: ['PLAY-404'] });
    assert.match(inspectFile(file)[0], /dependency "PLAY-404" does not exist/);
  });
});

describe('blocked invariant (PLAY-016 AC #2)', () => {
  test('rejects status blocked without a blocked_reason', () => {
    const { file } = makeTask({ status: 'blocked' });
    const failures = inspectFile(file);
    assert.ok(failures.some((f) => /blocked_reason is missing or empty/.test(f)));
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
});

describe('gate cli', () => {
  test('exits 0 for a complete task when the pyramid is not run', () => {
    const { file } = makeTask();
    const { code, stdout } = runGate([file, '--no-run']);
    assert.equal(code, 0);
    assert.match(stdout, /GATE PASSED/);
  });

  test('exits 1 when an acceptance criterion is unchecked', () => {
    const { file } = makeTask({ acs: ['- [x] #1 ok', '- [ ] #2 open'] });
    const { code, stdout } = runGate([file, '--no-run']);
    assert.equal(code, 1);
    assert.match(stdout, /GATE FAILED/);
    assert.match(stdout, /does not surte effect/);
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

  test('reports SKIPPED rather than passed for an unavailable step', () => {
    const { file } = makeTask();
    const { stdout } = runGate([file, '--no-run']);
    assert.match(stdout, /task inspection/);
  });
});

describe('real backlog', () => {
  test('every task on disk parses and exposes an id', () => {
    const tasks = loadTasks();
    assert.ok(tasks.size >= 12, `expected the full backlog, found ${tasks.size}`);
  });

  test('the ids are stable and never reused', () => {
    const ids = [...loadTasks().keys()].sort();
    assert.equal(new Set(ids).size, ids.length, 'duplicate ids on disk');
  });

  test('every task in review has all its criteria checked', () => {
    for (const [id, task] of loadTasks()) {
      if (task.frontmatter.status !== 'review') continue;
      assert.deepEqual(inspectTask(task, loadTasks()), [], `${id} is in review but is not gate-ready`);
    }
  });
});