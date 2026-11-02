import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  parseSelectionList,
  resolveSelection,
  loadCatalogFromManifest,
  VALID_SCRIPTS,
  SCRIPT_DEFINITIONS,
  VALID_DOCS,
  DEFAULT_CORE_SKILLS,
} from '../scripts/lib/selection.mjs';
import { planFiles, readLock } from '../scripts/lib/sync-classifier.mjs';
import { runPlaybookSync } from '../scripts/sync-playbook.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const INIT_CLI = path.join(REPO_ROOT, 'scripts/init.mjs');
const SYNC_CLI = path.join(REPO_ROOT, 'scripts/sync-playbook.mjs');

describe('selection.mjs unit tests', () => {
  test('parseSelectionList parses valid comma-separated values', () => {
    const parsed = parseSelectionList('pm-orchestrator,qa-auditor', DEFAULT_CORE_SKILLS, 'skill');
    assert.deepEqual(parsed, ['pm-orchestrator', 'qa-auditor']);
  });

  test('parseSelectionList handles "all" and "none"', () => {
    assert.deepEqual(parseSelectionList('all', DEFAULT_CORE_SKILLS, 'skill'), DEFAULT_CORE_SKILLS);
    assert.deepEqual(parseSelectionList('none', DEFAULT_CORE_SKILLS, 'skill'), []);
  });

  test('parseSelectionList throws on unknown skill with descriptive message', () => {
    assert.throws(
      () => parseSelectionList('pm-orchestrator,unknown-role', DEFAULT_CORE_SKILLS, 'skill'),
      /Unknown skill "unknown-role"\. Available: pm-orchestrator/
    );
  });

  test('parseSelectionList throws on unknown script', () => {
    assert.throws(
      () => parseSelectionList('gate:qa,fake:script', VALID_SCRIPTS, 'script'),
      /Unknown script "fake:script"\. Available: gate:qa/
    );
  });

  test('parseSelectionList throws on unknown doc', () => {
    assert.throws(
      () => parseSelectionList('domain,unknown-template', VALID_DOCS, 'doc'),
      /Unknown doc "unknown-template"\. Available: domain, sprint-spec/
    );
  });

  test('resolveSelection: quick preset defaults to all', () => {
    const res = resolveSelection({ mode: 'quick' });
    assert.deepEqual(res.skills, DEFAULT_CORE_SKILLS);
    assert.deepEqual(res.scripts, VALID_SCRIPTS);
    assert.deepEqual(res.docs, VALID_DOCS);
  });

  test('resolveSelection: quick preset respects explicit override flags', () => {
    const res = resolveSelection({
      mode: 'quick',
      skills: ['qa-auditor'],
      scripts: ['gate:qa'],
      docs: [],
    });
    assert.deepEqual(res.skills, ['qa-auditor']);
    assert.deepEqual(res.scripts, ['gate:qa']);
    assert.deepEqual(res.docs, []);
  });

  test('resolveSelection: custom mode uses existing selection when present', () => {
    const existing = {
      skills: ['principal-engineer'],
      scripts: ['check:loc'],
      docs: ['domain'],
    };
    const res = resolveSelection({ mode: 'custom', existingSelection: existing });
    assert.deepEqual(res.skills, ['principal-engineer']);
    assert.deepEqual(res.scripts, ['check:loc']);
    assert.deepEqual(res.docs, ['domain']);
  });

  test('VALID_SCRIPTS includes audit:repo and audit:repo:strict with correct definitions', () => {
    assert.ok(VALID_SCRIPTS.includes('audit:repo'));
    assert.ok(VALID_SCRIPTS.includes('audit:repo:strict'));
    assert.equal(SCRIPT_DEFINITIONS['audit:repo'], 'playbook audit-repo');
    assert.equal(SCRIPT_DEFINITIONS['audit:repo:strict'], 'playbook audit-repo --strict');
  });
});

