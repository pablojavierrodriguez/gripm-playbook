#!/usr/bin/env node

/**
 * Gripm Playbook Synchronizer
 *
 * Installs or updates the canonical framework layer (rules, core skills, tooling)
 * into any project, without touching the project layer (AGENTS.md, backlog, code).
 *
 * Architecture principle: Separation of Layers
 * - Framework layer (synced):   .agents/**, scripts/**, docs/sprints/**
 * - Project layer (preserved):  AGENTS.md, docs/BACKLOG.md, application code
 *
 * Usage:
 *   node scripts/sync-playbook.mjs [options]
 *
 * Options:
 *   --repo <dir>       Target repository (default: cwd)
 *   --source <dir>     Local playbook directory to sync from (bypasses GitHub)
 *   --tag <ref>        Git ref to sync from (default: latest release tag, else main)
 *   --remote <o/r>     Upstream repository (default: pablojavierrodriguez/gripm-playbook)
 *   --stack <name>     Also install an optional stack pack (repeatable)
 *   --list-stacks      List available stack packs and exit
 *   --init-agents      Create AGENTS.md from the template when absent
 *   --adopt            Keep every differing file as-is and record it as baseline
 *   --dry-run          Report what would change, write nothing
 *   --force            Overwrite customised files
 *   --no-history       Skip the upstream provenance lookup
 *   --yes              Never prompt
 *   --no-manifest      Do not write the lockfile
 *   --help             Show usage
 *
 * Exit codes: 0 ok · 1 protected files or orphans present · 2 fatal
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeCli } from './lib/cli-router.mjs';
import { c, promptConfirm } from './lib/terminal.mjs';
import {
  HISTORY_BUDGET,
  makeBudget,
  fetchRemoteFile,
  resolveRef,
  findCanonicalProvenance,
} from './lib/provenance.mjs';
import {
  CANONICAL_LOCK_PATH,
  LEGACY_LOCK_PATH,
  LOCK_PATH,
  sha256,
  classifyLocalFile,
  findOrphanedFiles,
  pruneOrphanedFiles,
  pruneLegacyScripts,
  readLock,
  planFiles,
} from './lib/sync-classifier.mjs';

const __filename = fileURLToPath(import.meta.url);

const DEFAULT_REMOTE = 'pablojavierrodriguez/gripm-playbook';
const MANIFEST_PATH = '.playbook-manifest.json';

export { findCanonicalProvenance, classifyLocalFile, findOrphanedFiles };

/**
 * Fallback used only when the remote manifest cannot be fetched.
 * Kept in sync with the manifest by scripts/validate-repo.mjs.
 */
export const FALLBACK_CORE_FILES = [
  '.agents/TEAM_PLAYBOOK.md',
  '.agents/STATE_MACHINE.md',
  '.agents/rules/git-workflow.md',
  '.agents/skills/pm-orchestrator/SKILL.md',
  '.agents/skills/market-researcher/SKILL.md',
  '.agents/skills/product-designer/SKILL.md',
  '.agents/skills/principal-engineer/SKILL.md',
  '.agents/skills/qa-auditor/SKILL.md',
  '.agents/skills/code-level-ux-auditor/SKILL.md',
  'scripts/audit-ux-code.cjs',
  'scripts/gate-qa.mjs',
  'scripts/gate-review-items.mjs',
  'scripts/check-loc.mjs',
  'scripts/ux-rules.json',
  'scripts/sync-playbook.mjs',
  'scripts/init.mjs',
  'scripts/lib/frontmatter.mjs',
  'scripts/lib/terminal.mjs',
  'scripts/lib/adapters.mjs',
  'scripts/lib/pyramid.mjs',
  'scripts/lib/task-inspection.mjs',
  'scripts/lib/provenance.mjs',
  'scripts/lib/sync-classifier.mjs',
  'scripts/lib/cli-router.mjs',
  'docs/sprints/SPRINT_SPEC_TEMPLATE.md',
  'docs/DOMAIN_TEMPLATE.md',
];

