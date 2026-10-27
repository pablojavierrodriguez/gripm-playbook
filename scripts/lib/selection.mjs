/**
 * scripts/lib/selection.mjs
 *
 * Catalog, validation, and resolution for modular component selection
 * (agent skills, package.json scripts, documentation templates).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const PACKAGE_ROOT = path.resolve(path.dirname(__filename), '..', '..');

export const DEFAULT_CORE_SKILLS = [
  'pm-orchestrator',
  'market-researcher',
  'product-designer',
  'principal-engineer',
  'qa-auditor',
  'code-level-ux-auditor',
];

export const VALID_SCRIPTS = [
  'gate:qa',
  'gate:review',
  'audit:ux',
  'audit:ux:strict',
  'check:loc',
  'validate:commit',
];

export const SCRIPT_DEFINITIONS = {
  'gate:qa': 'playbook gate',
  'gate:review': 'playbook review',
  'audit:ux': 'playbook audit',
  'audit:ux:strict': 'playbook audit --strict',
  'check:loc': 'playbook check-loc',
  'validate:commit': 'playbook validate-commit',
};

export const VALID_DOCS = [
  'domain',
  'sprint-spec',
];

export const DOC_FILE_MAP = {
  domain: 'docs/DOMAIN_TEMPLATE.md',
  'sprint-spec': 'docs/sprints/SPRINT_SPEC_TEMPLATE.md',
};

export const MODE_CHOICES = [
  { value: 'quick', label: 'Quick (Batteries Included) - all roles, scripts and docs' },
  { value: 'custom', label: 'Custom (Component by Component) - granular selection' },
];

export const SKILL_LABELS = {
  'pm-orchestrator': 'pm-orchestrator      - Orchestration, Refinement Interview, Modes',
  'principal-engineer': 'principal-engineer   - Architecture, typed implementation, blast radius',
  'qa-auditor': 'qa-auditor           - Quality assurance, Verification Pyramid',
  'product-designer': 'product-designer     - UI/UX design, design system, tokens, touch',
  'market-researcher': 'market-researcher    - Market benchmarks, competitive analysis',
  'code-level-ux-auditor': 'code-level-ux-auditor- Static UX auditing, a11y, layout collision',
};

export const SCRIPT_LABELS = {
  'gate:qa': 'gate:qa           - playbook gate (QA gatekeeper)',
  'gate:review': 'gate:review       - playbook review (review items check)',
  'audit:ux': 'audit:ux          - playbook audit (static UX auditor)',
  'audit:ux:strict': 'audit:ux:strict   - playbook audit --strict',
  'check:loc': 'check:loc         - playbook check-loc (file budget & modularity)',
  'validate:commit': 'validate:commit   - playbook validate-commit (Conventional Commits)',
};

export const DOC_LABELS = {
  domain: 'domain      - docs/DOMAIN_TEMPLATE.md (domain glossary template)',
  'sprint-spec': 'sprint-spec - docs/sprints/SPRINT_SPEC_TEMPLATE.md (sprint spec template)',
};

/**
 * Loads the skills catalog from .playbook-manifest.json when available.
 */
export function loadCatalogFromManifest(manifestOrRoot = null) {
  let manifest = null;
  if (typeof manifestOrRoot === 'object' && manifestOrRoot !== null && !Array.isArray(manifestOrRoot)) {
    manifest = manifestOrRoot;
  } else {
    const root = typeof manifestOrRoot === 'string' ? manifestOrRoot : PACKAGE_ROOT;
    const manifestPath = path.join(root, '.playbook-manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {}
    }
  }

  const skills = Array.isArray(manifest?.coreSkills) ? manifest.coreSkills : DEFAULT_CORE_SKILLS;
  return {
    skills,
    scripts: VALID_SCRIPTS,
    docs: VALID_DOCS,
  };
}