describe('planFiles with selection', () => {
  const manifest = {
    version: '2.8.0',
    core: [
      '.agents/TEAM_PLAYBOOK.md',
      '.agents/skills/pm-orchestrator/SKILL.md',
      '.agents/skills/principal-engineer/SKILL.md',
      '.agents/skills/principal-engineer/references/oxlint-anti-slop.md',
      '.agents/skills/qa-auditor/SKILL.md',
      'docs/DOMAIN_TEMPLATE.md',
      'docs/sprints/SPRINT_SPEC_TEMPLATE.md',
    ],
  };

  test('filters core files to selected skills and docs', () => {
    const { files } = planFiles(manifest, [], [], {}, {
      selection: {
        skills: ['principal-engineer'],
        docs: ['domain'],
      },
    });

    assert.ok(files.includes('.agents/TEAM_PLAYBOOK.md'));
    assert.ok(files.includes('.agents/skills/principal-engineer/SKILL.md'));
    assert.ok(files.includes('.agents/skills/principal-engineer/references/oxlint-anti-slop.md'));
    assert.ok(files.includes('docs/DOMAIN_TEMPLATE.md'));
    assert.ok(!files.includes('.agents/skills/pm-orchestrator/SKILL.md'));
    assert.ok(!files.includes('.agents/skills/qa-auditor/SKILL.md'));
    assert.ok(!files.includes('docs/sprints/SPRINT_SPEC_TEMPLATE.md'));
  });

  test('includes all files when selection fields are not specified (legacy)', () => {
    const { files } = planFiles(manifest, [], [], {}, {});
    assert.equal(files.length, manifest.core.length);
  });
});

