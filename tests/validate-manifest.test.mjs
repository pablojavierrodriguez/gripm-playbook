import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateManifest } from '../.agents/stacks/pwa/skills/pwa-assets-audit/scripts/validate-manifest.mjs';

function createTempDir(prefix = 'pwa-manifest-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('PWA Manifest Validator (PLAY-042)', () => {
  test('fails when no manifest is found in project', () => {
    const dir = createTempDir();
    const result = validateManifest({ root: dir });
    assert.equal(result.passed, false);
    assert.match(result.errors[0], /No PWA manifest found/);
  });

  test('fails on invalid JSON syntax', () => {
    const dir = createTempDir();
    fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'public', 'manifest.webmanifest'), '{ invalid json ');
    const result = validateManifest({ root: dir });
    assert.equal(result.passed, false);
    assert.match(result.errors[0], /not valid JSON/);
  });

  test('fails on missing required fields', () => {
    const dir = createTempDir();
    fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'public', 'manifest.webmanifest'),
      JSON.stringify({ short_name: 'App' }),
    );
    const result = validateManifest({ root: dir });
    assert.equal(result.passed, false);
    assert.ok(result.errors.some((e) => e.includes('"name"')));
    assert.ok(result.errors.some((e) => e.includes('"start_url"')));
    assert.ok(result.errors.some((e) => e.includes('"display"')));
    assert.ok(result.errors.some((e) => e.includes('"icons"')));
  });

  test('validates referenced icons existence on disk', () => {
    const dir = createTempDir();
    fs.mkdirSync(path.join(dir, 'public', 'icons'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'public', 'icons', 'icon-192.png'), 'fake-png');

    fs.writeFileSync(
      path.join(dir, 'public', 'manifest.webmanifest'),
      JSON.stringify({
        name: 'My PWA App',
        short_name: 'App',
        start_url: '/',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-missing.png', sizes: '512x512', type: 'image/png' },
        ],
      }),
    );
    const result = validateManifest({ root: dir });
    assert.equal(result.passed, false);
    assert.ok(result.errors.some((e) => e.includes('icon-missing.png')));
  });

  test('passes on fully valid PWA manifest with existing icons', () => {
    const dir = createTempDir();
    fs.mkdirSync(path.join(dir, 'public', 'icons'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'public', 'icons', 'icon-192.png'), 'fake-png');
    fs.writeFileSync(path.join(dir, 'public', 'icons', 'icon-512.png'), 'fake-png');

    fs.writeFileSync(
      path.join(dir, 'public', 'manifest.webmanifest'),
      JSON.stringify({
        name: 'My PWA App',
        short_name: 'App',
        start_url: '/',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      }),
    );
    const result = validateManifest({ root: dir });
    assert.equal(result.passed, true);
    assert.equal(result.errors.length, 0);
  });
});