export const FALLBACK_STACKS = {
  react: [
    '.agents/stacks/react/STACK.md',
    '.agents/stacks/react/skills/forms-rhf-zod/SKILL.md',
    '.agents/stacks/react/skills/ui-radix-tailwind/SKILL.md',
    '.agents/stacks/react/skills/recharts-reporting/SKILL.md',
  ],
  mobile: [
    '.agents/stacks/mobile/STACK.md',
    '.agents/stacks/mobile/skills/mobile-ux-design/SKILL.md',
  ],
  pwa: [
    '.agents/stacks/pwa/STACK.md',
    '.agents/stacks/pwa/skills/pwa-assets-audit/SKILL.md',
  ],
};

async function loadManifest(remote, ref, sourceDir = null) {
  const content = await fetchRemoteFile(remote, ref, MANIFEST_PATH, sourceDir);
  if (!content) return null;
  try {
    const manifest = JSON.parse(content);
    if (!manifest.core || !Array.isArray(manifest.core)) return null;
    return manifest;
  } catch {
    return null;
  }
}

function printBanner(targetRepo, remote, ref, pinned, stacks) {
  const upstreamDisplay = `${remote}@${ref}${pinned ? '' : ' (unpinned)'}`;
  const stackDisplay = stacks.length ? stacks.join(', ') : '(core only)';

  console.log(`
  ${c.bold('gripm')} ${c.dim('· Playbook Sync')}

  ${c.dim('➜')}  ${c.dim('Target:')}       ${path.resolve(targetRepo)}
  ${c.dim('➜')}  ${c.dim('Upstream:')}     ${c.cyan(upstreamDisplay)}
  ${c.dim('➜')}  ${c.dim('Stack packs:')}  ${stackDisplay}
`);
}