describe('CLI flags & error handling (exit code 2)', () => {
  test('init exits with code 2 on unknown --skills', () => {
    const res = spawnSync(process.execPath, [INIT_CLI, '--skills', 'unknown-skill', '--yes'], {
      encoding: 'utf8',
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /Unknown skill "unknown-skill"/);
  });

  test('init exits with code 2 on unknown --scripts', () => {
    const res = spawnSync(process.execPath, [INIT_CLI, '--scripts', 'unknown-script', '--yes'], {
      encoding: 'utf8',
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /Unknown script "unknown-script"/);
  });

  test('init exits with code 2 on unknown --docs', () => {
    const res = spawnSync(process.execPath, [INIT_CLI, '--docs', 'unknown-doc', '--yes'], {
      encoding: 'utf8',
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /Unknown doc "unknown-doc"/);
  });

  test('init exits with code 2 on unknown --mode', () => {
    const res = spawnSync(process.execPath, [INIT_CLI, '--mode', 'turbo', '--yes'], {
      encoding: 'utf8',
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /Unknown mode "turbo"/);
  });

  test('sync exits with code 2 on unknown --skills', () => {
    const res = spawnSync(process.execPath, [SYNC_CLI, '--skills', 'bad-role'], {
      encoding: 'utf8',
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /Unknown skill "bad-role"/);
  });
});

describe('E2E init & sync with granular selection', () => {
  test('init with custom flags only installs selected components and writes lock selection', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-init-custom-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'custom-proj' }), 'utf8');

    const res = spawnSync(process.execPath, [
      INIT_CLI,
      '--repo', tmp,
      '--source', REPO_ROOT,
      '--mode', 'custom',
      '--skills', 'pm-orchestrator,qa-auditor',
      '--scripts', 'gate:qa,check:loc',
      '--docs', 'domain',
      '--no-board',
      '--yes',
    ], {
      encoding: 'utf8',
    });

    assert.equal(res.status, 0, `Init failed: ${res.stderr || res.stdout}`);

    // Verify skills
    assert.ok(fs.existsSync(path.join(tmp, '.agents/skills/pm-orchestrator/SKILL.md')));
    assert.ok(fs.existsSync(path.join(tmp, '.agents/skills/qa-auditor/SKILL.md')));
    assert.ok(!fs.existsSync(path.join(tmp, '.agents/skills/principal-engineer')));
    assert.ok(!fs.existsSync(path.join(tmp, '.agents/skills/product-designer')));
    assert.ok(!fs.existsSync(path.join(tmp, '.agents/skills/market-researcher')));

    // Verify docs
    assert.ok(fs.existsSync(path.join(tmp, 'docs/DOMAIN_TEMPLATE.md')));
    assert.ok(!fs.existsSync(path.join(tmp, 'docs/sprints/SPRINT_SPEC_TEMPLATE.md')));

    // Verify package.json scripts
    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts['gate:qa'], 'playbook gate');
    assert.equal(pkg.scripts['check:loc'], 'playbook check-loc');
    assert.equal(pkg.scripts['gate:review'], undefined);
    assert.equal(pkg.scripts['audit:ux'], undefined);

    // Verify lockfile selection persistence
    const lock = readLock(tmp);
    assert.deepEqual(lock.selection, {
      skills: ['pm-orchestrator', 'qa-auditor'],
      scripts: ['gate:qa', 'check:loc'],
      docs: ['domain'],
    });

    // Run playbook sync without flags: it MUST NOT re-install unselected skills or docs
    const syncRes = spawnSync(process.execPath, [
      SYNC_CLI,
      '--repo', tmp,
      '--source', REPO_ROOT,
      '--yes',
    ], {
      encoding: 'utf8',
    });
    assert.equal(syncRes.status, 0, `Sync failed: ${syncRes.stderr || syncRes.stdout}`);

    assert.ok(!fs.existsSync(path.join(tmp, '.agents/skills/principal-engineer')));
    assert.ok(!fs.existsSync(path.join(tmp, 'docs/sprints/SPRINT_SPEC_TEMPLATE.md')));

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('--no-scripts and --no-docs leaves package.json untouched and docs empty', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-init-none-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'none-proj' }), 'utf8');

    const res = spawnSync(process.execPath, [
      INIT_CLI,
      '--repo', tmp,
      '--source', REPO_ROOT,
      '--mode', 'custom',
      '--skills', 'qa-auditor',
      '--no-scripts',
      '--no-docs',
      '--no-board',
      '--yes',
    ], {
      encoding: 'utf8',
    });

    assert.equal(res.status, 0, `Init failed: ${res.stderr || res.stdout}`);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts, undefined);
    assert.ok(!fs.existsSync(path.join(tmp, 'docs')));

    const lock = readLock(tmp);
    assert.deepEqual(lock.selection, {
      skills: ['qa-auditor'],
      scripts: [],
      docs: [],
    });

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('subsequent sync prunes unmodified unselected skills but preserves customized skills', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-prune-test-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'prune-proj' }), 'utf8');

    // 1. Initial quick install (installs all skills)
    const res1 = spawnSync(process.execPath, [
      INIT_CLI,
      '--repo', tmp,
      '--source', REPO_ROOT,
      '--mode', 'quick',
      '--no-board',
      '--yes',
    ], {
      encoding: 'utf8',
    });
    assert.equal(res1.status, 0);

    const peSkill = path.join(tmp, '.agents/skills/principal-engineer/SKILL.md');
    const mrSkill = path.join(tmp, '.agents/skills/market-researcher/SKILL.md');
    assert.ok(fs.existsSync(peSkill));
    assert.ok(fs.existsSync(mrSkill));

    // 2. Customize market-researcher locally
    fs.writeFileSync(mrSkill, '# Customized Market Researcher Skill', 'utf8');

    // 3. Re-sync with only qa-auditor and pm-orchestrator (deselecting both pe and mr)
    const res2 = spawnSync(process.execPath, [
      SYNC_CLI,
      '--repo', tmp,
      '--source', REPO_ROOT,
      '--skills', 'qa-auditor,pm-orchestrator',
      '--yes',
    ], {
      encoding: 'utf8',
    });

    // principal-engineer was unmodified: pruned!
    assert.ok(!fs.existsSync(path.join(tmp, '.agents/skills/principal-engineer')));

    // market-researcher was customized: preserved!
    assert.ok(fs.existsSync(mrSkill));
    assert.equal(fs.readFileSync(mrSkill, 'utf8'), '# Customized Market Researcher Skill');

    // Lockfile records market-researcher under customizations
    const lock = readLock(tmp);
    assert.ok(lock.customizations.includes('.agents/skills/market-researcher/SKILL.md'));

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('legacy lock without selection field is treated as all (backward compatibility)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-legacy-lock-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'legacy-proj' }), 'utf8');

    // Create a mock legacy lock without "selection"
    fs.mkdirSync(path.join(tmp, '.gripm'), { recursive: true });
    const legacyLock = {
      $comment: 'Legacy lock',
      playbook: 'pablojavierrodriguez/gripm-playbook',
      ref: 'local',
      version: '2.7.1',
      stacks: [],
      syncedAt: new Date().toISOString(),
      files: {},
      customizations: [],
    };
    fs.writeFileSync(path.join(tmp, '.gripm/playbook-lock.json'), JSON.stringify(legacyLock, null, 2), 'utf8');

    // Run sync on legacy lock without flags
    const res = spawnSync(process.execPath, [
      SYNC_CLI,
      '--repo', tmp,
      '--source', REPO_ROOT,
      '--yes',
    ], {
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, `Sync failed: ${res.stderr || res.stdout}`);

    // Verify all core skills were installed (not pruned)
    assert.ok(fs.existsSync(path.join(tmp, '.agents/skills/pm-orchestrator/SKILL.md')));
    assert.ok(fs.existsSync(path.join(tmp, '.agents/skills/principal-engineer/SKILL.md')));
    assert.ok(fs.existsSync(path.join(tmp, '.agents/skills/qa-auditor/SKILL.md')));

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('init with --scripts audit:repo,audit:repo:strict installs audit scripts into package.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-init-audit-scripts-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'audit-scripts-proj' }), 'utf8');

    const res = spawnSync(process.execPath, [
      INIT_CLI,
      '--repo', tmp,
      '--source', REPO_ROOT,
      '--mode', 'custom',
      '--skills', 'qa-auditor',
      '--scripts', 'audit:repo,audit:repo:strict',
      '--no-docs',
      '--no-board',
      '--yes',
    ], {
      encoding: 'utf8',
    });

    assert.equal(res.status, 0, `Init failed: ${res.stderr || res.stdout}`);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts['audit:repo'], 'playbook audit-repo');
    assert.equal(pkg.scripts['audit:repo:strict'], 'playbook audit-repo --strict');
    assert.equal(pkg.scripts['gate:qa'], undefined);

    const lock = readLock(tmp);
    assert.deepEqual(lock.selection.scripts, ['audit:repo', 'audit:repo:strict']);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('init synchronizes audit thresholds in .gripm/config.json when @gripm/board is present', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-board-sync-'));
    fs.writeFileSync(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'board-sync-proj',
        devDependencies: { '@gripm/board': '^1.0.0' },
      }, null, 2),
      'utf8'
    );
    fs.mkdirSync(path.join(tmp, '.gripm'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, '.gripm/config.json'),
      JSON.stringify({ theme: 'dark', density: 'comfortable', version: '1.0.0' }, null, 2),
      'utf8'
    );

    const res = spawnSync(process.execPath, [
      INIT_CLI,
      '--repo', tmp,
      '--source', REPO_ROOT,
      '--yes',
    ], {
      encoding: 'utf8',
    });

    assert.equal(res.status, 0, `Init failed: ${res.stderr || res.stdout}`);

    const updatedConfig = JSON.parse(fs.readFileSync(path.join(tmp, '.gripm/config.json'), 'utf8'));
    assert.deepEqual(updatedConfig.audit, { maxLines: 1000, warnLines: 500, strict: false });
    assert.equal(updatedConfig.theme, 'dark');

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('init synchronizes audit thresholds when backlog/tasks/ directory exists', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-tasks-sync-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'tasks-sync-proj' }), 'utf8');
    fs.mkdirSync(path.join(tmp, 'backlog', 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.gripm'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, '.gripm/config.json'),
      JSON.stringify({ projectName: 'tasks-sync-proj', theme: 'dark' }, null, 2),
      'utf8'
    );

    const res = spawnSync(process.execPath, [
      INIT_CLI,
      '--repo', tmp,
      '--source', REPO_ROOT,
      '--yes',
    ], {
      encoding: 'utf8',
    });

    assert.equal(res.status, 0, `Init failed: ${res.stderr || res.stdout}`);

    const updatedConfig = JSON.parse(fs.readFileSync(path.join(tmp, '.gripm/config.json'), 'utf8'));
    assert.deepEqual(updatedConfig.audit, { maxLines: 1000, warnLines: 500, strict: false });

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
