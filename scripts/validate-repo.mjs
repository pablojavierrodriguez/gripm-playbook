#!/usr/bin/env node

/**
 * scripts/validate-repo.mjs
 *
 * Consistency guardian for the playbook repository itself.
 *
 * Checks:
 *   1. Every file listed in .playbook-manifest.json exists.
 *   2. Every UX rule id exists in the catalog AND is documented in the skill,
 *      with matching title and severity. (anti-divergence)
 *   3. The core layer contains no references to a specific product or stack.
 *   4. Every relative Markdown link resolves to an existing file.
 *   5. Every SKILL.md has valid frontmatter with a name and description.
 *   6. Status vocabulary is consistent across the canonical documents.
 *
 * Exit codes: 0 ok · 1 validation failed · 2 fatal
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLocalCatalog } from './lib/catalog-validator.mjs';
import {
  checkMarkdownLinks,
  checkSkillFrontmatter,
  validateStatusVocabulary,
} from './lib/doc-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CANONICAL_STATUSES = ['ideas', 'draft', 'blocked', 'doing', 'review', 'ready', 'done', 'dismissed'];
const FORBIDDEN_IN_CORE = [
  'YourApp',
  'admin-portal',
  'formatAmount',
  'invariantValid',
  'credit_card_view_mode',
];

const errors = [];
const warnings = [];

const fail = (check, message) => errors.push(`[${check}] ${message}`);
const warn = (check, message) => warnings.push(`[${check}] ${message}`);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/** Maps the human labels used in the skill table to the ids used by the gate. */
const PYRAMID_ALIASES = {
  // English labels (current canonical wording of the QA skill).
  'strict typecheck': 'validate',
  typecheck: 'validate',
  'headless tests': 'test',
  'tests headless': 'test',
  'spec - backlog consistency': 'spec',
  'static ux audit': 'audit:ux',
  'production build': 'build',
  // Spanish labels (legacy wording, kept so older snapshots still validate).
  'typecheck estricto': 'validate',
  'tests unitarios y de integración': 'test',
  'consistencia spec ↔ backlog': 'spec',
  'auditoría estática de ux': 'audit:ux',
  'build de producción': 'build',
};

function checkManifest() {
  if (!exists('.playbook-manifest.json')) {
    fail('manifest', '.playbook-manifest.json is missing');
    return null;
  }

  let manifest;
  try {
    manifest = JSON.parse(read('.playbook-manifest.json'));
  } catch (err) {
    fail('manifest', `.playbook-manifest.json is not valid JSON: ${err.message}`);
    return null;
  }

  const all = [...(manifest.core || [])];
  for (const [, pack] of Object.entries(manifest.stacks || {})) {
    for (const file of pack.files || []) all.push(file);
  }

  for (const file of all) {
    if (!exists(file)) fail('manifest', `listed in the manifest but missing on disk: ${file}`);
  }

  const coreSkills = (manifest.core || []).filter((f) => f.endsWith('SKILL.md'));
  if (coreSkills.length !== (manifest.coreSkills || []).length) {
    fail('manifest', `coreSkills lists ${(manifest.coreSkills || []).length} entries but core has ${coreSkills.length} SKILL.md files`);
  }

  checkDocsReferenceInstalledFiles(manifest);
  checkFallbackParity(manifest);
  checkPyramidParity();

  return manifest;
}