export async function runPlaybookSync(targetRepo = process.cwd(), options = {}) {
  const packageBundleRoot = path.resolve(path.dirname(__filename), '..');
  const targetDir = path.resolve(targetRepo);
  const hasLocalPackageBundle = fs.existsSync(path.join(packageBundleRoot, MANIFEST_PATH));
  const shouldDefaultToLocalBundle =
    !options.source &&
    !options.remote &&
    hasLocalPackageBundle &&
    targetDir !== packageBundleRoot;

  const isLocalSource =
    !!options.source ||
    shouldDefaultToLocalBundle ||
    (options.remote && fs.existsSync(options.remote) && fs.statSync(options.remote).isDirectory());
  const localSourceDir = options.source
    ? path.resolve(options.source)
    : shouldDefaultToLocalBundle
      ? packageBundleRoot
      : isLocalSource
        ? path.resolve(options.remote)
        : null;
  const remote = localSourceDir || options.remote || DEFAULT_REMOTE;
  const requestedRef = options.tag || options.branch;
  const stacks = options.stacks || [];
  const isDryRun = !!options.dryRun;
  const force = !!options.force;
  const assumeYes = !!options.yes;
  const writeManifest = options.manifest !== false;

  const { ref, pinned } = localSourceDir
    ? { ref: 'local', pinned: true }
    : await resolveRef(remote, requestedRef);

  printBanner(targetRepo, remote, ref, pinned, stacks);

  const manifest = await loadManifest(remote, ref, localSourceDir);
  if (!manifest) {
    console.log(`  ${c.yellow('▲')}  ${c.yellow('Could not read the remote manifest; falling back to the built-in core list.')}\n`);
  }

  const isConsumerPackage = targetDir !== packageBundleRoot && !options.installScripts;
  const { files, stackSource, unknown } = planFiles(
    manifest,
    stacks,
    FALLBACK_CORE_FILES,
    FALLBACK_STACKS,
    { packageMode: isConsumerPackage }
  );

  for (const name of unknown) {
    console.error(`  ${c.red('✖')}  ${c.red(`Unknown stack pack "${name}". Available: ${Object.keys(stackSource).join(', ')}`)}`);
  }
  if (unknown.length) process.exitCode = 1;

  const lock = readLock(targetRepo);
  const nextLockFiles = {};
  const nextCustomizations = new Set(lock.customizations);

  const adopt = !!options.adopt;
  const checkHistory = options.history !== false;
  const budget = makeBudget(HISTORY_BUDGET);

  const stats = {
    created: 0,
    updated: 0,
    unchanged: 0,
    adopted: 0,
    protected: 0,
    recognizedCanonical: 0,
    missingUpstream: 0,
  };
  const protectedFiles = [];
  const backupRoot = path.join(targetRepo, '.gripm', 'backups');

  for (const relativePath of files) {
    let remoteContent;
    try {
      remoteContent = await fetchRemoteFile(remote, ref, relativePath, localSourceDir);
    } catch (err) {
      console.error(`  ${c.red('✖')} ${c.red('error'.padEnd(10))} ${relativePath}: ${err.message}`);
      stats.missingUpstream += 1;
      continue;
    }

    if (remoteContent === null) {
      console.error(`  ${c.yellow('▲')} ${c.yellow('upstream'.padEnd(10))} ${relativePath} not found at ${ref}`);
      stats.missingUpstream += 1;
      continue;
    }

    const remoteHash = sha256(remoteContent);
    const targetFile = path.join(targetRepo, relativePath);
    const exists = fs.existsSync(targetFile);

    if (!exists) {
      if (!isDryRun) {
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(targetFile, remoteContent, 'utf8');
      }
      console.log(`  ${c.green('✔')} ${c.green('created'.padEnd(10))} ${relativePath}`);
      stats.created += 1;
      nextLockFiles[relativePath] = remoteHash;
      continue;
    }

    const localContent = fs.readFileSync(targetFile, 'utf8');
    const localHash = sha256(localContent);

    if (localHash === remoteHash) {
      console.log(`  ${c.dim('•')} ${c.dim('unchanged'.padEnd(10))} ${relativePath}`);
      stats.unchanged += 1;
      nextLockFiles[relativePath] = localHash;
      continue;
    }

    let classification = classifyLocalFile({
      localHash,
      knownHash: lock.files[relativePath],
      wasCustomization: lock.customizations.includes(relativePath),
    });

    if (adopt && classification !== 'managed' && !force) {
      nextLockFiles[relativePath] = localHash;
      nextCustomizations.delete(relativePath);
      console.log(`  ${c.cyan('✔')} ${c.cyan('adopted'.padEnd(10))} ${relativePath} ${c.dim('(local content recorded as the baseline)')}`);
      stats.adopted += 1;
      continue;
    }

    let provenance = null;
    if (classification === 'unknown' && checkHistory && !localSourceDir && !force) {
      provenance = await findCanonicalProvenance(remote, relativePath, localContent, budget);
      if (provenance.status === 'canonical') {
        classification = 'managed';
        stats.recognizedCanonical += 1;
      } else {
        classification = 'customization';
      }
    } else if (classification === 'unknown') {
      classification = 'customization';
    }

    if (classification === 'customization' && !force) {
      protectedFiles.push(relativePath);
      nextCustomizations.add(relativePath);
      nextLockFiles[relativePath] = localHash;

      const detail =
        provenance && provenance.reason
          ? provenance.reason
          : provenance && provenance.status === 'custom'
            ? 'no published revision matches'
            : 'local edits';
      console.log(`  ${c.yellow('▲')} ${c.yellow('protected'.padEnd(10))} ${relativePath} ${c.dim(`(${detail} - tracked as a customization)`)}`);
      stats.protected += 1;
      continue;
    }

    if (!assumeYes && !isDryRun && !force) {
      const ok = await promptConfirm(`Overwrite locally modified ${relativePath}?`);
      if (!ok) {
        protectedFiles.push(relativePath);
        nextCustomizations.add(relativePath);
        nextLockFiles[relativePath] = localHash;
        console.log(`  ${c.yellow('▲')} ${c.yellow('protected'.padEnd(10))} ${relativePath} ${c.dim('(skipped by user)')}`);
        stats.protected += 1;
        continue;
      }
    }

    if (!isDryRun) {
      const backupDir = path.join(backupRoot, ref.replace(/[^\w.-]+/g, '_'), relativePath);
      fs.mkdirSync(path.dirname(backupDir), { recursive: true });
      fs.writeFileSync(backupDir, localContent, 'utf8');
      fs.writeFileSync(targetFile, remoteContent, 'utf8');
    }

    nextCustomizations.delete(relativePath);

    const note =
      provenance && provenance.status === 'canonical'
        ? ' (recognized as an older canonical revision)'
        : classification === 'customization'
          ? ' (local edits backed up)'
          : '';

    console.log(`  ${c.cyan('✔')} ${c.cyan('updated'.padEnd(10))} ${relativePath}${note ? c.dim(note) : ''}`);
    stats.updated += 1;
    nextLockFiles[relativePath] = remoteHash;
  }

  const agentsMdPath = path.join(targetRepo, 'AGENTS.md');
  if (fs.existsSync(agentsMdPath)) {
    console.log(`  ${c.dim('•')} ${c.dim('preserved'.padEnd(10))} AGENTS.md ${c.dim('(project-specific config left untouched)')}`);
  } else if (options.initAgents) {
    try {
      const template = await fetchRemoteFile(remote, ref, 'AGENTS.md', localSourceDir);
      if (template && !isDryRun) {
        fs.writeFileSync(agentsMdPath, template, 'utf8');
        console.log(`  ${c.green('✔')} ${c.green('created'.padEnd(10))} AGENTS.md ${c.dim('(base template - customize it with your stack)')}`);
        stats.created += 1;
      }
    } catch {
      console.error(`  ${c.yellow('▲')}  ${c.yellow('Could not fetch the AGENTS.md template.')}`);
    }
  } else {
    console.log(`  ${c.dim('ℹ')} ${c.dim('skipped'.padEnd(10))} AGENTS.md not found and --init-agents was not passed.`);
  }

  if (writeManifest && !isDryRun && !unknown.length) {
    const lockPayload = {
      $comment: 'Generated by @gripm/playbook. Do not edit by hand.',
      playbook: remote,
      ref,
      version: manifest && manifest.version ? manifest.version : null,
      stacks,
      syncedAt: new Date().toISOString(),
      files: nextLockFiles,
      customizations: [...nextCustomizations].sort(),
    };
    const lockTarget = path.join(targetRepo, CANONICAL_LOCK_PATH);
    fs.mkdirSync(path.dirname(lockTarget), { recursive: true });
    fs.writeFileSync(lockTarget, `${JSON.stringify(lockPayload, null, 2)}\n`, 'utf8');
    const legacyPath = path.join(targetRepo, LEGACY_LOCK_PATH);
    if (fs.existsSync(legacyPath)) {
      try { fs.unlinkSync(legacyPath); } catch {}
    }
    console.log(`  ${c.green('✔')} ${c.green('lockfile'.padEnd(10))} ${CANONICAL_LOCK_PATH} ${c.dim(`(${Object.keys(nextLockFiles).length} files, ${nextCustomizations.size} customizations)`)}`);
  }

  const rawOrphans = isDryRun ? [] : findOrphanedFiles(targetRepo, files, lock.files);
  let orphans = rawOrphans;
  if (!isDryRun && rawOrphans.length) {
    const { pruned, kept } = pruneOrphanedFiles(targetRepo, rawOrphans, nextCustomizations);
    if (pruned.length) {
      console.log(`  ${c.green('✔')} ${c.green('pruned'.padEnd(10))} ${pruned.length} obsolete file(s): ${pruned.join(', ')}`);
    }
    orphans = kept;
  }

  if (isConsumerPackage && !isDryRun) {
    const cleaned = pruneLegacyScripts(targetRepo, lock.files, nextCustomizations, packageBundleRoot);
    if (cleaned.length) {
      console.log(`  ${c.green('✔')} ${c.green('cleaned'.padEnd(10))} ${cleaned.length} legacy script(s) from scripts/ (running via package)`);
    }
  }

  console.log(`
  ${c.bold('Summary')}
    ${c.dim('created:')}    ${stats.created}
    ${c.dim('updated:')}    ${stats.updated}
    ${c.dim('unchanged:')}  ${stats.unchanged}`);
  if (stats.adopted) console.log(`    ${c.dim('adopted:')}    ${stats.adopted}`);
  if (stats.recognizedCanonical) {
    console.log(`    ${c.dim('canonical:')}  ${stats.recognizedCanonical} ${c.dim('(older revision recognized, updated forward)')}`);
  }
  console.log(`    ${c.dim('protected:')}  ${stats.protected ? c.yellow(stats.protected) : 0}${stats.protected ? c.dim(' (local modifications kept)') : ''}`);
  if (stats.missingUpstream) console.log(`    ${c.dim('missing:')}    ${c.yellow(stats.missingUpstream)} ${c.dim(`(not found upstream at ${ref})`)}`);
  if (budget.remaining < HISTORY_BUDGET) {
    console.log(`    ${c.dim('note:')}       ${c.dim(`provenance lookups used ${HISTORY_BUDGET - budget.remaining}/${HISTORY_BUDGET} requests`)}`);
  }

  if (protectedFiles.length) {
    console.log(`\n  ${c.dim('Files with local changes (protected in .gripm/playbook-lock.json):')}\n${protectedFiles.map((f) => `    ${c.yellow('•')} ${f}`).join('\n')}\n\n  ${c.dim('Re-run with --force to replace them, or --adopt to accept them as baseline.')}`);
  }

  if (orphans.length) {
    console.log(`\n  ${c.yellow('▲')}  ${c.yellow('Obsolete customized framework files retained in .agents/:')}\n${orphans.map((f) => `    ${c.dim('•')} ${f}`).join('\n')}\n  ${c.dim('Review and remove them if no longer needed.')}`);
  }

  if (orphans.length || (!isDryRun && protectedFiles.length)) {
    process.exitCode = 1;
  } else if (stats.missingUpstream) {
    console.log(`\n  ${c.yellow('▲')}  Completed with warnings.\n`);
    process.exitCode = 1;
  } else {
    console.log(`\n  ${c.green('✔')}  ${c.green('Project now carries the canonical framework layer')} ${c.dim(`(${ref})`)}.\n`);
  }

  return { ...stats, protectedFiles, orphans, ref, manifestFound: !!manifest };
}

