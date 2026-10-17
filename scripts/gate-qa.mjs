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
 *   1. Task inspection  - the item on disk is real, complete, in `review`, and
 *                         its declared dependencies are already `done`.
 *   2. Pyramid execution - the repo's own verification steps actually run and
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
export function readFrontmatter(content) {
  // Normalize line endings first: a CRLF checkout (Windows, git autocrlf) must
  // parse identically to an LF one.
  const text = content.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;

  const body = text.slice(4, end);
  const data = {};
  const seen = new Set();

  for (const line of body.split('\n')) {
    const match = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!match) continue;
    // Keys are case-insensitive in YAML. A `Dependencies:` or `dependencies :`
    // spelling must not silently void the dependency gate.
    const key = match[1].toLowerCase();
    if (seen.has(key)) data.__duplicateKeys = [...(data.__duplicateKeys || []), key];
    else seen.add(key);
    data[key] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }

  // `dependencies:` is a YAML list, not a scalar. Collect the indented items.
  data.dependencies = collectList(body, 'dependencies');

  // A `dependencies` key off column 0 is nested under another key. An ambiguous
  // document must fail closed rather than certify itself as dependency-free.
  if (/^[\t ]+dependencies\s*:/im.test(body)) data.__nestedDependencies = true;

  return data;
}

function collectList(body, key) {
  const lines = body.split('\n');
  const pattern = new RegExp(`^${key}\\s*:`, 'i');
  // `Dependencies:` and `dependencies :` must both resolve. A spelling that
  // silently yields [] would void the dependency gate entirely.
  const matches = [];
  lines.forEach((line, index) => {
    if (pattern.test(line)) matches.push(index);
  });
  // Two top-level declarations are ambiguous. Taking the first would let a bare
  // `dependencies: []` shadow a real list, so report nothing and let the caller
  // reject the duplicate instead of certifying a false clean.
  if (matches.length !== 1) return [];

  const start = matches[0];

  const colonAt = lines[start].indexOf(':');
  const inline = lines[start].slice(colonAt + 1).trim();
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
  const collisions = [];
  if (!fs.existsSync(tasksDir)) return { tasks, collisions };

  for (const entry of fs.readdirSync(tasksDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const full = path.join(tasksDir, entry.name);
    // An unreadable task file must not crash the runner: skip it loudly rather
    // than throwing a stack trace at the auditor.
    let content;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      collisions.push({ id: entry.name, files: [entry.name, '(unreadable)'] });
      continue;
    }
    const frontmatter = readFrontmatter(content);
    if (!frontmatter || !frontmatter.id) continue;

    // Two files claiming the same id make task identity forgeable: an item
    // could certify against a fabricated dependency. Record the collision
    // instead of silently letting the last file win.
    const id = frontmatter.id;
    if (tasks.has(id)) {
      collisions.push({ id, files: [tasks.get(id).file, entry.name] });
      continue;
    }
    tasks.set(id, { file: entry.name, content, frontmatter });
  }

  return { tasks, collisions };
}

