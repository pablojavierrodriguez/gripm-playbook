#!/usr/bin/env node

/**
 * Agentic Team Playbook Synchronizer
 *
 * Installs or updates the canonical framework layer (rules, core skills, tooling)
 * into any project, without touching the project layer (AGENTS.md, backlog, code).
 *
 * Architecture principle: Separation of Layers
 *   - Framework layer (synced):   .agents/**, scripts/**, docs/sprints/**
 *   - Project layer (preserved):  AGENTS.md, docs/BACKLOG.md, application code
 *
 * Safety principles
 *   1. Reproducible: syncs from a pinned git ref, not from a moving branch.
 *   2. Non-destructive: a file a human owns is NEVER silently overwritten. It is
 *      recorded as a customization in the lockfile and protected on every
 *      subsequent run until --force.
 *   3. Evidence-based: when there is no lockfile baseline, the sync asks the
 *      upstream history whether the local content is a published revision. An
 *      older canonical file is moved forward; only genuinely modified files are
 *      held back.
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
 *   --adopt            Keep every differing file as-is and record it as the
 *                      baseline to track. Nothing is overwritten.
 *   --dry-run          Report what would change, write nothing
 *   --force            Overwrite customised files
 *   --no-history       Skip the upstream provenance lookup (faster, protects
 *                      anything unrecognised without checking)
 *   --yes              Never prompt
 *   --no-manifest      Do not write the lockfile
 *   --help             Show usage
 *
 * Exit codes: 0 ok · 1 protected files or orphans present · 2 fatal
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_REMOTE = 'pablojavierrodriguez/gripm-playbook';
const DEFAULT_BRANCH = 'main';
const MANIFEST_PATH = '.playbook-manifest.json';
const LOCK_PATH = '.playbook-lock.json';
const FETCH_TIMEOUT_MS = 15_000;
const FETCH_RETRIES = 3;

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
  '.agents/skills/worldclass-product-designer/SKILL.md',
  '.agents/skills/principal-engineer/SKILL.md',
  '.agents/skills/rigorous-qa-auditor/SKILL.md',
  '.agents/skills/code-level-ux-auditor/SKILL.md',
  'scripts/audit-ux-code.cjs',
  'scripts/gate-qa.mjs',
  'scripts/ux-rules.json',
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

// ---------------------------------------------------------------------------
// infra
// ---------------------------------------------------------------------------

const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');

async function fetchText(url, { retries = FETCH_RETRIES } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'user-agent': 'gripm-playbook-sync' },
      });
      if (res.status === 404) return { notFound: true, content: null };
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return { notFound: false, content: await res.text() };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const backoff = 300 * 2 ** (attempt - 1);
        await new Promise((resolve) => { setTimeout(resolve, backoff); });
      }
    }
  }

  throw new Error(`${url} unreachable after ${retries} attempts: ${lastError.message}`);
}

const rawUrl = (remote, ref, file) =>
  `https://raw.githubusercontent.com/${remote}/${ref}/${file}`;

async function fetchRemoteFile(remote, ref, file, sourceDir = null) {
  if (sourceDir) {
    const absPath = path.join(sourceDir, file);
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, 'utf8');
  }
  const { notFound, content } = await fetchText(rawUrl(remote, ref, file));
  return notFound ? null : content;
}

async function resolveRef(remote, requested) {
  if (requested) return { ref: requested, pinned: true };
  const api = `https://api.github.com/repos/${remote}/releases/latest`;
  try {
    const { content } = await fetchText(api, { retries: 2 });
    if (content) {
      const release = JSON.parse(content);
      if (release.tag_name) return { ref: release.tag_name, pinned: true };
    }
  } catch {
    // fall through to the branch default
  }
  return { ref: DEFAULT_BRANCH, pinned: false };
}

// ---------------------------------------------------------------------------
// manifest
// ---------------------------------------------------------------------------

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

function planFiles(manifest, stacks) {
  const core = manifest ? manifest.core : FALLBACK_CORE_FILES;
  const stackSource = manifest && manifest.stacks ? manifest.stacks : FALLBACK_STACKS;

  const files = [...core];
  const unknown = [];

  for (const name of stacks) {
    const pack = stackSource[name];
    if (!pack) {
      unknown.push(name);
      continue;
    }
    files.push(...pack);
  }

  return { files, stackSource, unknown };
}

// ---------------------------------------------------------------------------
// sync
// ---------------------------------------------------------------------------

function printBanner(targetRepo, remote, ref, pinned, stacks) {
  const rows = [
    ['Target', path.resolve(targetRepo)],
    ['Upstream', `${remote}@${ref}${pinned ? '' : ' (unpinned)'}`],
    ['Stack packs', stacks.length ? stacks.join(', ') : '(core only)'],
  ];
  const width = Math.max(28, ...rows.map(([k, v]) => `${k}: ${v}`.length)) + 2;

  console.log('');
  console.log('┌' + '─'.repeat(width + 2) + '┐');
  console.log('│  ⚡ Agentic Team Playbook Sync'.padEnd(width + 3) + '│');
  for (const [key, value] of rows) {
    const line = `  ${key}: ${value}`;
    console.log('│' + line.padEnd(width + 3) + '│');
  }
  console.log('└' + '─'.repeat(width + 2) + '┘');
  console.log('');
}

function readLock(targetRepo) {
  const lockPath = path.join(targetRepo, LOCK_PATH);
  const empty = { playbook: null, ref: null, version: null, files: {}, customizations: [] };
  if (!fs.existsSync(lockPath)) return empty;
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    return {
      playbook: lock.playbook || null,
      ref: lock.ref || null,
      version: lock.version || null,
      files: lock.files || {},
      customizations: Array.isArray(lock.customizations) ? lock.customizations : [],
    };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// canonicity
//
// "Is this local file an older published version, or did a human edit it?"
//
// Answering that requires provenance, not just a hash comparison against the
// current ref. When a project has no lockfile yet — the first sync after
// installing the framework by hand — every file that differs from upstream
// looks identical: a v1 skill that nobody touched and a skill someone heavily
// edited both raise the same flag.
//
// The upstream commit history for the path is the only available evidence, so
// the sync asks it: if the local content matches any published revision of that
// path, it is canonical and safe to move forward. If it matches none, it is a
// local modification and is protected.
// ---------------------------------------------------------------------------

const HISTORY_LIMIT = 25;
const HISTORY_BUDGET = 40;

function makeBudget(limit) {
  let left = limit;
  return {
    take() {
      if (left <= 0) return false;
      left -= 1;
      return true;
    },
    get remaining() { return left; },
  };
}

async function listFileHistory(remote, filePath, limit) {
  const url = `https://api.github.com/repos/${remote}/commits?path=${encodeURIComponent(filePath)}&per_page=${limit}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'user-agent': 'gripm-playbook-sync', accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const commits = await res.json();
    return Array.isArray(commits) ? commits.map((commit) => commit.sha) : null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{status:'canonical'|'custom'|'unknown', sha?:string}>}
 */
