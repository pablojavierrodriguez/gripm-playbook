#!/usr/bin/env node

/**
 * scripts/gate-qa.mjs
 *
 * Executable QA gate (PLAY-015 & anti-self-certification). Replaces prose-only
 * certification with a mechanical gate that must return exit code 0 before an
 * item may be promoted from `review` to `ready`.
 *
 * Exit codes: 0 gate passed · 1 gate failed · 2 fatal (bad usage / inspection)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFrontmatter, readACs, mutateTaskFrontmatter } from './lib/frontmatter.mjs';
import { c, printHeader } from './lib/terminal.mjs';
import { resolvePyramidSteps, executePyramid, readScripts } from './lib/pyramid.mjs';
import {
  loadTasks as loadTasksFromDir,
  resolveTaskPath as resolveTaskPathFromDir,
  inspectTask,
  resolveActor,
  isSameActor,
} from './lib/task-inspection.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export function resolveProjectRoot(explicitRoot = null, targetPath = null) {
  if (explicitRoot) return path.resolve(explicitRoot);
  if (process.env.GRIPM_ROOT) return path.resolve(process.env.GRIPM_ROOT);

  if (targetPath) {
    const absTarget = path.resolve(targetPath);
    if (fs.existsSync(absTarget) || targetPath.includes('/') || targetPath.includes('\\')) {
      let curr = fs.existsSync(absTarget) && fs.statSync(absTarget).isDirectory()
        ? absTarget
        : path.dirname(absTarget);
      while (true) {
        if (
          fs.existsSync(path.join(curr, 'backlog', 'tasks')) ||
          fs.existsSync(path.join(curr, '.agents')) ||
          fs.existsSync(path.join(curr, 'package.json'))
        ) {
          return curr;
        }
        const parent = path.dirname(curr);
        if (parent === curr) break;
        curr = parent;
      }
    }
  }

  const scriptParent = path.resolve(SCRIPT_DIR, '..');
  const isInNodeModules = SCRIPT_DIR.split(path.sep).includes('node_modules');
  const cwd = process.cwd();

  if (targetPath && !targetPath.includes('/') && !targetPath.includes('\\')) {
    const cwdTasks = path.join(cwd, 'backlog', 'tasks');
    if (fs.existsSync(cwdTasks) && resolveTaskPathFromDir(targetPath, cwdTasks)) {
      return cwd;
    }
    const parentTasks = path.join(scriptParent, 'backlog', 'tasks');
    if (fs.existsSync(parentTasks) && resolveTaskPathFromDir(targetPath, parentTasks)) {
      return scriptParent;
    }
  }

  if (isInNodeModules) {
    return cwd;
  }

  let isPlaybookRepo = false;
  try {
    const pkgPath = path.join(scriptParent, 'package.json');
    if (fs.existsSync(path.join(scriptParent, '.playbook-manifest.json')) && fs.existsSync(pkgPath)) {
      isPlaybookRepo = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).name === '@gripm/playbook';
    }
  } catch {}

  if (!isPlaybookRepo && (fs.existsSync(path.join(scriptParent, 'package.json')) || fs.existsSync(path.join(scriptParent, 'backlog', 'tasks')))) {
    return scriptParent;
  }

  if (isPlaybookRepo && cwd !== scriptParent && (fs.existsSync(path.join(cwd, 'package.json')) || fs.existsSync(path.join(cwd, 'backlog', 'tasks')))) {
    return cwd;
  }

  if (fs.existsSync(path.join(cwd, 'backlog', 'tasks')) || fs.existsSync(path.join(cwd, 'package.json'))) {
    return cwd;
  }

  return scriptParent;
}

export function getExplicitRoot(argv = []) {
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--root' || argv[i] === '--cwd') && argv[i + 1]) {
      return argv[i + 1];
    }
    if (argv[i].startsWith('--root=')) return argv[i].split('=')[1];
    if (argv[i].startsWith('--cwd=')) return argv[i].split('=')[1];
  }
  return null;
}

const ROOT = resolveProjectRoot();
const TASKS_DIR = path.join(ROOT, 'backlog', 'tasks');

export function syncConsolidatedBacklog(projectRoot) {
  const backlogPath = path.join(projectRoot, 'BACKLOG.md');
  if (!fs.existsSync(backlogPath)) {
    return;
  }

  const scripts = readScripts(projectRoot);
  const candidates = ['backlog:sync', 'sync:backlog', 'backlog:export', 'export:backlog'];
  const scriptName = candidates.find((name) => Boolean(scripts[name]));

  if (scriptName) {
    try {
      spawnSync('npm', ['run', '--silent', scriptName], {
        cwd: projectRoot,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        stdio: 'ignore',
      });
    } catch {}
  } else if (fs.existsSync(path.join(projectRoot, 'scripts', 'sync-backlog.js'))) {
    try {
      spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'sync-backlog.js')], {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'ignore',
      });
    } catch {}
  } else if (fs.existsSync(path.join(projectRoot, 'scripts', 'verify-backlog-sync.js'))) {
    try {
      spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'verify-backlog-sync.js'), '--export'], {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'ignore',
      });
    } catch {}
  }
}

export { readFrontmatter, readACs, mutateTaskFrontmatter, inspectTask, resolveActor, isSameActor };

export function loadTasks(tasksDir) {
  const dir = tasksDir || path.join(resolveProjectRoot(), 'backlog', 'tasks');
  return loadTasksFromDir(dir);
}

export function resolveTaskPath(target, tasksDir) {
  const dir = tasksDir || path.join(resolveProjectRoot(null, target), 'backlog', 'tasks');
  return resolveTaskPathFromDir(target, dir);
}

/**
 * The verification steps the gate can execute.
 * Kept literal in gate-qa.mjs so scripts/validate-repo.mjs can verify parity.
 */
