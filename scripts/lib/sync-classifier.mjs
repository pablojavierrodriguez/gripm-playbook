/**
 * scripts/lib/sync-classifier.mjs
 *
 * File hashing, local file classification, orphan detection, and lockfile reader.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const LOCK_PATH = '.playbook-lock.json';

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

export function readLock(targetRepo) {
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

export function planFiles(manifest, stacks, fallbackCore = [], fallbackStacks = {}) {
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

  return { files, stackSource, unknown };
}