export async function findCanonicalProvenance(remote, filePath, localContent, budget = makeBudget(HISTORY_BUDGET)) {
  const revisions = await listFileHistory(remote, filePath, HISTORY_LIMIT);
  if (!revisions) return { status: 'unknown', reason: 'history unavailable' };

  for (const sha of revisions) {
    if (!budget.take()) return { status: 'unknown', reason: 'history budget exhausted' };
    let content = null;
    try {
      content = await fetchRemoteFile(remote, sha, filePath);
    } catch {
      continue;
    }
    if (content !== null && content === localContent) return { status: 'canonical', sha };
  }

  return { status: 'custom' };
}

/**
 * Pure decision table, exported for testing.
 *
 * 'managed'       → safe to move to the upstream revision
 * 'customization' → a human owns this file; never touch it without --force
 * 'unknown'       → no baseline yet, provenance must be resolved upstream
 */
export function classifyLocalFile({ localHash, knownHash, wasCustomization }) {
  if (wasCustomization) return 'customization';
  if (knownHash && knownHash === localHash) return 'managed';
  if (knownHash) return 'customization';
  return 'unknown';
}

/** Files that belong to the framework but are no longer part of the plan. */
export function findOrphanedFiles(targetRepo, plannedFiles, lockFiles = null) {
  const agentsRoot = path.join(targetRepo, '.agents');
  if (!fs.existsSync(agentsRoot)) return [];

  const planned = new Set(plannedFiles);
  const orphans = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      const rel = path.relative(targetRepo, full).split(path.sep).join('/');
      if (lockFiles && typeof lockFiles === 'object' && Object.keys(lockFiles).length > 0) {
        if (lockFiles[rel] && !planned.has(rel)) orphans.push(rel);
      } else {
        if (!planned.has(rel)) orphans.push(rel);
      }
    }
  };

  walk(agentsRoot);
  return orphans;
}

function prompt(question) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(false);
      return;
    }
    process.stdout.write(`${question} [y/N] `);
    process.stdin.once('data', (data) => {
      resolve(/^y(es)?$/i.test(data.toString().trim()));
    });
  });
}