function checkPyramidParity() {
  const skillPath = '.agents/skills/qa-auditor/SKILL.md';
  const gatePath = 'scripts/gate-qa.mjs';
  if (!exists(skillPath) || !exists(gatePath)) return;

  const gate = read(gatePath);
  const table = gate.match(/const PYRAMID_STEPS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!table) {
    fail('pyramid', `${gatePath} no longer declares PYRAMID_STEPS`);
    return;
  }

  const gateSteps = [...table[1].matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
  const documented = [...read(skillPath).matchAll(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|[^|]*\|\s*(Sí|Yes)/gm)];

  if (!documented.length) {
    fail('pyramid', `${skillPath} no longer has a parseable pyramid table`);
    return;
  }

  for (const [, label, blocks] of documented) {
    if (blocks !== 'Sí' && blocks !== 'Yes') continue;
    const id = PYRAMID_ALIASES[label.trim().toLowerCase()] ?? label.trim().toLowerCase();
    if (!gateSteps.includes(id)) {
      fail(
        'pyramid',
        `${skillPath} declares "${label.trim()}" as blocking, but ${gatePath} does not execute it. A step that never runs cannot block a promotion, and the gap is invisible to anyone reading the docs.`,
      );
    }
  }
}

function checkDocsReferenceInstalledFiles(manifest) {
  const installed = new Set([
    ...(manifest.core || []),
    ...Object.values(manifest.stacks || {}).flatMap((pack) => pack.files || []),
  ]);

  const claim = /(?:node\s+)?(scripts\/[A-Za-z0-9._-]+\.(?:mjs|cjs))/g;

  const docs = [
    '.agents/TEAM_PLAYBOOK.md',
    '.agents/STATE_MACHINE.md',
    '.agents/rules/git-workflow.md',
    ...fs.readdirSync(path.join(ROOT, '.agents/skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `.agents/skills/${entry.name}/SKILL.md`),
  ];

  const reported = new Set();
  for (const doc of docs) {
    if (!exists(doc)) continue;
    for (const match of read(doc).matchAll(claim)) {
      const target = match[1];
      if (installed.has(target)) continue;
      const key = `${doc}::${target}`;
      if (reported.has(key)) continue;
      reported.add(key);
      fail(
        'manifest',
        `${doc} tells the reader to run "${target}", but the manifest does not install it. A consumer would be instructed to run a command that does not exist in their repo.`,
      );
    }
  }
}

function checkFallbackParity(manifest) {
  const fallbackPath = 'scripts/sync-playbook.mjs';
  if (!exists(fallbackPath)) return;

  const source = read(fallbackPath);
  const block = source.match(/FALLBACK_CORE_FILES\s*=\s*\[([\s\S]*?)\]/);
  if (!block) {
    fail('manifest', `${fallbackPath} no longer declares FALLBACK_CORE_FILES`);
    return;
  }

  const fallback = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const core = manifest.core || [];

  for (const file of core) {
    if (!fallback.includes(file)) {
      fail('manifest', `${file} is in the manifest but missing from FALLBACK_CORE_FILES; offline syncs would install a smaller framework`);
    }
  }
  for (const file of fallback) {
    if (!core.includes(file)) {
      fail('manifest', `${file} is in FALLBACK_CORE_FILES but not in the manifest`);
    }
  }
}

function checkRuleParity() {
  if (!exists('scripts/ux-rules.json')) {
    fail('rules', 'scripts/ux-rules.json is missing');
    return;
  }

  const catalog = JSON.parse(read('scripts/ux-rules.json'));
  const skillPath = '.agents/skills/code-level-ux-auditor/SKILL.md';
  if (!exists(skillPath)) {
    fail('rules', `${skillPath} is missing`);
    return;
  }
  const skill = read(skillPath);

  for (const rule of catalog.rules) {
    const heading = new RegExp(`###\\s*\\d+\\.\\s*\\[${rule.id}\\]\\s*·\\s*${rule.severity}\\s*·`);
    if (!heading.test(skill)) {
      fail('rules', `${rule.id} ("${rule.title}") is not documented in ${skillPath} with severity ${rule.severity}`);
      continue;
    }
    if (!skill.includes(rule.title)) {
      fail('rules', `${rule.id} title mismatch. Catalog: "${rule.title}". Check the documented heading text.`);
    }
    if (!rule.fix) fail('rules', `${rule.id} has no "fix" - the skill checklist depends on it`);
    if (!rule.signature) fail('rules', `${rule.id} has no "signature"`);
    if (!rule.impact) warn('rules', `${rule.id} has no "impact"`);
  }

  for (const match of skill.matchAll(/\[(UX-\d+)\]/g)) {
    if (!catalog.rules.some((rule) => rule.id === match[1])) {
      fail('rules', `${match[1]} is documented in the skill but does not exist in ux-rules.json`);
    }
  }

  if (/file !== 'ui'/.test(read('scripts/audit-ux-code.cjs'))) {
    fail('rules', "audit-ux-code.cjs still excludes the 'ui' directory, which hides findings in shadcn/Radix projects");
  }
}

function checkCorePurity() {
  const coreFiles = [
    '.agents/TEAM_PLAYBOOK.md',
    '.agents/STATE_MACHINE.md',
    '.agents/rules/git-workflow.md',
    ...fs.readdirSync(path.join(ROOT, '.agents/skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `.agents/skills/${entry.name}/SKILL.md`),
  ];

  for (const file of coreFiles) {
    if (!exists(file)) {
      warn('core', `missing: ${file}`);
      continue;
    }
    const content = read(file);
    for (const token of FORBIDDEN_IN_CORE) {
      if (content.includes(token)) {
        fail('core', `${file} references "${token}" - the core layer must stay stack and product agnostic. Move it to .agents/stacks/<tech>/ or genericise it.`);
      }
    }
  }

  for (const file of ['.agents/skills/pm-orchestrator/SKILL.md', '.agents/skills/principal-engineer/SKILL.md']) {
    if (exists(file) && /\bSupabase\b/.test(read(file))) {
      fail('core', `${file} prescribes Supabase. The core must describe the authorization layer generically and defer to the project's own rules.`);
    }
  }
}

export function checkStatusVocabulary(root = ROOT) {
  return validateStatusVocabulary(root, CANONICAL_STATUSES, root === ROOT ? fail : null);
}

export function checkLocalCatalog(root = ROOT) {
  return validateLocalCatalog(root, ROOT, fail);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = checkManifest();
  checkRuleParity();
  checkCorePurity();
  checkMarkdownLinks(ROOT, fail);
  checkSkillFrontmatter(ROOT, fail, warn);
  checkStatusVocabulary(ROOT);
  checkLocalCatalog(ROOT);

  console.log('');
  console.log('=====================================================');
  console.log('Playbook Repository Validator');
  console.log('=====================================================');

  if (warnings.length) {
    console.log('');
    for (const message of warnings) console.log(`⚠️  ${message}`);
  }

  if (errors.length) {
    console.log('');
    for (const message of errors) console.log(`❌ ${message}`);
    console.log('');
    console.log(`${errors.length} error(s), ${warnings.length} warning(s).`);
    console.log('=====================================================');
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log(`✅ Repository is consistent.${manifest ? ` Manifest v${manifest.version}.` : ''}`);
  console.log('=====================================================');
  console.log('');
}