const PYRAMID_STEPS = [
  { id: 'validate', label: 'Repo consistency / typecheck', script: 'validate', fallbackScripts: ['typecheck'], blocking: true },
  { id: 'test', label: 'Headless tests', script: 'test', blocking: true },
  { id: 'spec', label: 'Spec ↔ backlog consistency', script: 'gate:review', blocking: true },
  { id: 'audit:ux', label: 'Static UX audit', script: 'audit:ux:strict', blocking: true },
  { id: 'build', label: 'Production build', script: 'build', blocking: false, optional: true },
];

export function resolvePyramid(root = resolveProjectRoot(), options = {}) {
  const isAutonomous = options.autonomous || (process.argv && process.argv.includes('--autonomous'));
  const steps = resolvePyramidSteps(root, PYRAMID_STEPS);
  if (isAutonomous) {
    for (const step of steps) {
      if (!step.available && step.id === 'audit:ux') {
        step.available = true;
        step.runner = (r) => {
          const auditScript = path.resolve(SCRIPT_DIR, 'audit-ux-code.cjs');
          const res = spawnSync(process.execPath, [auditScript, '--strict', '--quiet'], {
            cwd: r,
            encoding: 'utf8',
            env: { ...process.env, AUDIT_UX_ROOT: r },
          });
          if (res.status === 0) {
            return { state: 'passed', detail: 'packaged audit-ux --strict passed' };
          }
          const tail = `${res.stdout || ''}${res.stderr || ''}`.trim().split('\n').slice(-4).join('\n      ');
          return { state: 'failed', detail: `audit-ux failed (exit code ${res.status})${tail ? `\n      ${tail}` : ''}` };
        };
      }
      if (!step.available && step.id === 'spec') {
        step.available = true;
        step.runner = (r) => {
          const tasksDir = path.join(r, 'backlog', 'tasks');
          if (!fs.existsSync(tasksDir)) {
            return { state: 'passed', detail: 'no backlog/tasks directory' };
          }
          const reviewScript = path.resolve(SCRIPT_DIR, 'gate-review-items.mjs');
          const res = spawnSync(process.execPath, [reviewScript], {
            cwd: r,
            encoding: 'utf8',
            env: { ...process.env, GRIPM_ROOT: r },
          });
          if (res.status === 0) {
            return { state: 'passed', detail: 'packaged review check passed' };
          }
          const tail = `${res.stdout || ''}${res.stderr || ''}`.trim().split('\n').slice(-4).join('\n      ');
          return { state: 'failed', detail: `spec review check failed (exit code ${res.status})${tail ? `\n      ${tail}` : ''}` };
        };
      }
    }
  }
  return steps;
}

function getPositionalTarget(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--by' || arg === '--as' || arg === '--to' || arg === '--root' || arg === '--cwd') {
      i += 1;
      continue;
    }
    if (!arg.startsWith('--')) return arg;
  }
  return null;
}

