#!/usr/bin/env node

/**
 * scripts/gate-qa.mjs
 *
 * Executable QA gate (PLAY-015). Replaces prose-only certification with a
 * mechanical gate that must return exit code 0 before an item may be promoted
 * from `review` to `ready`.
 *
 * The problem this exists to solve: a single agent asked to "act as the QA
 * Auditor" can simulate the role in the same turn that it writes the code. ACs
 * get ticked by inertia and the item gets promoted on discourse alone. A gate
 * that only exists as a paragraph is not a gate.
 *
 * Two independent halves:
 *   1. Task inspection  — the item on disk is real, complete, in `review`, and
 *                         its declared dependencies are already `done`.
 *   2. Pyramid execution — the repo's own verification steps actually run and
 *                         actually pass.
 *
 * A step that cannot run is reported SKIPPED and never counted as a pass.
 *
 * Exit codes: 0 gate passed · 1 gate failed · 2 fatal (bad usage)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TASKS_DIR = path.join(ROOT, 'backlog', 'tasks');

/** Statuses the state machine allows to be gated. Anything else is a usage error. */
const GATEABLE_STATUS = 'review';

// --- task parsing ------------------------------------------------------------

/**
 * Minimal frontmatter reader. The backlog format is flat YAML; a full YAML
 * parser would be a dependency for a dozen fields.
 */
function readFrontmatter(content) {
  // Normalize line endings first: a CRLF checkout (Windows, git autocrlf) must
  // parse identically to an LF one.
  const text = content.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;

  const body = text.slice(4, end);
  const data = {};

  for (const line of body.split('\n')) {
    const match = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!match) continue;
    data[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }

  // `dependencies:` is a YAML list, not a scalar. Collect the indented items.
  data.dependencies = collectList(body, 'dependencies');

  return data;
}

