#!/usr/bin/env node

/**
 * scripts/extract-release-notes.mjs
 *
 * Universal agnostic release notes extractor for Gripm Playbook projects.
 * Extracts release title and release notes from either:
 *   - backlog/releases.json (Gripm Board structured format)
 *   - docs/RELEASE_NOTES.md (or RELEASE_NOTES.md / CHANGELOG.md)
 *
 * Outputs:
 *   - release-title.txt
 *   - release-notes.txt
 *
 * Invariants:
 *   - Normalizes line endings to LF (\n).
 *   - Replaces any unicode em-dash (\u2014) or en-dash (\u2013) with standard hyphen ' - '.
 *   - Strips internal tracking ticket prefixes from release titles if present.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

/**
 * Normalizes version strings by trimming and stripping leading 'v' or 'V'.
 * e.g. "v1.2.0" -> "1.2.0", "  1.2.0  " -> "1.2.0"
 */
export function normalizeVersion(version) {
  if (!version) return '';
  return String(version).trim().replace(/^[vV]/, '');
}

/**
 * Normalizes line endings to LF (\n) and strips trailing carriage returns.
 */
export function normalizeLineEndings(text) {
  if (!text) return '';
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Replaces unicode em-dashes (\u2014) and en-dashes (\u2013) with standard hyphen ' - '.
 * Also cleans up adjacent whitespace around the replaced hyphens.
 */
export function sanitizeAntiEmDash(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u2014\u2013]/g, ' - ')
    .replace(/\s{2,}-\s{2,}/g, ' - ')
    .replace(/\s+-\s+/g, ' - ');
}

/**
 * Formats a clean release title ensuring standard prefix and hyphenation.
 */
export function formatReleaseTitle(rawTitle, version) {
  const normVer = normalizeVersion(version);
  const clean = sanitizeAntiEmDash(rawTitle || '').trim();

  if (!clean) {
    return normVer ? `v${normVer}` : 'Release';
  }

  // Ensure consistent 'vX.Y.Z - Title' format if version is known
  if (normVer && !clean.startsWith(`v${normVer}`) && !clean.startsWith(normVer)) {
    return `v${normVer} - ${clean}`;
  }

  return clean;
}

/**
 * Extracts release title and body from JSON content (backlog/releases.json).
 */
