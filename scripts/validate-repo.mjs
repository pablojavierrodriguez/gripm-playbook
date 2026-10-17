#!/usr/bin/env node

/**
 * scripts/validate-repo.mjs
 *
 * Consistency guardian for the playbook repository itself.
 *
 * The repo ships rules in two places (the JSON catalog and the skill
 * documentation). They drifted once already, silently. This script makes that
 * class of bug impossible to merge.
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

// --- 1. manifest integrity -------------------------------------------------
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
  for (const [name, pack] of Object.entries(manifest.stacks || {})) {
    for (const file of pack.files || []) all.push(file);
  }

  for (const file of all) {
    if (!exists(file)) fail('manifest', `listed in the manifest but missing on disk: ${file}`);
  }

  const coreSkills = (manifest.core || []).filter((f) => f.endsWith('SKILL.md'));
  if (coreSkills.length !== (manifest.coreSkills || []).length) {
    fail('manifest', `coreSkills lists ${(manifest.coreSkills || []).length} entries but core has ${coreSkills.length} SKILL.md files`);
  }

  // --- documentation <-> install manifest -----------------------------------
  //
  // A skill that documents a command the sync never installs leaves the consumer
  // with an instruction it cannot follow: an agent asked to run `npm run gate:qa`
  // in a repo where nothing installed it reports a pass for something that never
  // ran. The shipped layer must be complete on its own.
  checkDocsReferenceInstalledFiles(manifest);

  // FALLBACK_CORE_FILES is used when the remote manifest cannot be fetched, so it
  // is a second source of truth for the same list. Divergence means a consumer
  // behind a proxy installs a different framework than everyone else.
  checkFallbackParity(manifest);

  checkPyramidParity();

  return manifest;
}

/** Maps the human labels used in the skill table to the ids used by the gate. */
const PYRAMID_ALIASES = {
  typecheck: 'validate',
  'typecheck estricto': 'validate',
  'tests headless': 'test',
  'tests unitarios y de integración': 'test',
  'headless tests': 'test',
  'consistencia spec ↔ backlog': 'spec',
  'auditoría estática de ux': 'audit:ux',
  'build de producción': 'build',
};

/**
 * Fails when the QA skill documents blocking steps the gate does not execute.
 *
 * The gate is the only mechanism that can enforce "a step that did not run cannot
 * certify". If the skill declares five blocking steps and the runner knows four,
 * the gap is invisible to every agent reading the documentation - and it is how
 * a skipped step ends up supporting a promotion.
 */
function checkPyramidParity() {
  const skillPath = '.agents/skills/rigorous-qa-auditor/SKILL.md';
  const gatePath = 'scripts/gate-qa.mjs';
  if (!exists(skillPath) || !exists(gatePath)) return;

  // Steps the gate knows how to run, from its own declarative table.
  const gate = read(gatePath);
  const table = gate.match(/const PYRAMID_STEPS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!table) {
    fail('pyramid', `${gatePath} no longer declares PYRAMID_STEPS`);
    return;
  }

  const gateSteps = [...table[1].matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
  const documented = [...read(skillPath).matchAll(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|[^|]*\|\s*(Sí|No)/gm)];

  if (!documented.length) {
    fail('pyramid', `${skillPath} no longer has a parseable pyramid table`);
    return;
  }

  // The regex has exactly two capture groups: the step label and the
  // blocking marker. Destructuring a third would read `undefined` and skip
  // every row, which is how this check silently passed for a whole round.
  for (const [, label, blocks] of documented) {
    if (blocks !== 'Sí') continue;
    const id = PYRAMID_ALIASES[label.trim().toLowerCase()] ?? label.trim().toLowerCase();
    if (!gateSteps.includes(id)) {
      fail(
        'pyramid',
        `${skillPath} declares "${label.trim()}" as blocking, but ${gatePath} does not execute it. A step that never runs cannot block a promotion, and the gap is invisible to anyone reading the docs.`,
      );
    }
  }
}

/**
 * Fails when a core skill documents a shipped path that the manifest does not
 * install. Scoped to code paths (scripts/, docs/) that are documented as
 * runnable, so prose references to a skill's own name are not flagged.
 */
function checkDocsReferenceInstalledFiles(manifest) {
  const installed = new Set([
    ...(manifest.core || []),
    ...Object.values(manifest.stacks || {}).flatMap((pack) => pack.files || []),
  ]);

  const claim = /(?:node\s+)?(scripts\/[A-Za-z0-9._-]+\.(?:mjs|cjs))/g;

  // Scope: the core layer, which is what actually lands in a consumer's repo.
  // CONTRIBUTING.md and AGENTS.md are documentation *of this repository* and
  // legitimately reference tooling that is not part of the installed framework.
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
      // One finding per (doc, target): a command named twice is one defect.
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

/** Fails when the offline fallback core list drifts from the manifest. */
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

// --- 2. rule catalog <-> skill documentation -------------------------------
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

  // reverse direction: an id documented in the skill but absent from the catalog
  for (const match of skill.matchAll(/\[(UX-\d+)\]/g)) {
    if (!catalog.rules.some((rule) => rule.id === match[1])) {
      fail('rules', `${match[1]} is documented in the skill but does not exist in ux-rules.json`);
    }
  }

  if (/file !== 'ui'/.test(read('scripts/audit-ux-code.cjs'))) {
    fail('rules', "audit-ux-code.cjs still excludes the 'ui' directory, which hides findings in shadcn/Radix projects");
  }
}

// --- 3. core must be stack agnostic ---------------------------------------
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

// --- 4. relative markdown links resolve ------------------------------------
function checkLinks() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) files.push(path.relative(ROOT, full));
    }
  };
  walk(ROOT);

  for (const file of files) {
    const content = read(file);
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const clean = target.split('#')[0];
      if (!clean) continue;
      const resolved = path.resolve(path.dirname(path.join(ROOT, file)), clean);
      if (!fs.existsSync(resolved)) fail('links', `${file} links to a missing path: ${target}`);
    }
  }
}

