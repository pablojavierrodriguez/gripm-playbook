/**
 * scripts/lib/task-inspection.mjs
 *
 * Task loader, path resolver, actor identity resolution, and pure task inspector.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFrontmatter, readACs } from './frontmatter.mjs';
import { checkDiffAntiSlop, inspectDiffText } from './anti-slop.mjs';

const GATEABLE_STATUS = 'review';

export function isSameActor(a, b) {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (!normA || !normB) return false;
  return normA === normB;
}

export function resolveActor(argv = [], env = process.env) {
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--by' || argv[i] === '--as') && argv[i + 1]) {
      const val = argv[++i].trim();
      if (val) return val;
    }
  }

  for (const key of ['GRIPM_ACTOR', 'QA_ACTOR', 'CLAIMED_BY']) {
    const val = env[key]?.trim();
    if (val) return val;
  }

  if (env.ANTIGRAVITY_CONVERSATION_ID?.trim()) {
    return `antigravity:${env.ANTIGRAVITY_CONVERSATION_ID.trim()}`;
  }
  if (env.CURSOR_SESSION_ID?.trim()) {
    return `cursor:${env.CURSOR_SESSION_ID.trim()}`;
  }
  if (env.CLAUDE_SESSION_ID?.trim()) {
    return `claude-code:${env.CLAUDE_SESSION_ID.trim()}`;
  }

  const user = (env.USERNAME || env.USER || env.GIT_AUTHOR_NAME || '').trim();
  if (user) return `human:${user}`;

  return null;
}

export function loadTasks(tasksDir) {
  const tasks = new Map();
  const collisions = [];
  if (!tasksDir || !fs.existsSync(tasksDir)) return { tasks, collisions };

  for (const entry of fs.readdirSync(tasksDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const full = path.join(tasksDir, entry.name);
    let content;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      collisions.push({ id: entry.name, files: [entry.name, '(unreadable)'] });
      continue;
    }
    const frontmatter = readFrontmatter(content);
    if (!frontmatter || !frontmatter.id) continue;

    const id = frontmatter.id;
    if (tasks.has(id)) {
      collisions.push({ id, files: [tasks.get(id).file, entry.name] });
      continue;
    }
    tasks.set(id, { file: entry.name, content, frontmatter });
  }

  return { tasks, collisions };
}

export function resolveTaskPath(target, tasksDir) {
  if (!target) return null;
  if (!fs.existsSync(target)) {
    if (tasksDir) {
      const direct = path.join(tasksDir, target);
      if (fs.existsSync(direct)) return direct;

      const match = loadTasks(tasksDir).tasks.get(target);
      if (match) return path.join(tasksDir, match.file);
    }
    return null;
  }
  return path.resolve(target);
}

export function inspectTask(task, tasks = new Map(), options = {}) {
  const failures = [];
  const { frontmatter, content } = task;
  const certifier = options?.certifier ?? null;

  if (!frontmatter) {
    failures.push('the file has no closed YAML frontmatter');
    return failures;
  }

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

  if (!frontmatter.id || !frontmatter.id.trim()) {
    failures.push('the frontmatter declares no "id"; an unidentifiable item cannot be certified');
  }

  if (certifier && frontmatter.claimed_by && isSameActor(certifier, frontmatter.claimed_by)) {
    failures.push(
      `anti-self-certification: certifying actor "${certifier.trim()}" matches claimed_by ("${frontmatter.claimed_by.trim()}"). T2 certification requires an independent clean-context QA subagent or peer.`,
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

  if (frontmatter.status === 'blocked') {
    if (!frontmatter.blocked_reason || !frontmatter.blocked_reason.trim()) {
      failures.push('status is "blocked" but blocked_reason is missing or empty');
    }
  } else if (frontmatter.blocked_reason) {
    failures.push('blocked_reason is set but status is not "blocked"');
  }

  if (frontmatter.status === 'dismissed') {
    if (!frontmatter.dismissed_reason || !frontmatter.dismissed_reason.trim()) {
      failures.push('status is "dismissed" but dismissed_reason is missing or empty');
    }
  } else if (frontmatter.dismissed_reason) {
    failures.push('dismissed_reason is set but status is not "dismissed"');
  }

  if (frontmatter.priority && !['high', 'medium', 'low'].includes(frontmatter.priority)) {
    failures.push(`invalid priority "${frontmatter.priority}"; allowed values are high, medium, low`);
  }

  for (const dep of frontmatter.dependencies || []) {
    const resolved = tasks.get(dep);
    if (!resolved) {
      failures.push(`dependency "${dep}" does not exist in backlog/tasks/`);
      continue;
    }
    if (resolved.frontmatter.status !== 'done' && resolved.frontmatter.status !== 'ready') {
      failures.push(
        `dependency "${dep}" is "${resolved.frontmatter.status ?? '(missing)'}" (${resolved.file}) but must be "ready" or "done"`,
      );
    }
  }

  if (frontmatter.status === 'blocked') {
    for (const dep of frontmatter.dependencies || []) {
      const resolved = tasks.get(dep);
      if (!resolved) {
        failures.push(
          `unblock refused: dependency "${dep}" does not exist in backlog/tasks/; remove it from the array to unlink it`,
        );
        continue;
      }
      const depStatus = resolved.frontmatter.status;
      if (depStatus !== 'done' && depStatus !== 'ready') {
        failures.push(
          `unblock refused: dependency "${dep}" is "${depStatus ?? '(missing)'}"; it must be "ready" or "done" or unlinked`,
        );
      }
    }
  }

  if (options?.diffText) {
    for (const f of inspectDiffText(options.diffText)) failures.push(f);
  } else if (options?.projectRoot && options?.checkAntiSlop !== false) {
    const antiSlop = checkDiffAntiSlop(options.projectRoot);
    for (const f of antiSlop.failures) failures.push(f);
  }

  return failures;
}

export function syncConsolidatedBacklog(projectRoot) {
  if (!fs.existsSync(path.join(projectRoot, 'BACKLOG.md'))) return;
  const pkgPath = path.join(projectRoot, 'package.json');
  let scripts = {};
  try {
    scripts = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts || {};
  } catch {}
  const scriptName = ['backlog:sync', 'sync:backlog', 'backlog:export', 'export:backlog'].find((name) => Boolean(scripts[name]));
  if (scriptName) {
    try {
      spawnSync('npm', ['run', '--silent', scriptName], { cwd: projectRoot, encoding: 'utf8', shell: process.platform === 'win32', stdio: 'ignore' });
    } catch {}
  } else if (fs.existsSync(path.join(projectRoot, 'scripts', 'sync-backlog.js'))) {
    try {
      spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'sync-backlog.js')], { cwd: projectRoot, encoding: 'utf8', stdio: 'ignore' });
    } catch {}
  } else if (fs.existsSync(path.join(projectRoot, 'scripts', 'verify-backlog-sync.js'))) {
    try {
      spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'verify-backlog-sync.js'), '--export'], { cwd: projectRoot, encoding: 'utf8', stdio: 'ignore' });
    } catch {}
  }
}

