#!/usr/bin/env node

/**
 * validate-manifest.mjs
 *
 * Validates Progressive Web App (PWA) manifest consistency:
 * - Checks existence and valid JSON syntax of webmanifest
 * - Validates required fields (name, short_name, start_url, display)
 * - Verifies physical existence of referenced icons on disk
 * - Checks for maskable icon declaration
 *
 * Exit codes: 0 valid · 1 validation errors · 2 fatal usage error
 */

import fs from 'node:fs';
import path from 'node:path';

function printHeader(title) {
  console.log(`\n  \x1b[1m\x1b[36mgripm · ${title}\x1b[0m\n`);
}

function resolveManifestPath(targetRoot, explicitPath = null) {
  if (explicitPath) {
    const candidate = path.resolve(targetRoot, explicitPath);
    if (fs.existsSync(candidate)) return candidate;
    return null;
  }

  const standardPaths = [
    'public/manifest.webmanifest',
    'public/manifest.json',
    'public/site.webmanifest',
    'manifest.webmanifest',
    'manifest.json',
  ];

  for (const rel of standardPaths) {
    const abs = path.resolve(targetRoot, rel);
    if (fs.existsSync(abs)) return abs;
  }

  return null;
}

export function validateManifest(options = {}) {
  const root = options.root ? path.resolve(options.root) : process.cwd();
  const manifestPath = resolveManifestPath(root, options.manifest);

  const errors = [];
  const warnings = [];

  if (!manifestPath) {
    errors.push(`No PWA manifest found in "${root}". Expected one of: public/manifest.webmanifest, public/manifest.json, public/site.webmanifest, manifest.webmanifest.`);
    return { passed: false, errors, warnings, manifestPath: null };
  }

  let manifest;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(raw);
  } catch (err) {
    errors.push(`Manifest at "${manifestPath}" is not valid JSON: ${err.message}`);
    return { passed: false, errors, warnings, manifestPath };
  }

  // Required fields
  if (!manifest.name || typeof manifest.name !== 'string' || !manifest.name.trim()) {
    errors.push('Manifest is missing required field "name" (or it is empty).');
  }

  if (!manifest.short_name || typeof manifest.short_name !== 'string' || !manifest.short_name.trim()) {
    errors.push('Manifest is missing required field "short_name" (or it is empty).');
  } else if (manifest.short_name.length > 12) {
    warnings.push(`"short_name" ("${manifest.short_name}") is longer than 12 characters and may truncate on mobile home screens.`);
  }

  if (!manifest.start_url || typeof manifest.start_url !== 'string') {
    errors.push('Manifest is missing required field "start_url".');
  }

  const validDisplays = ['standalone', 'fullscreen', 'minimal-ui', 'browser'];
  if (!manifest.display || !validDisplays.includes(manifest.display)) {
    errors.push(`Manifest "display" must be one of: ${validDisplays.join(', ')}. Found: "${manifest.display}".`);
  }

  // Icons validation
  if (!manifest.icons || !Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    errors.push('Manifest must declare a non-empty "icons" array.');
  } else {
    let hasMaskable = false;
    const manifestDir = path.dirname(manifestPath);

    for (let i = 0; i < manifest.icons.length; i++) {
      const icon = manifest.icons[i];
      if (!icon.src) {
        errors.push(`Icon at index ${i} is missing "src".`);
        continue;
      }

      // Check physical existence of icon on disk
      const cleanSrc = icon.src.replace(/^\//, '');
      const candidates = [
        path.resolve(manifestDir, icon.src),
        path.resolve(root, cleanSrc),
        path.resolve(root, 'public', cleanSrc),
      ];

      const exists = candidates.some((cand) => fs.existsSync(cand));
      if (!exists) {
        errors.push(`Icon "${icon.src}" does not exist on disk (checked in manifest dir, root, and public/).`);
      }

      if (icon.purpose && icon.purpose.includes('maskable')) {
        hasMaskable = true;
      }
    }

    if (!hasMaskable) {
      warnings.push('Manifest does not declare any icon with purpose: "maskable" (required for adaptive icons on Android/Chromium).');
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    manifestPath: path.relative(root, manifestPath) || manifestPath,
  };
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('validate-manifest.mjs')) {
  let root = process.cwd();
  let explicitManifest = null;

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--root' && process.argv[i + 1]) {
      root = process.argv[++i];
    } else if (arg.startsWith('--root=')) {
      root = arg.split('=')[1];
    } else if (!arg.startsWith('--') && !explicitManifest) {
      explicitManifest = arg;
    }
  }

  printHeader('PWA Manifest Validator');

  const result = validateManifest({ root, manifest: explicitManifest });

  if (result.manifestPath) {
    console.log(`  \x1b[32m✔\x1b[0m Manifest inspected: \x1b[1m${result.manifestPath}\x1b[0m\n`);
  }

  for (const warn of result.warnings) {
    console.log(`  \x1b[33m▲ WARNING:\x1b[0m ${warn}`);
  }

  for (const err of result.errors) {
    console.log(`  \x1b[31m✖ ERROR:\x1b[0m ${err}`);
  }

  if (!result.passed) {
    console.log(`\n  \x1b[31m✖ PWA validation failed with ${result.errors.length} error(s).\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\n  \x1b[32m✔ PWA manifest and icons are consistent.\x1b[0m\n`);
    process.exit(0);
  }
}