/**
 * Parses a comma-separated list, 'all', 'none', or array into a validated array.
 * Throws an Error with descriptive message on unknown items.
 */
export function parseSelectionList(input, validItems, itemType = 'item') {
  if (input === null || input === undefined) return null;
  if (Array.isArray(input)) {
    const trimmed = input.map((s) => String(s).trim()).filter(Boolean);
    validateListItems(trimmed, validItems, itemType);
    return trimmed;
  }
  const str = String(input).trim();
  if (str === 'all') return [...validItems];
  if (str === 'none' || str === '') return [];

  const items = str.split(',').map((s) => s.trim()).filter(Boolean);
  validateListItems(items, validItems, itemType);
  return items;
}

function validateListItems(items, validItems, itemType) {
  for (const item of items) {
    if (!validItems.includes(item)) {
      const err = new Error(`Unknown ${itemType} "${item}". Available: ${validItems.join(', ')}`);
      err.code = 'INVALID_SELECTION';
      throw err;
    }
  }
}

export function getSkillChoices(availableSkills = DEFAULT_CORE_SKILLS) {
  return availableSkills.map((value) => ({
    value,
    label: SKILL_LABELS[value] || value,
  }));
}

export function getScriptChoices() {
  return VALID_SCRIPTS.map((value) => ({
    value,
    label: SCRIPT_LABELS[value] || value,
  }));
}

export function getDocChoices() {
  return VALID_DOCS.map((value) => ({
    value,
    label: DOC_LABELS[value] || value,
  }));
}

/**
 * Resolves final selection object from mode, explicit flags, and existing lockfile.
 */
export function resolveSelection({
  mode = 'quick',
  skills = null,
  scripts = null,
  docs = null,
  existingSelection = null,
  availableSkills = DEFAULT_CORE_SKILLS,
} = {}) {
  const quickDefaults = {
    skills: [...availableSkills],
    scripts: [...VALID_SCRIPTS],
    docs: [...VALID_DOCS],
  };

  if (mode === 'quick') {
    return {
      skills: skills !== null ? skills : quickDefaults.skills,
      scripts: scripts !== null ? scripts : quickDefaults.scripts,
      docs: docs !== null ? docs : quickDefaults.docs,
    };
  }

  // Custom mode: explicit flags win, then existing selection, then quick defaults
  return {
    skills: skills !== null ? skills : (existingSelection?.skills ?? quickDefaults.skills),
    scripts: scripts !== null ? scripts : (existingSelection?.scripts ?? quickDefaults.scripts),
    docs: docs !== null ? docs : (existingSelection?.docs ?? quickDefaults.docs),
  };
}

export function resolveSyncSelection(optionsSelection, lockSelection, availableSkills) {
  if (optionsSelection) {
    return resolveSelection({
      mode: 'custom',
      skills: optionsSelection.skills ?? null,
      scripts: optionsSelection.scripts ?? null,
      docs: optionsSelection.docs ?? null,
      existingSelection: lockSelection,
      availableSkills,
    });
  }
  if (lockSelection) {
    return resolveSelection({
      mode: 'custom',
      existingSelection: lockSelection,
      availableSkills,
    });
  }
  return resolveSelection({
    mode: 'quick',
    availableSkills,
  });
}

export function applySelectionFlag(arg, next, catalog, opts) {
  try {
    switch (arg) {
      case '--skills': opts.skills = parseSelectionList(next(), catalog.skills, 'skill'); break;
      case '--scripts': opts.scripts = parseSelectionList(next(), VALID_SCRIPTS, 'script'); break;
      case '--no-scripts': opts.noScripts = true; opts.scripts = []; break;
      case '--docs': opts.docs = parseSelectionList(next(), VALID_DOCS, 'doc'); break;
      case '--no-docs': opts.noDocs = true; opts.docs = []; break;
    }
  } catch (err) {
    console.error(`\n  ✖  ${err.message}\n`);
    process.exit(2);
  }
}
