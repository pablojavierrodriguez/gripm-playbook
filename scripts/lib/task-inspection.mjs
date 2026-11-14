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
const HISTORICAL_STATUSES = new Set(['done', 'dismissed']);

export function loadActiveSprintIds(projectRoot) {
  const active = new Set();
  if (!projectRoot) return active;
  const sprintsPath = path.join(projectRoot, 'backlog', 'sprints.json');
  if (!fs.existsSync(sprintsPath)) return active;
  try {
    const raw = JSON.parse(fs.readFileSync(sprintsPath, 'utf8'));
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.sprints) ? raw.sprints : []);
    for (const sprint of list) {
      if (sprint?.id && String(sprint.status || '').toLowerCase() === 'active') {
        active.add(String(sprint.id));
      }
    }
  } catch {}
  return active;
}

export function collectTransitiveDependencies(targetFrontmatter, tasks) {
  const deps = new Set();
  const queue = [...(targetFrontmatter?.dependencies || [])];
  while (queue.length > 0) {
    const depId = queue.shift();
    if (!depId || deps.has(depId)) continue;
    deps.add(depId);
    const resolved = tasks?.get?.(depId);
    for (const nested of resolved?.frontmatter?.dependencies || []) {
      if (nested && !deps.has(nested)) queue.push(nested);
    }
  }
  return deps;
}

export function classifyCollisions(collisions = [], tasks = new Map(), options = {}) {
  if (!options || (!options.targetFrontmatter && !options.projectRoot && !options.strict && !options.scoped)) {
    return { blockingCollisions: collisions, warnings: [] };
  }

  const targetId = options.targetFrontmatter?.id || null;
  const depIds = collectTransitiveDependencies(options.targetFrontmatter, tasks);
  const activeSprintIds = options.projectRoot ? loadActiveSprintIds(options.projectRoot) : new Set();
  const strict = Boolean(options.strict);

  const blockingCollisions = [];
  const warnings = [];

  for (const col of collisions) {
    const statuses = Array.isArray(col.statuses) ? col.statuses : [];
    const sprintIds = Array.isArray(col.sprintIds) ? col.sprintIds : [];
    const unreadable = Array.isArray(col.files) && col.files.includes('(unreadable)');
    const touchesTarget = Boolean(targetId && col.id === targetId);
    const touchesDep = depIds.has(col.id);
    const touchesActiveSprint = sprintIds.some((sid) => sid && activeSprintIds.has(String(sid)));
    const hasNonHistoricalStatus = !statuses.length
      || statuses.some((st) => !HISTORICAL_STATUSES.has(String(st || '').toLowerCase()));

    if (strict || unreadable || touchesTarget || touchesDep || touchesActiveSprint || hasNonHistoricalStatus) {
      blockingCollisions.push(col);
    } else {
      warnings.push(
        `historical duplicate task id "${col.id}" in ${col.files.join(' and ')} (statuses: ${statuses.join(', ')}) - ignored outside active scope`,
      );
    }
  }

  return { blockingCollisions, warnings };
}

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

export function loadTasks(tasksDir, options = null) {
  const tasks = new Map();
  const collisions = [];
  const collisionById = new Map();
  if (!tasksDir || !fs.existsSync(tasksDir)) return { tasks, collisions, warnings: [] };

  for (const entry of fs.readdirSync(tasksDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const full = path.join(tasksDir, entry.name);
    let content;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      collisions.push({
        id: entry.name,
        files: [entry.name, '(unreadable)'],
        statuses: ['(unreadable)'],
        sprintIds: [],
      });
      continue;
    }
    const frontmatter = readFrontmatter(content);
    if (!frontmatter || !frontmatter.id) continue;

    const id = frontmatter.id;
    const statusVal = frontmatter.status ? String(frontmatter.status) : '(missing)';
    const sprintVal = frontmatter.sprint_id ? String(frontmatter.sprint_id) : null;

    if (tasks.has(id)) {
      const existing = tasks.get(id);
      let record = collisionById.get(id);
      if (!record) {
        const existingStatus = existing.frontmatter?.status ? String(existing.frontmatter.status) : '(missing)';
        const existingSprint = existing.frontmatter?.sprint_id ? String(existing.frontmatter.sprint_id) : null;
        record = {
          id,
          files: [existing.file, entry.name],
          statuses: [existingStatus, statusVal],
          sprintIds: [existingSprint, sprintVal],
        };
        collisionById.set(id, record);
        collisions.push(record);
      } else {
        record.files.push(entry.name);
        record.statuses.push(statusVal);
        record.sprintIds.push(sprintVal);
      }
      continue;
    }
    tasks.set(id, { file: entry.name, content, frontmatter });
  }

  if (options) {
    const { blockingCollisions, warnings } = classifyCollisions(collisions, tasks, options);
    return { tasks, collisions: blockingCollisions, warnings, allCollisions: collisions };
  }

  return { tasks, collisions, warnings: [] };
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