export function unblockMain(argv) {
  let target = null;
  let targetStatus = 'doing';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--to' && argv[i + 1]) {
      targetStatus = argv[++i];
    } else if (argv[i] === '--root' || argv[i] === '--cwd') {
      i += 1;
    } else if (!argv[i].startsWith('--') && !target) {
      target = argv[i];
    }
  }
  if (!target || !['doing', 'draft'].includes(targetStatus)) {
    printHeader('QA Gate · unblock');
    console.log('usage: node scripts/gate-qa.mjs unblock <TASK-ID | path/to/task.md> [--to doing|draft]\n');
    process.exit(2);
  }

  printHeader('QA Gate · unblock (T_unblock)');

  const explicitRoot = getExplicitRoot(argv);
  const projectRoot = resolveProjectRoot(explicitRoot, target);
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  const taskPath = resolveTaskPath(target, tasksDir);
  if (!taskPath) {
    console.log(`  ${c.red('✖')} no task found for "${target}" in backlog/tasks/\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(taskPath, 'utf8');
  const frontmatter = readFrontmatter(content);
  console.log(`  ${c.dim('➜')} Task:    ${path.relative(projectRoot, taskPath)}`);
  console.log(`    ID:      ${c.bold(frontmatter?.id ?? '(unreadable)')}`);
  console.log(`    Status:  ${frontmatter?.status ?? '(missing)'}\n`);

  if (frontmatter?.status !== 'blocked') {
    console.log(`  ${c.dim('ℹ')} this item is "${frontmatter?.status ?? '(missing)'}", not "blocked"; T_unblock does not apply.\n`);
    process.exit(0);
  }

  const { tasks, collisions } = loadTasks(tasksDir);
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

  const updated = mutateTaskFrontmatter(content, { status: targetStatus, remove: ['blocked_reason'] });
  fs.writeFileSync(taskPath, updated, 'utf8');
  syncConsolidatedBacklog(projectRoot);

  console.log(`  ${c.bold('T_unblock guard:')}`);
  console.log(`    ${c.green('✔')} every dependency is done or unlinked`);
  console.log(`\n  ${c.green('✔')} UNBLOCK ALLOWED - ${frontmatter.id} moved blocked → ${targetStatus}.\n`);
  process.exit(0);
}

export function startMain(argv) {
  const target = getPositionalTarget(argv);
  const claimedBy = resolveActor(argv);

  if (!target) {
    printHeader('QA Gate · start (T0)');
    console.log('usage: node scripts/gate-qa.mjs start <TASK-ID | path/to/task.md> [--by <provider:id>]\n');
    process.exit(2);
  }

  printHeader('QA Gate · start (T0: draft → doing)');
  const explicitRoot = getExplicitRoot(argv);
  const projectRoot = resolveProjectRoot(explicitRoot, target);
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  const taskPath = resolveTaskPath(target, tasksDir);
  if (!taskPath) {
    console.log(`  ${c.red('✖')} no task found for "${target}" in backlog/tasks/\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(taskPath, 'utf8');
  const frontmatter = readFrontmatter(content);
  const { tasks, collisions } = loadTasks(tasksDir);
  const failures = [];

  if (!frontmatter || !frontmatter.id || !frontmatter.id.trim()) {
    failures.push('the frontmatter declares no valid "id"');
  }
  if (frontmatter?.status !== 'draft') {
    failures.push(`status is "${frontmatter?.status ?? '(missing)'}" but T0 only starts items in "draft"`);
  }
  const acs = readACs(content);
  if (!acs || acs.length === 0) {
    failures.push('Gate R1 failed: task has no acceptance criteria in <!-- AC:BEGIN --> / <!-- AC:END -->');
  }
  for (const dep of frontmatter?.dependencies || []) {
    const resolved = tasks.get(dep);
    if (!resolved) failures.push(`dependency "${dep}" does not exist in backlog/tasks/`);
    else if (resolved.frontmatter.status !== 'done') {
      failures.push(`dependency "${dep}" is "${resolved.frontmatter.status ?? '(missing)'}" (${resolved.file}) but must be "done"`);
    }
  }
  collisions.forEach((col) => {
    failures.push(`task id "${col.id}" is declared by two files: ${col.files.join(' and ')}`);
  });

  if (failures.length) {
    for (const f of failures) console.log(`    ${c.red('✖')} ${f}`);
    console.log(`\n  ${c.red('✖')} START REFUSED - ${frontmatter?.id ?? target} remains in "${frontmatter?.status ?? '(missing)'}".\n`);
    process.exit(1);
  }

  const set = claimedBy ? { claimed_by: claimedBy } : {};
  fs.writeFileSync(taskPath, mutateTaskFrontmatter(content, { status: 'doing', set }), 'utf8');
  syncConsolidatedBacklog(projectRoot);
  console.log(`  ${c.green('✔')} START ALLOWED - ${frontmatter.id} moved draft → doing.\n`);
  process.exit(0);
}

export function submitMain(argv) {
  const target = getPositionalTarget(argv);
  if (!target) {
    printHeader('QA Gate · submit (T1)');
    console.log('usage: node scripts/gate-qa.mjs submit <TASK-ID | path/to/task.md>\n');
    process.exit(2);
  }

  printHeader('QA Gate · submit (T1: doing → review)');
  const explicitRoot = getExplicitRoot(argv);
  const projectRoot = resolveProjectRoot(explicitRoot, target);
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  const taskPath = resolveTaskPath(target, tasksDir);
  if (!taskPath) {
    console.log(`  ${c.red('✖')} no task found for "${target}" in backlog/tasks/\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(taskPath, 'utf8');
  const frontmatter = readFrontmatter(content);
  const { tasks, collisions } = loadTasks(tasksDir);
  const failures = inspectTask({ content, frontmatter: { ...frontmatter, status: 'review' } }, tasks);
  if (frontmatter?.status !== 'doing') {
    failures.unshift(`status is "${frontmatter?.status ?? '(missing)'}" but T1 only submits items in "doing"`);
  }
  collisions.forEach((col) => {
    failures.push(`task id "${col.id}" is declared by two files: ${col.files.join(' and ')}`);
  });

  if (failures.length) {
    for (const f of failures) console.log(`    ${c.red('✖')} ${f}`);
    console.log(`\n  ${c.red('✖')} SUBMIT REFUSED - ${frontmatter?.id ?? target} remains in "${frontmatter?.status ?? '(missing)'}".\n`);
    process.exit(1);
  }

  fs.writeFileSync(taskPath, mutateTaskFrontmatter(content, { status: 'review' }), 'utf8');
  syncConsolidatedBacklog(projectRoot);
  console.log(`  ${c.green('✔')} SUBMIT ALLOWED - ${frontmatter.id} moved doing → review.\n`);
  process.exit(0);
}

export function main(argv) {
  const target = getPositionalTarget(argv);
  if (!target) {
    printHeader('QA Gate');
    console.log('usage: node scripts/gate-qa.mjs <TASK-ID | path/to/task.md> [--no-run] [--by <provider:id>]\n');
    console.log('  default     runs the pyramid and certifies (exit 0 = may promote)');
    console.log('  --no-run    inspection only, exits 2: never certifies\n');
    process.exit(2);
  }

  const runPyramid = !argv.includes('--no-run');
  const hasExplicitActor = argv.some((a) => a === '--by' || a === '--as' || a.startsWith('--by=') || a.startsWith('--as='));
  const certifier = runPyramid || hasExplicitActor ? resolveActor(argv) : undefined;

  printHeader('QA Gate');

  const explicitRoot = getExplicitRoot(argv);
  const projectRoot = resolveProjectRoot(explicitRoot, target);
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  const taskPath = resolveTaskPath(target, tasksDir);
  if (!taskPath) {
    console.log(`  ${c.red('✖')} no task found for "${target}" in backlog/tasks/\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(taskPath, 'utf8');
  const frontmatter = readFrontmatter(content);
  console.log(`  ${c.dim('➜')} Task:    ${path.relative(projectRoot, taskPath)}`);
  console.log(`    ID:      ${c.bold(frontmatter?.id ?? '(unreadable)')}`);
  console.log(`    Status:  ${frontmatter?.status ?? '(missing)'}\n`);

  const { tasks, collisions } = loadTasks(tasksDir);
  const failures = inspectTask({ content, frontmatter }, tasks, { certifier });

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
    const isAutonomous = argv.includes('--autonomous');
    const workRoot = projectRoot;
    const steps = resolvePyramid(workRoot, { autonomous: isAutonomous });
    console.log(`  ${c.bold('Verification pyramid:')}`);
    const execResult = executePyramid(steps, workRoot);
    pyramidFailed = execResult.pyramidFailed;
    pyramidRan = execResult.pyramidRan;
    for (const { step, outcome } of execResult.outcomes) {
      if (outcome.state === 'skipped') {
        console.log(`    ${c.dim('•')} ${step.label}: SKIPPED (${outcome.detail})`);
      } else if (outcome.state === 'passed') {
        console.log(`    ${c.green('✔')} ${step.label}`);
      } else {
        console.log(`    ${c.red('✖')} ${step.label}: ${outcome.detail}`);
      }
    }
    if (!pyramidRan) console.log(`    ${c.dim('•')} nothing to run: the project defines no verification scripts.`);
    console.log('');
  }

  const nothingVerified = runPyramid && pyramidRan === 0;
  const ok = failures.length === 0 && !pyramidFailed && !nothingVerified;

  if (ok && !runPyramid) {
    console.log(`  ${c.yellow('▲')} TASK INSPECTION PASSED - ${frontmatter.id} satisfies the task checks.`);
    console.log(`    ${c.dim('NOT a certification: the pyramid did not run. Re-run without --no-run.')}\n`);
    process.exit(2);
  }

  if (ok) {
    fs.writeFileSync(taskPath, mutateTaskFrontmatter(content, { status: 'ready' }), 'utf8');
    syncConsolidatedBacklog(projectRoot);
    console.log(`  ${c.green('✔')} GATE PASSED - ${frontmatter.id} promoted review → ready (may be promoted).\n`);
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
  if (args[0] === 'unblock') unblockMain(args.slice(1));
  else if (args[0] === 'start') startMain(args.slice(1));
  else if (args[0] === 'submit') submitMain(args.slice(1));
  else main(args);
}