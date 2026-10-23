/**
 * scripts/lib/cli-router.mjs
 *
 * Unified CLI routing and dispatcher for @gripm/playbook commands.
 * Dispatches subcommands (init, sync, gate, audit, check-loc, review).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { c } from './terminal.mjs';

const SCRIPT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function printCliHelp() {
  console.log(`
  ${c.bold('gripm-playbook')} ${c.dim('· Multi-Agent Agile Delivery Framework')}

  ${c.bold('Usage:')}
    playbook <command> [options]
    npx @gripm/playbook <command> [options]

  ${c.bold('Commands:')}
    ${c.cyan('init')}               Onboarding wizard: configure harnesses, stack and adapters
    ${c.cyan('sync')}               Sync or update canonical framework files and stack packs
    ${c.cyan('gate')} <TASK-ID>     Execute QA verification pyramid and certify review → ready
    ${c.cyan('audit')}              Static code-level UX & accessibility audit
    ${c.cyan('check-loc')}          Mechanical file line budget (< 1000 LOC) checker
    ${c.cyan('review')}             Audit all backlog tasks currently in review
    ${c.cyan('help')}               Show this help message

  ${c.bold('Examples:')}
    npx playbook init --yes
    npx playbook sync --stack react
    npx playbook gate PLAY-001
    npx playbook audit --strict
    npx playbook check-loc
`);
}

export function routeCli(subcommand, rest, fallbackSync) {
  if (subcommand === 'init') {
    import('../init.mjs')
      .then((module) => module.runInit(rest))
      .catch((err) => {
        console.error('Fatal:', err.message);
        process.exit(2);
      });
  } else if (subcommand === 'gate' || subcommand === 'gate-qa') {
    import('../gate-qa.mjs')
      .then((module) => {
        const args = rest.includes('--autonomous') ? rest : ['--autonomous', ...rest];
        if (args[0] === 'unblock') module.unblockMain(args.slice(1));
        else if (args[0] === 'start') module.startMain(args.slice(1));
        else if (args[0] === 'submit') module.submitMain(args.slice(1));
        else module.main(args);
      })
      .catch((err) => {
        console.error('Fatal:', err.message);
        process.exit(2);
      });
  } else if (subcommand === 'audit' || subcommand === 'audit-ux') {
    const auditScript = path.join(SCRIPT_DIR, 'audit-ux-code.cjs');
    const result = spawnSync(process.execPath, [auditScript, ...rest], {
      stdio: 'inherit',
      env: process.env,
    });
    process.exit(result.status ?? 0);
  } else if (subcommand === 'check-loc' || subcommand === 'loc') {
    const checkLocScript = path.join(SCRIPT_DIR, 'check-loc.mjs');
    const result = spawnSync(process.execPath, [checkLocScript, ...rest], {
      stdio: 'inherit',
      env: process.env,
    });
    process.exit(result.status ?? 0);
  } else if (subcommand === 'review' || subcommand === 'gate-review') {
    const reviewScript = path.join(SCRIPT_DIR, 'gate-review-items.mjs');
    const result = spawnSync(process.execPath, [reviewScript, ...rest], {
      stdio: 'inherit',
      env: { ...process.env, GRIPM_ROOT: process.cwd() },
    });
    process.exit(result.status ?? 0);
  } else if (subcommand === 'help' || (subcommand && (subcommand === '--help' || subcommand === '-h') && rest.length === 0)) {
    printCliHelp();
  } else {
    fallbackSync(subcommand === 'sync' ? rest : [subcommand, ...rest].filter(Boolean));
  }
}