async function listStacks(remote, sourceDir = null) {
  const { ref } = sourceDir ? { ref: 'local' } : await resolveRef(remote);
  const manifest = await loadManifest(remote, ref, sourceDir);
  const source = manifest && manifest.stacks ? manifest.stacks : FALLBACK_STACKS;
  console.log(`\n  ${c.bold('gripm')} ${c.dim('· Playbook Stack Packs')}\n\n  ${c.dim('➜')}  ${c.dim('Upstream:')}  ${c.cyan(`${remote}@${ref}`)}\n`);
  for (const [name, pack] of Object.entries(source)) {
    const packFiles = Array.isArray(pack) ? pack : pack?.files ?? [];
    const skills = packFiles.filter((f) => f.endsWith('SKILL.md')).map((f) => path.basename(path.dirname(f)));
    console.log(`  • ${c.bold(name.padEnd(10))} ${skills.join(', ') || c.dim('(no skills)')}`);
  }
  console.log(`\n  ${c.dim('Install with:')}  playbook sync --stack <name>\n  ${c.dim('Core only:')}     playbook sync\n`);
}

function parseArgs(argv) {
  const opts = {
    repo: process.cwd(), source: null, tag: null, remote: null,
    stacks: [], initAgents: false, dryRun: false, force: false,
    yes: false, manifest: true, adopt: false, history: true,
    listStacks: false, help: false, installScripts: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case 'sync': break;
      case '--repo': case '-r': opts.repo = path.resolve(next()); break;
      case '--source': case '--from': opts.source = path.resolve(next()); break;
      case '--tag': case '-t': case '--branch': case '-b': opts.tag = next(); break;
      case '--remote': opts.remote = next(); break;
      case '--stack': case '-s': opts.stacks.push(next()); break;
      case '--init-agents': opts.initAgents = true; break;
      case '--install-scripts': opts.installScripts = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--force': opts.force = true; break;
      case '--adopt': opts.adopt = true; break;
      case '--no-history': opts.history = false; break;
      case '--yes': case '-y': opts.yes = true; break;
      case '--no-manifest': opts.manifest = false; break;
      case '--list-stacks': opts.listStacks = true; break;
      case '--help': case '-h': opts.help = true; break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(2);
    }
  }

  return opts;
}

function printUsage() {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').replace(/^ \* ?/gm, ''));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const [subcommand, ...rest] = process.argv.slice(2);
  routeCli(subcommand, rest, (args) => {
    const opts = parseArgs(args);
    if (opts.help) {
      printUsage();
    } else if (opts.listStacks) {
      // --list-stacks keeps its historical remote behaviour; auto-detect arms only sync/init.
      listStacks(opts.remote || DEFAULT_REMOTE, opts.source).catch((err) => {
        console.error('Fatal:', err.message);
        process.exit(2);
      });
    } else {
      runPlaybookSync(opts.repo, opts).catch((err) => {
        console.error('Fatal:', err.message);
        process.exit(2);
      });
    }
  });
}