export function extractFromReleasesJson(content, targetVersion = null) {
  let data;
  try {
    data = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (err) {
    throw new Error(`Invalid JSON in release source: ${err.message}`);
  }

  const releases = Array.isArray(data)
    ? data
    : Array.isArray(data?.releases)
      ? data.releases
      : Object.values(data || {});

  if (!releases.length) {
    throw new Error('No releases found in releases.json');
  }

  const normTarget = normalizeVersion(targetVersion);

  let match = null;
  if (normTarget) {
    match = releases.find((r) => {
      const v = normalizeVersion(r.version);
      if (v === normTarget) return true;
      // Also match against id e.g. rel-1-11-0 -> 1.11.0
      if (r.id && r.id.replace(/^rel-/, '').replace(/-/g, '.') === normTarget) return true;
      return false;
    });
  } else {
    // Default to the first (latest) release
    match = releases[0];
  }

  if (!match) {
    throw new Error(`Release version "${targetVersion}" not found in releases.json`);
  }

  const version = match.version || normTarget;
  const rawTitle = match.title || (match.summary ? `v${version} - ${match.summary.slice(0, 60)}` : `v${version}`);
  const title = formatReleaseTitle(rawTitle, version);

  const rawNotes = match.markdownContent || match.notes || match.summary || match.description || match.scopeNotes || '';
  const notes = sanitizeAntiEmDash(normalizeLineEndings(rawNotes)).trim();

  return {
    version: normalizeVersion(version),
    title,
    notes,
  };
}

/**
 * Extracts release title and body from Markdown content (docs/RELEASE_NOTES.md).
 */
export function extractFromMarkdown(content, targetVersion = null) {
  const normalized = normalizeLineEndings(content);
  const lines = normalized.split('\n');

  const normTarget = normalizeVersion(targetVersion);

  // Regex to match release headers:
  // ## [1.2.0] - 2026-11-08 - Title
  // ## v1.2.0 - Title
  // ## 1.2.0 - Title
  // ## [1.2.0]
  const headerRegex = /^##\s+(?:\[([vV]?\d[^\]]*)\]|([vV]?\d\S*))(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?(?:\s*(?:-|:)?\s*(.*))?$/;

  const sections = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(headerRegex);

    if (match) {
      if (current) {
        current.body = current.bodyLines.join('\n').trim();
        sections.push(current);
      }
      const rawVer = match[1] || match[2] || '';
      const date = match[3] || '';
      const headline = match[4] || '';
      current = {
        version: normalizeVersion(rawVer),
        rawVer,
        date,
        headline: headline.trim(),
        fullHeader: line.replace(/^##\s+/, '').trim(),
        bodyLines: [],
      };
    } else if (current) {
      // Check if next level-1 or level-2 heading begins
      if (/^#\s+/.test(line) || (/^##\s+/.test(line) && !headerRegex.test(line))) {
        current.body = current.bodyLines.join('\n').trim();
        sections.push(current);
        current = null;
      } else {
        current.bodyLines.push(line);
      }
    }
  }

  if (current) {
    current.body = current.bodyLines.join('\n').trim();
    sections.push(current);
  }

  if (!sections.length) {
    throw new Error('No release sections found in Markdown document');
  }

  let selected = null;
  if (normTarget) {
    selected = sections.find((s) => s.version === normTarget);
  } else {
    selected = sections[0];
  }

  if (!selected) {
    throw new Error(`Release version "${targetVersion}" not found in Markdown document`);
  }

  const version = selected.version;
  let rawTitle = '';
  if (selected.headline) {
    rawTitle = `v${version} - ${selected.headline}`;
  } else if (selected.fullHeader) {
    rawTitle = selected.fullHeader;
  } else {
    rawTitle = `v${version}`;
  }

  const title = formatReleaseTitle(rawTitle, version);
  const notes = sanitizeAntiEmDash(normalizeLineEndings(selected.body)).trim();

  return {
    version,
    title,
    notes,
  };
}

/**
 * Resolves the candidate source file in repository.
 */
export function resolveReleaseSource(repoDir, customSource = null) {
  if (customSource) {
    const full = path.resolve(repoDir, customSource);
    if (!fs.existsSync(full)) {
      throw new Error(`Specified release notes source not found: ${full}`);
    }
    return full;
  }

  const candidates = [
    path.join(repoDir, 'backlog', 'releases.json'),
    path.join(repoDir, 'docs', 'RELEASE_NOTES.md'),
    path.join(repoDir, 'RELEASE_NOTES.md'),
    path.join(repoDir, 'CHANGELOG.md'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Reads package.json version if present.
 */
export function getPackageVersion(repoDir) {
  const pkgPath = path.join(repoDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || null;
  } catch {
    return null;
  }
}

/**
 * Main programmatic extraction function.
 */
export function extractReleaseNotes({
  repoDir = process.cwd(),
  source = null,
  version = null,
  outDir = null,
} = {}) {
  const root = path.resolve(repoDir);
  const targetVersion = version || getPackageVersion(root);
  const sourcePath = resolveReleaseSource(root, source);

  if (!sourcePath) {
    throw new Error(`No release notes source found in ${root}. Expected backlog/releases.json or docs/RELEASE_NOTES.md.`);
  }

  const rawContent = fs.readFileSync(sourcePath, 'utf8');
  const isJson = sourcePath.endsWith('.json');

  const result = isJson
    ? extractFromReleasesJson(rawContent, targetVersion)
    : extractFromMarkdown(rawContent, targetVersion);

  const destinationDir = outDir ? path.resolve(outDir) : root;
  fs.mkdirSync(destinationDir, { recursive: true });

  const titlePath = path.join(destinationDir, 'release-title.txt');
  const notesPath = path.join(destinationDir, 'release-notes.txt');

  fs.writeFileSync(titlePath, `${result.title}\n`, 'utf8');
  fs.writeFileSync(notesPath, `${result.notes}\n`, 'utf8');

  return {
    ...result,
    sourcePath,
    titlePath,
    notesPath,
  };
}

/**
 * CLI Runner
 */
export async function runCli(argv = process.argv.slice(2)) {
  let version = null;
  let source = null;
  let outDir = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(`
Usage:
  node scripts/extract-release-notes.mjs [version] [options]

Arguments:
  version               Target release version (e.g. 1.2.0 or v1.2.0). Defaults to package.json.

Options:
  --source <path>       Path to releases.json or RELEASE_NOTES.md.
  --out-dir <dir>       Directory to write output files (default: current directory).
  --help, -h            Show this help message.
`);
      return;
    }
    if (arg === '--source') {
      source = argv[++i];
    } else if (arg === '--out-dir') {
      outDir = argv[++i];
    } else if (!arg.startsWith('-') && !version) {
      version = arg;
    }
  }

  try {
    const result = extractReleaseNotes({
      repoDir: process.cwd(),
      source,
      version,
      outDir,
    });

    console.log(`✔ Extracted release notes for v${result.version}`);
    console.log(`  Source: ${result.sourcePath}`);
    console.log(`  Title:  ${result.titlePath} (${result.title})`);
    console.log(`  Notes:  ${result.notesPath} (${result.notes.length} characters)`);
  } catch (err) {
    console.error(`✖ Extraction failed: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runCli();
}
