#!/usr/bin/env node

/**
 * scripts/gate-review-items.mjs
 *
 * CI entry point: runs the executable QA gate over every item in `review`.
 *
 * A gate that only ever runs by hand is a gate that gets skipped. This makes the
 * check mechanical on every push.
 *
 * Exit-code contract of `gate-qa.mjs`:
 *   0 -> certified
 *   1 -> failed
 *   2 -> inspection-only (never certifies), or usage error
 *
 * This script runs `--no-run` on purpose: the repository's own `validate` and
 * `test` steps already ran earlier in the CI job, and the point here is that
 * every item awaiting certification still satisfies the task-level rules. Exit
 * 2 is therefore the success code for this check, not a failure.
 *
 * Exit codes: 0 all items pass · 1 at least one item fails · 2 fatal
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFrontmatter } from './gate-qa.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function resolveRoot() {
  if (process.env.GRIPM_ROOT) return path.resolve(process.env.GRIPM_ROOT);
  for (let i = 2; i < process.argv.length; i++) {
    if ((process.argv[i] === '--root' || process.argv[i] === '--cwd') && process.argv[i + 1]) {
      return path.resolve(process.argv[i + 1]);
    }
    if (process.argv[i].startsWith('--root=')) return path.resolve(process.argv[i].split('=')[1]);
    if (process.argv[i].startsWith('--cwd=')) return path.resolve(process.argv[i].split('=')[1]);
  }
  const isInNodeModules = SCRIPT_DIR.split(path.sep).includes('node_modules');
  const scriptParent = path.resolve(SCRIPT_DIR, '..');
  if (isInNodeModules) return process.cwd();
  if (fs.existsSync(path.join(scriptParent, 'backlog', 'tasks'))) {
    return scriptParent;
  }
  return process.cwd();
}

const ROOT = resolveRoot();
const TASKS_DIR = path.join(ROOT, 'backlog', 'tasks');
const LOCAL_GATE = path.join(ROOT, 'scripts', 'gate-qa.mjs');
const GATE = fs.existsSync(LOCAL_GATE) ? LOCAL_GATE : path.join(SCRIPT_DIR, 'gate-qa.mjs');

const statusOf = (content) => readFrontmatter(content)?.status;

function main() {
  if (!fs.existsSync(TASKS_DIR)) {
    console.log('No backlog/tasks directory; nothing to gate.');
    return 0;
  }

  const reviewItems = fs
    .readdirSync(TASKS_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ name, file: path.join(TASKS_DIR, name) }))
    .filter(({ file }) => statusOf(fs.readFileSync(file, 'utf8')) === 'review');

  if (!reviewItems.length) {
    console.log('No items in review; nothing to gate.');
    return 0;
  }

  console.log(`Gating ${reviewItems.length} item(s) in review...\n`);

  let failed = 0;
  for (const { name, file } of reviewItems) {
    const result = spawnSync(process.execPath, [GATE, file, '--no-run', '--root', ROOT], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GRIPM_ROOT: ROOT },
    });
    const code = result.status;

    if (code === 2) {
      console.log(`  ok    ${name}`);
    } else {
      failed += 1;
      console.log(`  FAIL  ${name} (exit ${code})`);
      const detail = `${result.stdout || ''}${result.stderr || ''}`;
      for (const line of detail.split('\n').filter((l) => l.includes('✖') || l.includes('❌'))) {
        console.log(`        ${line.trim()}`);
      }
    }
  }

  console.log('');
  if (failed) {
    console.log(`${failed} item(s) in review do not satisfy the gate.`);
    return 1;
  }
  console.log(`All ${reviewItems.length} item(s) in review satisfy the task-level gate.`);
  return 0;
}

process.exit(main());