// --- 5. skill frontmatter ---------------------------------------------------
function checkFrontmatter() {
  const dirs = [
    '.agents/skills',
    '.agents/stacks/react/skills',
    '.agents/stacks/mobile/skills',
    '.agents/stacks/pwa/skills',
  ];

  for (const dir of dirs) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const rel = `${dir}/${entry.name}/SKILL.md`;
      if (!exists(rel)) {
        fail('frontmatter', `${dir}/${entry.name}/ has no SKILL.md`);
        continue;
      }
      const content = read(rel);
      if (!content.startsWith('---\n')) {
        fail('frontmatter', `${rel} has no YAML frontmatter`);
        continue;
      }
      const end = content.indexOf('\n---', 4);
      if (end === -1) {
        fail('frontmatter', `${rel} frontmatter is not closed`);
        continue;
      }
      const fm = content.slice(4, end);
      const name = fm.match(/^name:\s*(.+)$/m);
      const description = fm.match(/^description:\s*(.+)$/m);
      if (!name) fail('frontmatter', `${rel} has no "name"`);
      else if (name[1].trim() !== entry.name) {
        fail('frontmatter', `${rel} declares name "${name[1].trim()}" but lives in folder "${entry.name}"`);
      }
      if (!description) fail('frontmatter', `${rel} has no "description"`);
      else if (description[1].trim().length < 40) {
        warn('frontmatter', `${rel} has a very short description; skill triggering depends on it`);
      }
    }
  }
}

// --- 6. status vocabulary consistency --------------------------------------
function checkStatusVocabulary() {
  const banned = [
    { token: 'In Engineering', file: 'docs/sprints/SPRINT_SPEC_TEMPLATE.md' },
    { token: 'Passed QA', file: 'docs/sprints/SPRINT_SPEC_TEMPLATE.md' },
  ];
  for (const { token, file } of banned) {
    if (exists(file) && read(file).includes(token)) {
      fail('status', `${file} still uses the legacy status name "${token}"`);
    }
  }

  if (!exists('.agents/STATE_MACHINE.md')) {
    fail('status', '.agents/STATE_MACHINE.md is missing');
    return;
  }
  const stateMachineText = read('.agents/STATE_MACHINE.md');

  // Every canonical status must appear as a ROW in the state table, not merely
  // somewhere in the file. A substring test passes when the token survives
  // anywhere - in a transition, an invariant or prose - even after the row that
  // defines the status has been deleted.
  const tableRows = [...stateMachineText.matchAll(/^\|\s*\*\*[^|]+\*\*\s*\|\s*`([a-z]+)`\s*\|/gm)].map((m) => m[1]);
  if (!tableRows.length) {
    fail('status', 'STATE_MACHINE.md no longer has a parseable status table');
    return;
  }

  for (const status of CANONICAL_STATUSES) {
    if (!tableRows.includes(status)) {
      fail(
        'status',
        `.agents/STATE_MACHINE.md does not define "${status}" as a row in the status table. A token appearing elsewhere in the file is not a definition.`,
      );
    }
  }

  // And nothing else may be a row: a status invented in the table is a status
  // the rest of the framework does not know how to handle.
  for (const row of tableRows) {
    if (!CANONICAL_STATUSES.includes(row)) {
      fail('status', `STATE_MACHINE.md defines "${row}" as a status, but it is not in the canonical vocabulary`);
    }
  }

  // the backlog must not be modelled as a status
  const stateMachine = stateMachineText;
  if (/\|\s*`backlog`\s*\|/.test(stateMachine)) {
    fail('status', 'STATE_MACHINE.md lists "backlog" as a status. The backlog is the absence of status; refinement is a gate.');
  }

  // The status vocabulary published to consumers must match the canonical one.
  // docs/BACKLOG.md is the document a project copies from, so a status listed
  // there but not defined in the state machine is a status projects will use
  // and nothing will handle.
  const backlogDoc = 'docs/BACKLOG.md';
  if (exists(backlogDoc)) {
    const declared = read(backlogDoc)
      .split('\n')
      .filter((line) => /\*\*Status válidos:\*\*/.test(line) || /^\s*-\s+\*\*Status:\*\*/.test(line))
      .flatMap((line) => [...line.matchAll(/`([a-z]+)`/g)].map((m) => m[1]));

    for (const status of new Set(declared)) {
      if (!CANONICAL_STATUSES.includes(status)) {
        fail(
          'status',
          `${backlogDoc} publishes "${status}" as a valid status, but STATE_MACHINE.md does not define it. A project copying this document would use a status nothing handles.`,
        );
      }
    }
  }

  for (const doc of ['AGENTS.md', '.agents/TEAM_PLAYBOOK.md']) {
    if (!exists(doc)) continue;
    if (!read(doc).includes('STATE_MACHINE.md')) {
      fail('status', `${doc} does not reference .agents/STATE_MACHINE.md - the state table must have a single source of truth`);
    }
  }
}

// --- run -------------------------------------------------------------------
const manifest = checkManifest();
checkRuleParity();
checkCorePurity();
checkLinks();
checkFrontmatter();
checkStatusVocabulary();

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