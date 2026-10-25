/**
 * scripts/lib/sync-classifier.mjs
 *
 * File hashing, local file classification, orphan detection, and lockfile reader.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const CANONICAL_LOCK_PATH = '.gripm/playbook-lock.json';
export const LEGACY_LOCK_PATH = '.playbook-lock.json';
export const LOCK_PATH = CANONICAL_LOCK_PATH;

export const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');

export function classifyLocalFile({ localHash, knownHash, wasCustomization }) {
  if (wasCustomization) return 'customization';
  if (knownHash && knownHash === localHash) return 'managed';
  if (knownHash) return 'customization';
  return 'unknown';
}

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
      } else if (!planned.has(rel)) {
        orphans.push(rel);
      }
    }
  };

  walk(agentsRoot);
  return orphans;
}

export function pruneLegacyScripts(targetRepo, lockFiles = {}, customizations = new Set(), packageBundleRoot = null) {
  const scriptsDir = path.join(targetRepo, 'scripts');
  if (!fs.existsSync(scriptsDir)) return [];
  const removed = [];

  const candidates = [
    'scripts/audit-ux-code.cjs', 'scripts/gate-qa.mjs', 'scripts/gate-review-items.mjs',
    'scripts/check-loc.mjs', 'scripts/ux-rules.json', 'scripts/sync-playbook.mjs',
    'scripts/init.mjs', 'scripts/lib/frontmatter.mjs', 'scripts/lib/terminal.mjs',
    'scripts/lib/adapters.mjs', 'scripts/lib/pyramid.mjs', 'scripts/lib/task-inspection.mjs',
    'scripts/lib/provenance.mjs', 'scripts/lib/sync-classifier.mjs', 'scripts/lib/cli-router.mjs',
    'scripts/lib/doc-checks.mjs', 'scripts/lib/catalog-validator.mjs',
  ];

  const customSet = customizations instanceof Set ? customizations : new Set(customizations || []);

  for (const rel of candidates) {
    if (customSet.has(rel)) continue;
    const full = path.join(targetRepo, rel);
    if (!fs.existsSync(full)) continue;

    let canPrune = false;
    try {
      const localContent = fs.readFileSync(full, 'utf8');
      const localHash = sha256(localContent);

      if (lockFiles && lockFiles[rel] && lockFiles[rel] === localHash) {
        canPrune = true;
      } else if (packageBundleRoot) {
        const canonicalPath = path.join(packageBundleRoot, rel);
        if (fs.existsSync(canonicalPath)) {
          const canonicalHash = sha256(fs.readFileSync(canonicalPath, 'utf8'));
          if (canonicalHash === localHash) {
            canPrune = true;
          }
        }
      }
    } catch {}

    if (!canPrune) continue;

    try {
      fs.unlinkSync(full);
      removed.push(rel);
      pruneEmptyDirs(path.dirname(full), scriptsDir);
    } catch {}
  }

  pruneEmptyDirs(scriptsDir, targetRepo);
  return removed;
}

export function pruneEmptyDirs(dir, stopAt) {
  if (!fs.existsSync(dir) || dir === stopAt) return;
  try {
    const entries = fs.readdirSync(dir);
    if (entries.length === 0) {
      fs.rmdirSync(dir);
      const parent = path.dirname(dir);
      if (parent && parent !== dir && parent !== stopAt) {
        pruneEmptyDirs(parent, stopAt);
      }
    }
  } catch {}
}

export function pruneOrphanedFiles(targetRepo, orphans, customizations = new Set()) {
  const pruned = [];
  const kept = [];
  const agentsRoot = path.join(targetRepo, '.agents');

  for (const rel of orphans) {
    if (customizations.has(rel)) {
      kept.push(rel);
      continue;
    }
    const full = path.join(targetRepo, rel);
    try {
      if (fs.existsSync(full)) {
        fs.unlinkSync(full);
        pruned.push(rel);
        pruneEmptyDirs(path.dirname(full), agentsRoot);
      }
    } catch {
      kept.push(rel);
    }
  }

  return { pruned, kept };
}

export function resolveLockPath(targetRepo) {
  const canonical = path.join(targetRepo, CANONICAL_LOCK_PATH);
  if (fs.existsSync(canonical)) return canonical;
  const legacy = path.join(targetRepo, LEGACY_LOCK_PATH);
  if (fs.existsSync(legacy)) return legacy;
  return canonical;
}

export function readLock(targetRepo) {
  const lockPath = resolveLockPath(targetRepo);
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
      isLegacyPath: lockPath.endsWith(LEGACY_LOCK_PATH),
    };
  } catch {
    return empty;
  }
}

export function planFiles(manifest, stacks, fallbackCore = [], fallbackStacks = {}, options = {}) {
  const core = manifest ? manifest.core : fallbackCore;
  const stackSource = manifest && manifest.stacks ? manifest.stacks : fallbackStacks;

  const files = [...core];
  const unknown = [];

  for (const name of stacks) {
    const pack = stackSource[name];
    if (!pack) {
      unknown.push(name);
      continue;
    }
    const packFiles = Array.isArray(pack) ? pack : pack?.files ?? [];
    files.push(...packFiles);
  }

  const filtered = options.packageMode
    ? files.filter((f) => !f.startsWith('scripts/'))
    : files;

  return { files: filtered, stackSource, unknown };
}
