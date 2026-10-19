/**
 * scripts/lib/provenance.mjs
 *
 * Remote fetching, ref resolution, and upstream commit history provenance checks.
 */

import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_BRANCH = 'main';
export const FETCH_TIMEOUT_MS = 15_000;
export const FETCH_RETRIES = 3;
export const HISTORY_LIMIT = 25;
export const HISTORY_BUDGET = 40;

export function makeBudget(limit = HISTORY_BUDGET) {
  let left = limit;
  return {
    take() {
      if (left <= 0) return false;
      left -= 1;
      return true;
    },
    get remaining() {
      return left;
    },
  };
}

export async function fetchText(url, { retries = FETCH_RETRIES } = {}) {
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
        await new Promise((resolve) => {
          setTimeout(resolve, backoff);
        });
      }
    }
  }

  throw new Error(`${url} unreachable after ${retries} attempts: ${lastError.message}`);
}

export const rawUrl = (remote, ref, file) => `https://raw.githubusercontent.com/${remote}/${ref}/${file}`;

export async function fetchRemoteFile(remote, ref, file, sourceDir = null) {
  if (sourceDir) {
    const absPath = path.join(sourceDir, file);
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, 'utf8');
  }
  const { notFound, content } = await fetchText(rawUrl(remote, ref, file));
  return notFound ? null : content;
}

export async function resolveRef(remote, requested) {
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

export async function listFileHistory(remote, filePath, limit = HISTORY_LIMIT) {
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