export async function runPlaybookSync(targetRepo = process.cwd(), options = {}) {
  const isLocalSource = !!options.source || (options.remote && fs.existsSync(options.remote) && fs.statSync(options.remote).isDirectory());
  const localSourceDir = options.source ? path.resolve(options.source) : (isLocalSource ? path.resolve(options.remote) : null);
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
    console.log('⚠️  Could not read the remote manifest; falling back to the built-in core list.');
    console.log('');
  }

  const { files, stackSource, unknown } = planFiles(manifest, stacks);

  for (const name of unknown) {
    console.error(`❌ Unknown stack pack "${name}". Available: ${Object.keys(stackSource).join(', ')}`);
  }
  if (unknown.length) process.exitCode = 1;

  const lock = readLock(targetRepo);
  const nextLockFiles = {};
  const nextCustomizations = new Set(lock.customizations);

  const adopt = !!options.adopt;
  const checkHistory = options.history !== false;
  const budget = makeBudget(HISTORY_BUDGET);

  const stats = {
    created: 0, updated: 0, unchanged: 0, adopted: 0,
    protected: 0, recognizedCanonical: 0, missingUpstream: 0,
  };
  const protectedFiles = [];
  const backupRoot = path.join(targetRepo, '.playbook-backups');

  for (const relativePath of files) {
    let remoteContent;
    try {
      remoteContent = await fetchRemoteFile(remote, ref, relativePath, localSourceDir);
    } catch (err) {
      console.error(`  ❌ [Error]      ${relativePath}: ${err.message}`);
      stats.missingUpstream += 1;
      continue;
    }

    if (remoteContent === null) {
      console.error(`  ⚠️  [Upstream]   ${relativePath} not found at ${ref}`);
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
      console.log(`  ✨ [Created]     ${relativePath}`);
      stats.created += 1;
      nextLockFiles[relativePath] = remoteHash;
      continue;
    }

    const localContent = fs.readFileSync(targetFile, 'utf8');
    const localHash = sha256(localContent);

    if (localHash === remoteHash) {
      console.log(`  ➖ [Unchanged]   ${relativePath}`);
      stats.unchanged += 1;
      nextLockFiles[relativePath] = localHash;
      continue;
    }

    // The file differs from upstream. Is it an older canonical revision, or
    // did a human edit it?
    let classification = classifyLocalFile({
      localHash,
      knownHash: lock.files[relativePath],
      wasCustomization: lock.customizations.includes(relativePath),
    });

    // --adopt means "keep what I have, and start tracking it". Nothing that
    // differs is touched, so there is no reason to spend requests on
    // provenance.
    if (adopt && classification !== 'managed' && !force) {
      nextLockFiles[relativePath] = localHash;
      nextCustomizations.delete(relativePath);
      console.log(`  🧩 [Adopted]      ${relativePath} (local content recorded as the baseline)`);
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
        // 'custom' and 'unknown' both fail safe: never touch it silently.
        classification = 'customization';
      }
    } else if (classification === 'unknown') {
      classification = 'customization';
    }

    if (classification === 'customization' && !force) {
      protectedFiles.push(relativePath);
      nextCustomizations.add(relativePath);
      nextLockFiles[relativePath] = localHash;

      const detail = provenance && provenance.reason
        ? provenance.reason
        : provenance && provenance.status === 'custom'
          ? 'no published revision matches'
          : 'local edits';
      console.log(`  🛡️  [Protected]   ${relativePath} (${detail} — tracked as a customization)`);
      stats.protected += 1;
      continue;
    }

    if (!assumeYes && !isDryRun && !force) {
      const ok = await prompt(`  Overwrite locally modified ${relativePath}?`);
      if (!ok) {
        protectedFiles.push(relativePath);
        nextCustomizations.add(relativePath);
        nextLockFiles[relativePath] = localHash;
        console.log(`  🛡️  [Protected]   ${relativePath} (skipped by user)`);
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

    // The human's version is being replaced, so it is no longer a customization.
    nextCustomizations.delete(relativePath);

    const note = provenance && provenance.status === 'canonical'
      ? ' (recognized as an older canonical revision)'
      : classification === 'customization' ? ' (local edits backed up)' : '';

    console.log(`  🔄 [Updated]     ${relativePath}${note}`);
    stats.updated += 1;
    nextLockFiles[relativePath] = remoteHash;
  }

  // --- Project layer: AGENTS.md is never overwritten -----------------------
  const agentsMdPath = path.join(targetRepo, 'AGENTS.md');
  if (fs.existsSync(agentsMdPath)) {
    console.log('  🛡️  [Preserved]   AGENTS.md (project-specific config left untouched)');
  } else if (options.initAgents) {
    try {
      const template = await fetchRemoteFile(remote, ref, 'AGENTS.md', localSourceDir);
      if (template && !isDryRun) {
        fs.writeFileSync(agentsMdPath, template, 'utf8');
        console.log('  ✨ [Created]     AGENTS.md (base template — customise it with your stack)');
        stats.created += 1;
      }
    } catch {
      console.error('  ⚠️  Could not fetch the AGENTS.md template.');
    }
  } else {
    console.log('  ℹ️  [Skipped]     AGENTS.md not found and --init-agents was not passed.');
  }

  // --- Lockfile ------------------------------------------------------------
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
    fs.writeFileSync(path.join(targetRepo, LOCK_PATH), `${JSON.stringify(lockPayload, null, 2)}\n`, 'utf8');
    console.log(`  🔏 [Lockfile]    ${LOCK_PATH} (${Object.keys(nextLockFiles).length} files, ${nextCustomizations.size} customizations)`);
  }

  const orphans = isDryRun ? [] : findOrphanedFiles(targetRepo, files, lock.files);

  console.log('');
  console.log('📊 Summary');
  console.log(`   created:   ${stats.created}`);
  console.log(`   updated:   ${stats.updated}`);
  console.log(`   unchanged: ${stats.unchanged}`);
  if (stats.adopted) console.log(`   adopted:   ${stats.adopted}`);
  if (stats.recognizedCanonical) {
    console.log(`   canonical: ${stats.recognizedCanonical}  (older revision recognized, updated forward)`);
  }
  console.log(`   protected: ${stats.protected}  (local modifications kept)`);
  if (stats.missingUpstream) console.log(`   missing:   ${stats.missingUpstream}  (not found upstream at ${ref})`);
  if (budget.remaining < HISTORY_BUDGET) {
    console.log(`   note:      provenance lookups used ${HISTORY_BUDGET - budget.remaining}/${HISTORY_BUDGET} requests`);
  }

  if (protectedFiles.length) {
    console.log('');
    console.log('   Files a human owns. They are recorded in the lockfile and will');
    console.log('   keep being protected on every future sync:');
    for (const file of protectedFiles) console.log(`     - ${file}`);
    console.log('   Re-run with --force to replace them, or --adopt to accept them as');
    console.log('   the baseline you want to keep updating from.');
  }

  if (orphans.length) {
    console.log('');
    console.log('   ⚠️  Framework files no longer part of the install plan (a previous');
    console.log('      version may have moved them). Nothing was deleted:');
    for (const file of orphans) console.log(`     - ${file}`);
    console.log('   Review and remove them manually if they are obsolete.');
  }

  if (protectedFiles.length || orphans.length) {
    process.exitCode = 1;
  } else if (stats.missingUpstream) {
    console.log('');
    console.log('⚠️  Completed with warnings.');
    process.exitCode = 1;
  } else {
    console.log('');
    console.log(`✅ Project now carries the canonical framework layer (${ref}).`);
  }
  console.log('');

  return { ...stats, protectedFiles, orphans, ref, manifestFound: !!manifest };
}