/** Resolves a task id or a path to an absolute task file path. */
export function resolveTaskPath(target, tasksDir = TASKS_DIR) {
  if (!fs.existsSync(target)) {
    const direct = path.join(tasksDir, target);
    if (fs.existsSync(direct)) return direct;

    const match = loadTasks(tasksDir).tasks.get(target);
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

  // Ambiguous documents fail closed. A duplicate or nested `dependencies` key
  // must never certify itself as dependency-free.
  if (frontmatter.__duplicateKeys) {
    failures.push(
      `duplicate frontmatter key(s): ${[...new Set(frontmatter.__duplicateKeys)].join(', ')}. An ambiguous document cannot be certified`,
    );
  }
  if (frontmatter.__nestedDependencies) {
    failures.push('"dependencies" is nested under another key; it must be a top-level entry. An ambiguous document cannot be certified');
  }

  if (frontmatter.status !== GATEABLE_STATUS) {
    failures.push(
      `status is "${frontmatter.status ?? '(missing)'}" but the T2 gate only certifies items in "${GATEABLE_STATUS}"`,
    );
  }

  // An unidentifiable item cannot be released: Release Management groups items
  // by id, and the changelog cites it. No id, no certification. Whitespace is
  // not an id, for the same reason it is not a blocked_reason.
  if (!frontmatter.id || !frontmatter.id.trim()) {
    failures.push('the frontmatter declares no "id"; an unidentifiable item cannot be certified');
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
    // A whitespace-only reason is not a reason: it documents nothing.
    if (!frontmatter.blocked_reason || !frontmatter.blocked_reason.trim()) {
      failures.push('status is "blocked" but blocked_reason is missing or empty');
    }
  } else if (frontmatter.blocked_reason) {
    failures.push('blocked_reason is set but status is not "blocked"');
  }

  // dismissed is a decision that the item will not exist. Without a written
  // reason it is indistinguishable from an item someone forgot about.
  if (frontmatter.status === 'dismissed') {
    if (!frontmatter.dismissed_reason || !frontmatter.dismissed_reason.trim()) {
      failures.push('status is "dismissed" but dismissed_reason is missing or empty');
    }
  } else if (frontmatter.dismissed_reason) {
    failures.push('dismissed_reason is set but status is not "dismissed"');
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

  // PLAY-016 AC #4: the T_unblock guard, as an executable rule rather than prose.
  //
  // T2 certification only ever sees a `review` item, so this cannot be folded
  // into the certification check. It is a transition guard, evaluated by
  // `gate:unblock`, which is what gives it teeth: it reports whether a blocked
  // item may legally move to `doing`/`draft`.
  if (frontmatter.status === 'blocked') {
    for (const dep of frontmatter.dependencies || []) {
      const resolved = tasks.get(dep);
      // A dependency that is not on disk is neither "done" nor unlinked: it is
      // still declared in the array and cannot be resolved. Allowing the unblock
      // here would fail open on the least-resolved case, contradicting both the
      // T2 path and STATE_MACHINE's T_unblock guard.
      if (!resolved) {
        failures.push(
          `unblock refused: dependency "${dep}" does not exist in backlog/tasks/; remove it from the array to unlink it`,
        );
        continue;
      }
      const depStatus = resolved.frontmatter.status;
      if (depStatus !== 'done') {
        failures.push(
          `unblock refused: dependency "${dep}" is "${depStatus ?? '(missing)'}"; it must be "done" or unlinked`,
        );
      }
    }
  }

  return failures;
}

const isColorSupported =
  !('NO_COLOR' in process.env) &&
  (process.env.FORCE_COLOR === '1' || (process.stdout?.isTTY && process.env.TERM !== 'dumb'));

const c = {
  bold: (s) => (isColorSupported ? `\x1b[1m${s}\x1b[22m` : s),
  dim: (s) => (isColorSupported ? `\x1b[2m${s}\x1b[22m` : s),
  cyan: (s) => (isColorSupported ? `\x1b[36m${s}\x1b[39m` : s),
  green: (s) => (isColorSupported ? `\x1b[32m${s}\x1b[39m` : s),
  yellow: (s) => (isColorSupported ? `\x1b[33m${s}\x1b[39m` : s),
  red: (s) => (isColorSupported ? `\x1b[31m${s}\x1b[39m` : s),
};

function printHeader(title) {
  console.log(`\n  ${c.bold('gripm')} ${c.dim('·')} ${title}\n`);
}

export function unblockMain(argv) {
  const target = argv.find((arg) => !arg.startsWith('--'));
  if (!target) {
    printHeader('QA Gate · unblock');
    console.log('usage: node scripts/gate-qa.mjs unblock <TASK-ID | path/to/task.md>\n');
    process.exit(2);
  }

  printHeader('QA Gate · unblock (T_unblock)');

  const taskPath = resolveTaskPath(target);
  if (!taskPath) {
    console.log(`  ${c.red('✖')} no task found for "${target}" in backlog/tasks/\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(taskPath, 'utf8');
  const frontmatter = readFrontmatter(content);
  console.log(`  ${c.dim('➜')} Task:    ${path.relative(ROOT, taskPath)}`);
  console.log(`    ID:      ${c.bold(frontmatter?.id ?? '(unreadable)')}`);
  console.log(`    Status:  ${frontmatter?.status ?? '(missing)'}\n`);

  if (frontmatter?.status !== 'blocked') {
    console.log(`  ${c.dim('ℹ')} this item is "${frontmatter?.status ?? '(missing)'}", not "blocked"; T_unblock does not apply.\n`);
    process.exit(0);
  }

  const { tasks, collisions } = loadTasks();
  const blockers = inspectTask({ content, frontmatter }, tasks).filter((f) => f.startsWith('unblock refused'));

  for (const collision of collisions) {
    blockers.push(`task id "${collision.id}" is declared by two files: ${collision.files.join(' and ')}`);
  }

  if (blockers.length) {
    console.log(`  ${c.bold('T_unblock guard:')}`);
    for (const blocker of blockers) console.log(`    ${c.red('✖')} ${blocker}`);
    console.log(`\n  ${c.red('✖')} UNBLOCK REFUSED - this item must stay blocked.\n`);
    process.exit(1);
  }

  console.log(`  ${c.bold('T_unblock guard:')}`);
  console.log(`    ${c.green('✔')} every dependency is done or unlinked`);
  console.log(`\n  ${c.green('✔')} UNBLOCK ALLOWED - ${frontmatter.id} may move blocked → doing.\n`);
  process.exit(0);
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
 * The verification steps the gate can execute.
 *
 * `blocking` distinguishes "this step must pass" from "this step must run".
 * A blocking step with no script behind it is a FAILED gate, not a skipped one:
 * certifying on a step that never ran is exactly the assumption the gate exists
 * to refuse. `optional: true` is the honest way to say "this project has no such
 * step" - and it must be deliberate, never a default.
 *
 * The set is compared against the pyramid the QA skill documents by
 * `scripts/validate-repo.mjs`, so the two cannot drift apart silently.
 */
const PYRAMID_STEPS = [
  { id: 'validate', label: 'Repo consistency', script: 'validate', blocking: true },
  { id: 'test', label: 'Headless tests', script: 'test', blocking: true },
  { id: 'spec', label: 'Spec ↔ backlog consistency', script: 'gate:review', blocking: true },
  { id: 'audit:ux', label: 'Static UX audit', script: 'audit:ux:strict', blocking: true },
  // This package ships documentation and a Node CLI; there is no production
  // bundle to build. Declared optional deliberately, with the reason inline.
  { id: 'build', label: 'Production build', script: 'build', blocking: false, optional: true },
];

/** The steps a gate run actually covers, in order. */
export function resolvePyramid(root = ROOT) {
  const scripts = readScripts(root);
  const has = (name) => Boolean(scripts[name]);
  return PYRAMID_STEPS.map((step) => ({ ...step, available: has(step.script) }));
}

function runStep(step, root) {
  if (!step.available) {
    // An unavailable BLOCKING step is a failure: it was declared as something
    // that must pass before promotion, and it did not pass because it never ran.
    // Optional steps are the only ones allowed to be genuinely skipped.
    return step.optional
      ? { state: 'skipped', detail: `not applicable to this project (no "${step.script}" script)` }
      : {
          state: 'failed',
          detail: `blocking step has no "${step.script}" script in package.json; it cannot be certified on a step that never ran`,
        };
  }

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

export function main(argv) {
  const target = argv.find((arg) => !arg.startsWith('--'));
  if (!target) {
    printHeader('QA Gate');
    console.log('usage: node scripts/gate-qa.mjs <TASK-ID | path/to/task.md> [--no-run]\n');
    console.log('  default     runs the pyramid and certifies (exit 0 = may promote)');
    console.log('  --no-run    inspection only, exits 2: never certifies\n');
    process.exit(2);
  }

  const runPyramid = !argv.includes('--no-run');

  printHeader('QA Gate');

  const taskPath = resolveTaskPath(target);
  if (!taskPath) {
    console.log(`  ${c.red('✖')} no task found for "${target}" in backlog/tasks/\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(taskPath, 'utf8');
  const frontmatter = readFrontmatter(content);
  console.log(`  ${c.dim('➜')} Task:    ${path.relative(ROOT, taskPath)}`);
  console.log(`    ID:      ${c.bold(frontmatter?.id ?? '(unreadable)')}`);
  console.log(`    Status:  ${frontmatter?.status ?? '(missing)'}\n`);

  const { tasks, collisions } = loadTasks();
  const failures = inspectTask({ content, frontmatter }, tasks);

  // A duplicate id makes dependency resolution forgeable, so it is fatal to
  // certification regardless of this item's own state.
  for (const collision of collisions) {
    failures.push(`task id "${collision.id}" is declared by two files: ${collision.files.join(' and ')}. Task identity must be unique`);
  }

  console.log(`  ${c.bold('Task inspection:')}`);
  if (failures.length) {
    for (const failure of failures) console.log(`    ${c.red('✖')} ${failure}`);
  } else {
    console.log(`    ${c.green('✔')} acceptance criteria complete, status and dependencies are valid`);
  }
  console.log('');

  let pyramidFailed = false;
  let pyramidRan = 0;

  if (runPyramid) {
    const steps = resolvePyramid();
    console.log(`  ${c.bold('Verification pyramid:')}`);
    for (const step of steps) {
      const outcome = runStep(step, ROOT);
      if (outcome.state === 'skipped') {
        console.log(`    ${c.dim('•')} ${step.label}: SKIPPED (${outcome.detail})`);
        continue;
      }
      pyramidRan += 1;
      if (outcome.state === 'passed') {
        console.log(`    ${c.green('✔')} ${step.label}`);
      } else {
        pyramidFailed = true;
        console.log(`    ${c.red('✖')} ${step.label}: ${outcome.detail}`);
      }
    }
    if (!pyramidRan) console.log(`    ${c.dim('•')} nothing to run: the project defines no verification scripts.`);
    console.log('');
  }

  // A pyramid where nothing ran has verified nothing. Zero executed steps is a
  // failure, not a pass: certification on an unexecuted gate is the exact
  // theatre this runner exists to prevent.
  const nothingVerified = runPyramid && pyramidRan === 0;
  const ok = failures.length === 0 && !pyramidFailed && !nothingVerified;

  if (ok && !runPyramid) {
    console.log(`  ${c.yellow('▲')} TASK INSPECTION PASSED - ${frontmatter.id} satisfies the task checks.`);
    console.log(`    ${c.dim('NOT a certification: the pyramid did not run. Re-run without --no-run.')}\n`);
    process.exit(2);
  }

  if (ok) {
    console.log(`  ${c.green('✔')} GATE PASSED - ${frontmatter.id} may be promoted review → ready.\n`);
    process.exit(0);
  }

  console.log(`  ${c.red('✖')} GATE FAILED - promotion to "ready" has no effect.`);
  if (nothingVerified) {
    console.log(`    ${c.dim('No verification step could run, so the gate cannot certify anything.')}`);
  }
  console.log('');
  process.exit(1);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  // `unblock` is a separate entry point so the T_unblock guard is evaluated as
  // a real transition rather than appended to an already-failing list.
  if (args[0] === 'unblock') unblockMain(args.slice(1));
  else main(args);
}