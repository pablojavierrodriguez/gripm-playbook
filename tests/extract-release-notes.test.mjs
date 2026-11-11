import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  normalizeVersion,
  normalizeLineEndings,
  sanitizeAntiEmDash,
  formatReleaseTitle,
  extractFromReleasesJson,
  extractFromMarkdown,
  extractReleaseNotes,
} from '../scripts/extract-release-notes.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'extract-release-notes.mjs');

function createTempDir(prefix = 'release-notes-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('extract-release-notes unit tests (PLAY-064)', () => {
  describe('sanitization and normalization helpers', () => {
    test('normalizeVersion strips leading v and trims whitespace', () => {
      assert.equal(normalizeVersion('v1.2.3'), '1.2.3');
      assert.equal(normalizeVersion('V2.0.0'), '2.0.0');
      assert.equal(normalizeVersion('  3.4.5  '), '3.4.5');
      assert.equal(normalizeVersion(''), '');
      assert.equal(normalizeVersion(null), '');
      assert.equal(normalizeVersion(undefined), '');
    });

    test('normalizeLineEndings converts CRLF and CR to LF', () => {
      const input = 'Line 1\r\nLine 2\rLine 3\nLine 4';
      const expected = 'Line 1\nLine 2\nLine 3\nLine 4';
      assert.equal(normalizeLineEndings(input), expected);
      assert.equal(normalizeLineEndings(''), '');
      assert.equal(normalizeLineEndings(null), '');
    });

    test('sanitizeAntiEmDash replaces unicode em-dashes and en-dashes with standard hyphen', () => {
      // Use unicode escape sequences to avoid literal em-dash in test source
      const withEmDash = 'Title \u2014 Subtitle and feature \u2014 more details';
      const withEnDash = 'Range 10 \u2013 20 items';
      assert.equal(sanitizeAntiEmDash(withEmDash), 'Title - Subtitle and feature - more details');
      assert.equal(sanitizeAntiEmDash(withEnDash), 'Range 10 - 20 items');

      // Preserves markdown bullet lists across newlines without collapsing lines
      const markdownList = '### Section\n\n- item 1\n- item 2';
      assert.equal(sanitizeAntiEmDash(markdownList), '### Section\n\n- item 1\n- item 2');
    });

    test('formatReleaseTitle ensures standard prefix and hyphenation', () => {
      assert.equal(formatReleaseTitle('Performance Boost', '1.2.0'), 'v1.2.0 - Performance Boost');
      assert.equal(formatReleaseTitle('v1.2.0 - Performance Boost', '1.2.0'), 'v1.2.0 - Performance Boost');
      assert.equal(formatReleaseTitle('[1.2.0] - Performance Boost', '1.2.0'), 'v1.2.0 - Performance Boost');
      assert.equal(formatReleaseTitle('', '1.2.0'), 'v1.2.0');
    });
  });

  describe('extractFromReleasesJson', () => {
    const fixtureArray = [
      {
        id: 'rel-2-0-0',
        version: '2.0.0',
        title: 'v2.0.0 - Major Architecture Overhaul',
        summary: 'Major overhaul description \u2014 new capabilities',
        markdownContent: '## [2.0.0] - 2026-11-08\n\n### Highlights\n- Feature A\n- Feature B',
      },
      {
        id: 'rel-1-9-0',
        version: '1.9.0',
        title: 'v1.9.0 - Maintenance and Fixes',
        summary: 'Minor maintenance release',
        markdownContent: '## [1.9.0] - 2026-10-25\n\n- Fix 1\n- Fix 2',
      },
    ];

    test('extracts specific version from array', () => {
      const result = extractFromReleasesJson(fixtureArray, '1.9.0');
      assert.equal(result.version, '1.9.0');
      assert.equal(result.title, 'v1.9.0 - Maintenance and Fixes');
      assert.ok(result.notes.includes('Fix 1'));
    });

    test('matches version with leading v', () => {
      const result = extractFromReleasesJson(fixtureArray, 'v2.0.0');
      assert.equal(result.version, '2.0.0');
      assert.equal(result.title, 'v2.0.0 - Major Architecture Overhaul');
      assert.ok(result.notes.includes('Feature A'));
    });

    test('defaults to latest release when target version is null or empty', () => {
      const result = extractFromReleasesJson(fixtureArray);
      assert.equal(result.version, '2.0.0');
      assert.equal(result.title, 'v2.0.0 - Major Architecture Overhaul');
    });

    test('extracts from wrapped object { releases: [...] }', () => {
      const wrapped = { releases: fixtureArray };
      const result = extractFromReleasesJson(wrapped, '1.9.0');
      assert.equal(result.version, '1.9.0');
      assert.equal(result.title, 'v1.9.0 - Maintenance and Fixes');
    });

    test('throws when requested version does not exist', () => {
      assert.throws(() => {
        extractFromReleasesJson(fixtureArray, '9.9.9');
      }, /Release version "9\.9\.9" not found/);
    });

    test('sanitizes em-dash in notes and summaries', () => {
      const itemWithEmDash = [
        {
          version: '1.0.0',
          title: 'Release \u2014 Title',
          notes: 'Notes with \u2014 em-dash and \u2013 en-dash.',
        },
      ];
      const result = extractFromReleasesJson(itemWithEmDash, '1.0.0');
      assert.equal(result.title, 'v1.0.0 - Release - Title');
      assert.equal(result.notes, 'Notes with - em-dash and - en-dash.');
    });
  });

  describe('extractFromMarkdown', () => {
    const markdownFixture = `# Project Changelog

All notable changes are documented here.

## [2.1.0] - 2026-11-08 - Automated Releases and Performance
### Added
- Added automated release extraction script.
- Added idempotence checks for CI.

### Fixed
- Fixed CRLF newline handling \u2014 seamless across platforms.

## [2.0.0] - 2026-10-30 - Foundation Release
Initial major version.

## [1.0.0]
Legacy release notes.
`;

    test('extracts specific version from markdown', () => {
      const result = extractFromMarkdown(markdownFixture, '2.1.0');
      assert.equal(result.version, '2.1.0');
      assert.ok(result.title.includes('Automated Releases and Performance'));
      assert.ok(result.notes.includes('Added automated release extraction script'));
      assert.ok(result.notes.includes('Fixed CRLF newline handling - seamless across platforms'));
      assert.ok(!result.notes.includes('Foundation Release'));
    });

    test('matches version with v prefix', () => {
      const result = extractFromMarkdown(markdownFixture, 'v2.0.0');
      assert.equal(result.version, '2.0.0');
      assert.ok(result.notes.includes('Initial major version'));
    });

    test('defaults to latest release when version is null', () => {
      const result = extractFromMarkdown(markdownFixture);
      assert.equal(result.version, '2.1.0');
      assert.ok(result.title.includes('Automated Releases and Performance'));
    });

    test('extracts header without title or date cleanly', () => {
      const result = extractFromMarkdown(markdownFixture, '1.0.0');
      assert.equal(result.version, '1.0.0');
      assert.ok(result.notes.includes('Legacy release notes'));
    });

    test('throws when version is not in markdown document', () => {
      assert.throws(() => {
        extractFromMarkdown(markdownFixture, '3.0.0');
      }, /Release version "3\.0\.0" not found/);
    });
  });

  describe('extractReleaseNotes end-to-end sandbox', () => {
    test('extracts from backlog/releases.json in sandbox', () => {
      const sandbox = createTempDir('sandbox-releases-json-');
      const backlogDir = path.join(sandbox, 'backlog');
      fs.mkdirSync(backlogDir, { recursive: true });

      const releasesData = [
        {
          version: '1.5.0',
          title: 'v1.5.0 - Sandbox Feature Release',
          markdownContent: '## [1.5.0]\n\nDelivered value in sandbox.',
        },
      ];
      fs.writeFileSync(path.join(backlogDir, 'releases.json'), JSON.stringify(releasesData, null, 2), 'utf8');
      fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify({ version: '1.5.0' }), 'utf8');

      const outDir = path.join(sandbox, 'dist-release');
      const result = extractReleaseNotes({
        repoDir: sandbox,
        outDir,
      });

      assert.equal(result.version, '1.5.0');
      assert.equal(result.title, 'v1.5.0 - Sandbox Feature Release');
      assert.ok(fs.existsSync(path.join(outDir, 'release-title.txt')));
      assert.ok(fs.existsSync(path.join(outDir, 'release-notes.txt')));

      const titleContent = fs.readFileSync(path.join(outDir, 'release-title.txt'), 'utf8').trim();
      const notesContent = fs.readFileSync(path.join(outDir, 'release-notes.txt'), 'utf8').trim();

      assert.equal(titleContent, 'v1.5.0 - Sandbox Feature Release');
      assert.ok(notesContent.includes('Delivered value in sandbox.'));

      fs.rmSync(sandbox, { recursive: true, force: true });
    });

    test('extracts from docs/RELEASE_NOTES.md in sandbox', () => {
      const sandbox = createTempDir('sandbox-release-notes-md-');
      const docsDir = path.join(sandbox, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });

      const mdContent = `## [3.2.1] - 2026-11-08 - Bugfix Update\n\nFixed critical edge case.`;
      fs.writeFileSync(path.join(docsDir, 'RELEASE_NOTES.md'), mdContent, 'utf8');

      const result = extractReleaseNotes({
        repoDir: sandbox,
        version: '3.2.1',
      });

      assert.equal(result.version, '3.2.1');
      assert.ok(result.title.includes('Bugfix Update'));
      assert.ok(fs.existsSync(path.join(sandbox, 'release-title.txt')));
      assert.ok(fs.existsSync(path.join(sandbox, 'release-notes.txt')));

      fs.rmSync(sandbox, { recursive: true, force: true });
    });

    test('CLI runner exits 0 and writes output files', () => {
      const sandbox = createTempDir('sandbox-cli-');
      fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify({ version: '1.0.5' }), 'utf8');
      fs.writeFileSync(path.join(sandbox, 'RELEASE_NOTES.md'), '## [1.0.5] - Initial Release\n\nFirst release.', 'utf8');

      const proc = spawnSync(process.execPath, [SCRIPT_PATH, '1.0.5'], {
        cwd: sandbox,
        encoding: 'utf8',
      });

      assert.equal(proc.status, 0, `CLI failed with stderr: ${proc.stderr}`);
      assert.ok(proc.stdout.includes('✔ Extracted release notes'));
      assert.ok(fs.existsSync(path.join(sandbox, 'release-title.txt')));
      assert.ok(fs.existsSync(path.join(sandbox, 'release-notes.txt')));

      fs.rmSync(sandbox, { recursive: true, force: true });
    });

    test('CLI runner exits 0 on --help', () => {
      const proc = spawnSync(process.execPath, [SCRIPT_PATH, '--help'], {
        encoding: 'utf8',
      });
      assert.equal(proc.status, 0);
      assert.ok(proc.stdout.includes('Usage:'));
    });

    test('CLI runner exits 1 on missing version', () => {
      const sandbox = createTempDir('sandbox-cli-fail-');
      fs.writeFileSync(path.join(sandbox, 'RELEASE_NOTES.md'), '## [1.0.0]\nNotes.', 'utf8');

      const proc = spawnSync(process.execPath, [SCRIPT_PATH, '9.9.9'], {
        cwd: sandbox,
        encoding: 'utf8',
      });
      assert.equal(proc.status, 1);
      assert.ok(proc.stderr.includes('Extraction failed'));

      fs.rmSync(sandbox, { recursive: true, force: true });
    });
  });
});