async function listStacks(remote) {
  const { ref } = await resolveRef(remote);
  const manifest = await loadManifest(remote, ref);
  const source = manifest && manifest.stacks ? manifest.stacks : FALLBACK_STACKS;

  console.log('');
  console.log(`Stack packs available at ${remote}@${ref}:`);
  console.log('');
  for (const [name, files] of Object.entries(source)) {
    const skills = files.filter((f) => f.endsWith('SKILL.md'))
      .map((f) => path.basename(path.dirname(f)));
    console.log(`  ${name.padEnd(10)} ${skills.join(', ') || '(no skills)'}`);
  }
  console.log('');
  console.log('Install with:  node scripts/sync-playbook.mjs --stack <name>');
  console.log('Core only:     node scripts/sync-playbook.mjs');
  console.log('');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    repo: process.cwd(), source: null, tag: null, remote: DEFAULT_REMOTE, stacks: [],
    initAgents: false, dryRun: false, force: false, yes: false,
    manifest: true, adopt: false, history: true,
    listStacks: false, help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case 'sync': break;
      case '--repo': case '-r': opts.repo = path.resolve(next()); break;
      case '--source': case '--from': opts.source = path.resolve(next()); break;
      case '--tag': case '-t': opts.tag = next(); break;
      case '--branch': case '-b': opts.tag = next(); break;
      case '--remote': opts.remote = next(); break;
      case '--stack': case '-s': opts.stacks.push(next()); break;
      case '--init-agents': opts.initAgents = true; break;
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
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]
    .replace(/^\/\*\*?/, '')
    .replace(/^ \* ?/gm, ''));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printUsage();
  } else if (opts.listStacks) {
    listStacks(opts.remote).catch((err) => {
      console.error('Fatal:', err.message);
      process.exit(2);
    });
  } else {
    runPlaybookSync(opts.repo, opts).catch((err) => {
      console.error('Fatal:', err.message);
      process.exit(2);
    });
  }
}