/**
 * scripts/lib/pyramid.mjs
 *
 * Verification pyramid step resolution and execution runner.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function readScripts(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts || {};
  } catch {
    return {};
  }
}

export function resolvePyramidSteps(root, pyramidSteps = []) {
  const scripts = readScripts(root);
  const has = (name) => Boolean(scripts[name]);
  return pyramidSteps.map((step) => {
    const candidates = [step.script, ...(step.fallbackScripts || [])];
    const resolvedScript = candidates.find((name) => has(name)) ?? step.script;
    return { ...step, script: resolvedScript, available: has(resolvedScript) };
  });
}

export function runPyramidStep(step, root) {
  if (typeof step.runner === 'function') {
    return step.runner(root);
  }

  if (!step.available) {
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

export function executePyramid(steps, root) {
  const outcomes = [];
  let pyramidFailed = false;
  let pyramidRan = 0;

  for (const step of steps) {
    const outcome = runPyramidStep(step, root);
    outcomes.push({ step, outcome });
    if (outcome.state === 'skipped') continue;
    pyramidRan += 1;
    if (outcome.state !== 'passed') {
      pyramidFailed = true;
    }
  }

  return { outcomes, pyramidFailed, pyramidRan };
}