function collectList(body, key) {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
  if (start === -1) return [];

  const inline = lines[start].slice(key.length + 1).trim();
  if (inline.startsWith('[')) {
    return inline
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  if (inline) return [inline];

  const items = [];
  for (let i = start + 1; i < lines.length; i++) {
    const item = lines[i].match(/^\s*-\s*(.+)$/);
    if (!item) break;
    items.push(item[1].trim().replace(/^['"]|['"]$/g, ''));
  }
  return items;
}

/** Extracts the acceptance criteria lines between the AC markers. */
function readACs(content) {
  const text = content.replace(/\r\n/g, '\n');
  const start = text.indexOf('<!-- AC:BEGIN -->');
  const end = text.indexOf('<!-- AC:END -->');
  if (start === -1 || end === -1 || end < start) return null;

  return text
    .slice(start + '<!-- AC:BEGIN -->'.length, end)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ['));
}

/** Every task file on disk, keyed by its backlog id. */
export function loadTasks(tasksDir = TASKS_DIR) {
  const tasks = new Map();
  if (!fs.existsSync(tasksDir)) return tasks;

  for (const entry of fs.readdirSync(tasksDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const full = path.join(tasksDir, entry.name);
    const content = fs.readFileSync(full, 'utf8');
    const frontmatter = readFrontmatter(content);
    if (!frontmatter || !frontmatter.id) continue;
    tasks.set(frontmatter.id, { file: entry.name, content, frontmatter });
  }

  return tasks;
}

/** Resolves a task id or a path to an absolute task file path. */
export function resolveTaskPath(target, tasksDir = TASKS_DIR) {
  if (!fs.existsSync(target)) {
    const direct = path.join(tasksDir, target);
    if (fs.existsSync(direct)) return direct;

    const tasks = loadTasks(tasksDir);
    const match = tasks.get(target);
    if (match) return path.join(tasksDir, match.file);

    return null;
  }
  return path.resolve(target);
}

// --- gate inspection ---------------------------------------------------------

/**
 * Inspects the task on disk. Pure: takes the parsed task plus the task map so
 * it can be exercised in tests without touching the filesystem.
 */
export function inspectTask(task, tasks) {
  const failures = [];
  const { frontmatter, content } = task;

  if (!frontmatter) {
    failures.push('the file has no closed YAML frontmatter');
    return failures;
  }

  if (frontmatter.status !== GATEABLE_STATUS) {
    failures.push(
      `status is "${frontmatter.status ?? '(missing)'}" but the T2 gate only certifies items in "${GATEABLE_STATUS}"`,
    );
  }

  const acs = readACs(content);
  if (acs === null) {
    failures.push('no <!-- AC:BEGIN --> / <!-- AC:END --> block, so acceptance criteria are unreadable');
  } else if (acs.length === 0) {
    failures.push('the acceptance criteria block is empty');
  } else {
    const open = acs.filter((line) => !line.startsWith('- [x]'));
    if (open.length) {
      failures.push(`${open.length} of ${acs.length} acceptance criteria are still unchecked:\n      ${open.join('\n      ')}`);
    }
  }

  // PLAY-016: blocked_reason is not optional, and it only means something while blocked.
  if (frontmatter.status === 'blocked') {
    if (!frontmatter.blocked_reason) {
      failures.push('status is "blocked" but blocked_reason is missing or empty');
    }
  } else if (frontmatter.blocked_reason) {
    failures.push('blocked_reason is set but status is not "blocked"');
  }

  // PLAY-016: dependencies gate. An item cannot be certified on top of an
  // unfinished dependency.
  for (const dep of frontmatter.dependencies || []) {
    const resolved = tasks.get(dep);
    if (!resolved) {
      failures.push(`dependency "${dep}" does not exist in backlog/tasks/`);
      continue;
    }
    if (resolved.frontmatter.status !== 'done') {
      failures.push(
        `dependency "${dep}" is "${resolved.frontmatter.status ?? '(missing)'}" (${resolved.file}) but must be "done"`,
      );
    }
  }

  return failures;
}

// --- pyramid execution -------------------------------------------------------

function readScripts(root = ROOT) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts || {};
  } catch {
    return {};
  }
}

/**
 * Resolves the repo's verification steps. Each step is looked up in package.json
 * first: a step with no script behind it is SKIPPED, never assumed green.
 */
export function resolvePyramid(root = ROOT) {
  const scripts = readScripts(root);
  const has = (name) => Boolean(scripts[name]);

  return [
    { id: 'validate', label: 'Repo consistency', script: 'validate' },
    { id: 'test', label: 'Headless tests', script: 'test' },
    { id: 'audit:ux', label: 'Static UX audit', script: 'audit:ux:strict' },
    { id: 'build', label: 'Production build', script: 'build' },
  ].map((step) => ({ ...step, available: has(step.script) }));
}

function runStep(step, root) {
  if (!step.available) return { state: 'skipped', detail: `no "${step.script}" script in package.json` };

  const result = spawnSync('npm', ['run', '--silent', step.script], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 10 * 60 * 1000,
  });

  if (result.error) {
    return { state: 'failed', detail: result.error.message };
  }
  if (result.status !== 0) {
    const tail = `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n').slice(-4).join('\n      ');
    return { state: 'failed', detail: `exit code ${result.status}${tail ? `\n      ${tail}` : ''}` };
  }
  return { state: 'passed', detail: '' };
}

// --- reporting ---------------------------------------------------------------

function printHeader(title) {
  console.log('');
  console.log('=====================================================');
  console.log(title);
  console.log('=====================================================');
}

export function main(argv) {
  const target = argv.find((arg) => !arg.startsWith('--'));
  if (!target) {
    printHeader('QA Gate');
    console.log('usage: node scripts/gate-qa.mjs <PLAY-NNN | path/to/task.md> [--no-run]');
    console.log('');
    process.exit(2);
  }

  const runPyramid = !argv.includes('--no-run');

  printHeader('QA Gate · PLAY-015');
  console.log('');

  const taskPath = resolveTaskPath(target);
  if (!taskPath) {
    console.log(`❌ no task found for "${target}" in backlog/tasks/`);
    console.log('');
    process.exit(1);
  }

  const content = fs.readFileSync(taskPath, 'utf8');
  const frontmatter = readFrontmatter(content);
  console.log(`task:    ${path.relative(ROOT, taskPath)}`);
  console.log(`id:      ${frontmatter?.id ?? '(unreadable)'}`);
  console.log(`status:  ${frontmatter?.status ?? '(missing)'}`);
  console.log('');

  const tasks = loadTasks();
  const failures = inspectTask({ content, frontmatter }, tasks);

  console.log('--- task inspection ---');
  if (failures.length) {
    for (const failure of failures) console.log(`  ❌ ${failure}`);
  } else {
    console.log('  ✅ acceptance criteria complete, status and dependencies are valid');
  }
  console.log('');

  let pyramidFailed = false;
  let pyramidRan = 0;

  if (runPyramid) {
    const steps = resolvePyramid();
    console.log('--- verification pyramid ---');
    for (const step of steps) {
      const outcome = runStep(step, ROOT);
      if (outcome.state === 'skipped') {
        console.log(`  – ${step.label}: SKIPPED (${outcome.detail})`);
        continue;
      }
      pyramidRan += 1;
      if (outcome.state === 'passed') {
        console.log(`  ✅ ${step.label}`);
      } else {
        pyramidFailed = true;
        console.log(`  ❌ ${step.label}: ${outcome.detail}`);
      }
    }
    if (!pyramidRan) console.log('  – nothing to run: the project defines no verification scripts.');
    console.log('');
  }

  const ok = failures.length === 0 && !pyramidFailed;

  console.log('-----------------------------------------------------');
  if (ok) {
    console.log(`✅ GATE PASSED — ${frontmatter.id} may be promoted review → ready.`);
    console.log('-----------------------------------------------------');
    console.log('');
    process.exit(0);
  }

  console.log('❌ GATE FAILED — promotion to "ready" does not surte effect.');
  if (runPyramid && !pyramidRan) {
    console.log('   No verification step could run, so the gate cannot certify anything.');
  }
  console.log('-----------------------------------------------------');
  console.log('');
  process.exit(1);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main(process.argv.slice(2));