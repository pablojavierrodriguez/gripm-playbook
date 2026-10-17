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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TASKS_DIR = path.join(ROOT, 'backlog', 'tasks');
const GATE = path.join(ROOT, 'scripts', 'gate-qa.mjs');

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
    const result = spawnSync(process.execPath, [GATE, file, '--no-run'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
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