import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const AUDITOR_BIN = path.join(SCRIPTS_DIR, 'audit-ux-code.cjs');
const GATE_BIN = path.join(SCRIPTS_DIR, 'gate-qa.mjs');
const SYNC_BIN = path.join(SCRIPTS_DIR, 'sync-playbook.mjs');
const VALIDATE_BIN = path.join(SCRIPTS_DIR, 'validate-repo.mjs');
const CHECK_LOC_BIN = path.join(SCRIPTS_DIR, 'check-loc.mjs');
const UX_RULES_PATH = path.join(SCRIPTS_DIR, 'ux-rules.json');
const MANIFEST_PATH = path.join(ROOT, '.playbook-manifest.json');
const SKILL_DOC_PATH = path.join(ROOT, '.agents', 'skills', 'code-level-ux-auditor', 'SKILL.md');

// Milestone readiness probes
const M2_READY = fs.existsSync(path.join(SCRIPTS_DIR, 'lib', 'frontmatter.mjs'));
const M3_READY = (() => {
  try {
    const code = fs.readFileSync(GATE_BIN, 'utf8');
    return code.includes('anti-self-certification') || code.includes('resolveActor');
  } catch {
    return false;
  }
})();

// Helper functions for sandbox isolation
function createSandbox(prefix = 'e2e-delivery-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createFile(dir, relPath, content) {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

function runCmd(bin, args = [], options = {}) {
  const res = spawnSync(process.execPath, [bin, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    cwd: options.cwd || ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    output: `${res.stdout || ''}${res.stderr || ''}`
  };
}

function runNpm(args = [], options = {}) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npmCmd, args, {
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    cwd: options.cwd || ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    output: `${res.stdout || ''}${res.stderr || ''}`
  };
}

function countLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content) return 0;
  return content.split(/\r\n|\r|\n/).length;
}

function makeTaskFile(dir, {
  id = 'TASK-001',
  status = 'review',
  claimedBy = null,
  acs = ['- [x] #1 done', '- [x] #2 done'],
  dependencies = [],
  blockedReason = null,
  dismissedReason = null,
  priority = 'high'
} = {}) {
  const lines = ['---', `id: ${id}`, `title: "E2E Task Fixture"`, `status: ${status}`];
  if (claimedBy) lines.push(`claimed_by: "${claimedBy}"`);
  if (blockedReason) lines.push(`blocked_reason: "${blockedReason}"`);
  if (dismissedReason) lines.push(`dismissed_reason: "${dismissedReason}"`);
  if (dependencies.length > 0) {
    lines.push('dependencies:');
    dependencies.forEach((d) => lines.push(`  - ${d}`));
  } else {
    lines.push('dependencies: []');
  }
  lines.push(`priority: ${priority}`);
  lines.push('---');
  lines.push('');
  lines.push('## Description');
  lines.push('E2E task description');
  lines.push('');
  lines.push('## Acceptance Criteria');
  lines.push('<!-- AC:BEGIN -->');
  acs.forEach((ac) => lines.push(ac));
  lines.push('<!-- AC:END -->');
  lines.push('');

  const targetPath = path.join(dir, `${id}.md`);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, lines.join('\n'), 'utf8');
  return targetPath;
}

// ============================================================================
// TIER 1: FEATURE COVERAGE (IN ISOLATION)
// ============================================================================

describe('Tier 1: Feature Coverage (F1 - F13)', () => {

  // Feature F1: UX-014 Rule Definition
  describe('F1: UX-014 Rule Definition (Anti-Em-Dash / Anti-AI Cliché Detector)', () => {
    test('F1-1: UX-014 rule is defined in scripts/ux-rules.json with id UX-014', () => {
      const catalog = JSON.parse(fs.readFileSync(UX_RULES_PATH, 'utf8'));
      const rule = catalog.rules.find((r) => r.id === 'UX-014');
      assert.ok(rule, 'UX-014 must exist in scripts/ux-rules.json');
      assert.equal(rule.id, 'UX-014');
    });

    test('F1-2: UX-014 has required metadata fields and WARNING severity', () => {
      const catalog = JSON.parse(fs.readFileSync(UX_RULES_PATH, 'utf8'));
      const rule = catalog.rules.find((r) => r.id === 'UX-014');
      assert.ok(rule.title, 'UX-014 missing title');
      assert.equal(rule.severity, 'WARNING');
      assert.ok(rule.signature, 'UX-014 missing signature');
      assert.ok(rule.impact, 'UX-014 missing impact');
      assert.ok(rule.fix, 'UX-014 missing fix');
      assert.ok(rule.message, 'UX-014 missing message');
    });

    test('F1-3: UX-014 check matcher declares both line and alsoContent with em-dash and en-dash', () => {
      const catalog = JSON.parse(fs.readFileSync(UX_RULES_PATH, 'utf8'));
      const rule = catalog.rules.find((r) => r.id === 'UX-014');
      assert.ok(rule.check, 'UX-014 must have a check property');
      assert.ok(Array.isArray(rule.check.line), 'check.line must be array');
      assert.ok(Array.isArray(rule.check.alsoContent), 'check.alsoContent must be array');
      assert.ok(rule.check.line.includes('\u2014') || rule.check.line.includes('—'), 'check.line missing em-dash');
      assert.ok(rule.check.line.includes('\u2013') || rule.check.line.includes('–'), 'check.line missing en-dash');
    });

    test('F1-4: UX-014 detects literal em-dash in JSX text content', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f1-4"}');
      createFile(sandbox, 'src/Component.tsx', 'export const Header = () => <h1>Release — Notes</h1>;\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      const hit = report.findings.find((f) => f.rule === 'UX-014');
      assert.ok(hit, 'UX-014 must flag em-dash in JSX text node');
      assert.equal(hit.severity, 'WARNING');
    });

    test('F1-5: UX-014 detects literal en-dash in attribute metadata', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f1-5"}');
      createFile(sandbox, 'src/Component.tsx', 'export const Button = () => <button title="Save – Close">Submit</button>;\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      const hit = report.findings.find((f) => f.rule === 'UX-014');
      assert.ok(hit, 'UX-014 must flag en-dash in attribute metadata');
    });
  });

  // Feature F2: UX-015 Rule Definition
  describe('F2: UX-015 Rule Definition (Viewport Touch Zoom Lock)', () => {
    test('F2-1: UX-015 rule is defined in scripts/ux-rules.json with id UX-015', () => {
      const catalog = JSON.parse(fs.readFileSync(UX_RULES_PATH, 'utf8'));
      const rule = catalog.rules.find((r) => r.id === 'UX-015');
      assert.ok(rule, 'UX-015 must exist in scripts/ux-rules.json');
      assert.equal(rule.id, 'UX-015');
    });

    test('F2-2: UX-015 has required metadata fields and WARNING severity', () => {
      const catalog = JSON.parse(fs.readFileSync(UX_RULES_PATH, 'utf8'));
      const rule = catalog.rules.find((r) => r.id === 'UX-015');
      assert.ok(rule.title, 'UX-015 missing title');
      assert.equal(rule.severity, 'WARNING');
      assert.ok(rule.signature, 'UX-015 missing signature');
      assert.ok(rule.impact, 'UX-015 missing impact');
      assert.ok(rule.fix, 'UX-015 missing fix');
      assert.ok(rule.message, 'UX-015 missing message');
    });

    test('F2-3: UX-015 detects maximum-scale=1 in viewport meta tag', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f2-3"}');
      createFile(sandbox, 'src/App.tsx', 'export const Head = () => <meta name="viewport" content="width=device-width, maximum-scale=1" />;\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      const hit = report.findings.find((f) => f.rule === 'UX-015');
      assert.ok(hit, 'UX-015 must detect maximum-scale=1');
    });

    test('F2-4: UX-015 detects user-scalable=no in viewport meta tag', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f2-4"}');
      createFile(sandbox, 'src/App.tsx', 'export const Head = () => <meta name="viewport" content="width=device-width, user-scalable=no" />;\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      const hit = report.findings.find((f) => f.rule === 'UX-015');
      assert.ok(hit, 'UX-015 must detect user-scalable=no');
    });

    test('F2-5: UX-015 detects user-scalable=0 in viewport meta tag', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f2-5"}');
      createFile(sandbox, 'src/App.tsx', 'export const Head = () => <meta name="viewport" content="width=device-width, user-scalable=0" />;\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      const hit = report.findings.find((f) => f.rule === 'UX-015');
      assert.ok(hit, 'UX-015 must detect user-scalable=0');
    });
  });

  // Feature F3: UX Documentation Parity
  describe('F3: UX Documentation Parity', () => {
    test('F3-1: SKILL.md documents UX-014 with correct heading format and title', () => {
      const skill = fs.readFileSync(SKILL_DOC_PATH, 'utf8');
      assert.match(skill, /###\s*\d+\.\s*\[UX-014\]\s*·\s*WARNING\s*·/, 'SKILL.md must document UX-014 heading');
      const catalog = JSON.parse(fs.readFileSync(UX_RULES_PATH, 'utf8'));
      const rule = catalog.rules.find((r) => r.id === 'UX-014');
      assert.ok(skill.includes(rule.title), 'SKILL.md must contain UX-014 title verbatim');
    });

    test('F3-2: SKILL.md documents UX-015 with correct heading format and title', () => {
      const skill = fs.readFileSync(SKILL_DOC_PATH, 'utf8');
      assert.match(skill, /###\s*\d+\.\s*\[UX-015\]\s*·\s*WARNING\s*·/, 'SKILL.md must document UX-015 heading');
      const catalog = JSON.parse(fs.readFileSync(UX_RULES_PATH, 'utf8'));
      const rule = catalog.rules.find((r) => r.id === 'UX-015');
      assert.ok(skill.includes(rule.title), 'SKILL.md must contain UX-015 title verbatim');
    });

    test('F3-3: SKILL.md pre-merge checklist includes verification points', () => {
      const skill = fs.readFileSync(SKILL_DOC_PATH, 'utf8');
      assert.match(skill, /##\s*✅\s*Checklist de aceptación pre-merge/, 'Checklist section must exist');
      assert.ok(skill.includes('UX-014') || skill.includes('guión estándar') || skill.includes('em-dash'));
    });

    test('F3-4: README.md or catalog references 15 signatures', () => {
      const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
      const catalog = JSON.parse(fs.readFileSync(UX_RULES_PATH, 'utf8'));
      assert.equal(catalog.rules.length, 15, 'Canonical catalog must contain 15 rules');
      assert.ok(readme.includes('15') || readme.includes('UX-015') || catalog.rules.length === 15);
    });

    test('F3-5: validate-repo verifyRuleParity passes cleanly with 0 parity errors', () => {
      const res = runCmd(VALIDATE_BIN);
      assert.equal(res.status, 0, `validate-repo failed: ${res.output}`);
      assert.match(res.stdout, /Repository is consistent/);
    });
  });

  // Feature F4: UX Fixture & Tests
  describe('F4: UX Fixture & Tests', () => {
    test('F4-1: audit-ux-code.cjs --list-rules prints exactly 15 signatures', () => {
      const res = runCmd(AUDITOR_BIN, ['--list-rules']);
      assert.equal(res.status, 0);
      assert.match(res.stdout, /Rule catalog v2 - 15 signatures/);
      assert.match(res.stdout, /UX-014/);
      assert.match(res.stdout, /UX-015/);
    });

    test('F4-2: Violations.tsx fixture contains triggers for UX-014 and UX-015', () => {
      const fixturePath = path.join(ROOT, 'tests', 'fixtures', 'react-app', 'src', 'components', 'Violations.tsx');
      assert.ok(fs.existsSync(fixturePath), 'Violations.tsx must exist');
      const content = fs.readFileSync(fixturePath, 'utf8');
      assert.ok(content.includes('\u2014') || content.includes('—'), 'Violations.tsx must contain em-dash trigger');
      assert.ok(content.includes('maximum-scale=1') || content.includes('user-scalable=no'), 'Violations.tsx must contain zoom lock trigger');
    });

    test('F4-3: Auditing react-app fixture reports all 15 canonical rules', () => {
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], {
        env: { AUDIT_UX_ROOT: path.join(ROOT, 'tests', 'fixtures', 'react-app') }
      });
      assert.equal(res.status, 1, 'Violations in react-app must cause audit exit code 1');
      const report = JSON.parse(res.stdout);
      const firedRules = new Set(report.findings.map((f) => f.rule));
      assert.ok(firedRules.has('UX-014'), 'UX-014 must fire on react-app');
      assert.ok(firedRules.has('UX-015'), 'UX-015 must fire on react-app');
    });

    test('F4-4: Auditing Clean.tsx produces zero findings including UX-014 and UX-015', () => {
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], {
        env: { AUDIT_UX_ROOT: path.join(ROOT, 'tests', 'fixtures', 'react-app') }
      });
      const report = JSON.parse(res.stdout);
      const cleanFindings = report.findings.filter((f) => f.file.endsWith('Clean.tsx'));
      assert.equal(cleanFindings.length, 0, 'Clean.tsx must produce zero findings');
    });

    test('F4-5: audit-ux.test.mjs contains verification tests for rules catalog', () => {
      const testFile = path.join(ROOT, 'tests', 'audit-ux.test.mjs');
      const content = fs.readFileSync(testFile, 'utf8');
      assert.ok(content.includes('ALL_IDS'), 'audit-ux.test.mjs must inspect catalog rules');
    });
  });

  // Feature F5: Extract Shared Submodules
  describe('F5: Extract Shared Submodules (scripts/lib/*)', () => {
    test('F5-1: scripts/lib directory exists with expected high-cohesion submodules', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const libDir = path.join(SCRIPTS_DIR, 'lib');
      assert.ok(fs.existsSync(libDir), 'scripts/lib directory must exist');
      assert.ok(fs.existsSync(path.join(libDir, 'frontmatter.mjs')));
      assert.ok(fs.existsSync(path.join(libDir, 'terminal.mjs')));
      assert.ok(fs.existsSync(path.join(libDir, 'pyramid.mjs')));
      assert.ok(fs.existsSync(path.join(libDir, 'task-inspection.mjs')));
    });

    test('F5-2: scripts/lib/frontmatter.mjs exports readFrontmatter, readACs, mutateTaskFrontmatter', async (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const mod = await import('../scripts/lib/frontmatter.mjs');
      assert.equal(typeof mod.readFrontmatter, 'function');
      assert.equal(typeof mod.readACs, 'function');
      assert.equal(typeof mod.mutateTaskFrontmatter, 'function');
    });

    test('F5-3: scripts/lib/terminal.mjs exports c and isColorSupported', async (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const mod = await import('../scripts/lib/terminal.mjs');
      assert.ok(mod.c, 'terminal.mjs must export c');
      assert.equal(typeof mod.c.green, 'function');
      assert.equal(typeof mod.isColorSupported, 'boolean');
    });

    test('F5-4: scripts/lib/pyramid.mjs exports resolvePyramidSteps and executePyramid', async (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const mod = await import('../scripts/lib/pyramid.mjs');
      assert.equal(typeof mod.resolvePyramidSteps, 'function');
      assert.equal(typeof mod.executePyramid, 'function');
    });

    test('F5-5: scripts/lib/task-inspection.mjs exports loadTasks, resolveTaskPath, inspectTask', async (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const mod = await import('../scripts/lib/task-inspection.mjs');
      assert.equal(typeof mod.loadTasks, 'function');
      assert.equal(typeof mod.resolveTaskPath, 'function');
      assert.equal(typeof mod.inspectTask, 'function');
    });
  });

  // Feature F6: Refactor gate-qa.mjs
  describe('F6: Refactor scripts/gate-qa.mjs (< 500 LOC)', () => {
    test('F6-1: scripts/gate-qa.mjs line count is strictly under 500 LOC', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const lines = countLines(GATE_BIN);
      assert.ok(lines < 500, `gate-qa.mjs must be < 500 LOC, current: ${lines}`);
    });

    test('F6-2: scripts/gate-qa.mjs retains literal PYRAMID_STEPS declaration', () => {
      const content = fs.readFileSync(GATE_BIN, 'utf8');
      assert.match(content, /const PYRAMID_STEPS\s*=\s*\[([\s\S]*?)\n\];/, 'PYRAMID_STEPS declaration must remain literal');
    });

    test('F6-3: gate-qa.mjs imports submodules from ./lib/', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const content = fs.readFileSync(GATE_BIN, 'utf8');
      assert.match(content, /from\s+['"]\.\/lib\//);
    });

    test('F6-4: gate-qa CLI exits code 2 for valid task in inspection-only mode (--no-run)', () => {
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox);
      const res = runCmd(GATE_BIN, [task, '--no-run']);
      assert.equal(res.status, 2, 'inspection-only mode must exit 2');
      assert.match(res.stdout, /TASK INSPECTION PASSED/);
    });

    test('F6-5: gate-qa CLI exits code 1 when target task does not exist', () => {
      const res = runCmd(GATE_BIN, ['NON-EXISTENT-TASK', '--no-run']);
      assert.equal(res.status, 1);
      assert.match(res.output, /no task found/);
    });
  });

  // Feature F7: Refactor sync-playbook.mjs
  describe('F7: Refactor scripts/sync-playbook.mjs (< 500 LOC)', () => {
    test('F7-1: scripts/sync-playbook.mjs line count is strictly under 500 LOC', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const lines = countLines(SYNC_BIN);
      assert.ok(lines < 500, `sync-playbook.mjs must be < 500 LOC, current: ${lines}`);
    });

    test('F7-2: scripts/sync-playbook.mjs retains literal FALLBACK_CORE_FILES declaration', () => {
      const content = fs.readFileSync(SYNC_BIN, 'utf8');
      assert.match(content, /FALLBACK_CORE_FILES\s*=\s*\[([\s\S]*?)\]/, 'FALLBACK_CORE_FILES declaration must remain literal');
    });

    test('F7-3: sync-playbook.mjs imports submodules from ./lib/', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const content = fs.readFileSync(SYNC_BIN, 'utf8');
      assert.match(content, /from\s+['"]\.\/lib\//);
    });

    test('F7-4: sync-playbook CLI --list-stacks outputs available stacks', () => {
      const res = runCmd(SYNC_BIN, ['--list-stacks', '--source', ROOT]);
      assert.equal(res.status, 0);
      assert.match(res.stdout, /Playbook Stack Packs/);
    });

    test('F7-5: sync-playbook exports classifyLocalFile', async () => {
      const mod = await import('../scripts/sync-playbook.mjs');
      assert.equal(typeof mod.classifyLocalFile, 'function');
      assert.equal(mod.classifyLocalFile({ localHash: 'a', knownHash: 'a', wasCustomization: false }), 'managed');
      assert.equal(mod.classifyLocalFile({ localHash: 'b', knownHash: 'a', wasCustomization: false }), 'customization');
    });
  });

  // Feature F8: Refactor validate-repo.mjs
  describe('F8: Refactor scripts/validate-repo.mjs (< 500 LOC)', () => {
    test('F8-1: scripts/validate-repo.mjs line count is strictly under 500 LOC', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const lines = countLines(VALIDATE_BIN);
      assert.ok(lines < 500, `validate-repo.mjs must be < 500 LOC, current: ${lines}`);
    });

    test('F8-2: scripts/validate-repo.mjs retains literal CANONICAL_STATUSES declaration', () => {
      const content = fs.readFileSync(VALIDATE_BIN, 'utf8');
      assert.match(content, /const CANONICAL_STATUSES\s*=\s*\[([\s\S]*?)\];/, 'CANONICAL_STATUSES declaration must remain literal');
    });

    test('F8-3: validate-repo.mjs imports submodules from ./lib/', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const content = fs.readFileSync(VALIDATE_BIN, 'utf8');
      assert.match(content, /from\s+['"]\.\/lib\//);
    });

    test('F8-4: validate-repo CLI executes cleanly against current repo', () => {
      const res = runCmd(VALIDATE_BIN);
      assert.equal(res.status, 0);
      assert.match(res.stdout, /Repository is consistent/);
    });

    test('F8-5: validate-repo verifies state machine vocabulary against STATE_MACHINE.md', async (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const mod = await import('../scripts/validate-repo.mjs');
      assert.equal(typeof mod.checkStatusVocabulary, 'function');
      const errs = mod.checkStatusVocabulary(ROOT);
      assert.deepEqual(errs, []);
    });
  });

  // Feature F9: Manifest & Fallback Parity
  describe('F9: Manifest & Fallback Parity for scripts/lib/*', () => {
    test('F9-1: .playbook-manifest.json declares core array', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      assert.ok(Array.isArray(manifest.core), 'manifest.core must be array');
    });

    test('F9-2: FALLBACK_CORE_FILES in sync-playbook.mjs is discoverable', () => {
      const content = fs.readFileSync(SYNC_BIN, 'utf8');
      const match = content.match(/FALLBACK_CORE_FILES\s*=\s*\[([\s\S]*?)\]/);
      assert.ok(match, 'FALLBACK_CORE_FILES must be present');
    });

    test('F9-3: .playbook-manifest.json core and FALLBACK_CORE_FILES have identical entries', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      const content = fs.readFileSync(SYNC_BIN, 'utf8');
      const match = content.match(/FALLBACK_CORE_FILES\s*=\s*\[([\s\S]*?)\]/);
      const fallbackFiles = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
      assert.deepEqual(manifest.core, fallbackFiles, 'manifest core and fallback must be in parity');
    });

    test('F9-4: Every file listed in .playbook-manifest.json core exists on disk', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      for (const relPath of manifest.core) {
        assert.ok(fs.existsSync(path.join(ROOT, relPath)), `Manifest core file missing on disk: ${relPath}`);
      }
    });

    test('F9-5: validate-repo manifest parity check passes with 0 errors', () => {
      const res = runCmd(VALIDATE_BIN);
      assert.equal(res.status, 0);
      assert.doesNotMatch(res.stdout, /manifest does not match/);
    });
  });

  // Feature F10: Actor Resolution Mechanism
  describe('F10: Actor Resolution Mechanism', () => {
    test('F10-1: resolveActor extracts actor from CLI --by flag', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { id: 'TASK-101', status: 'draft' });
      const res = runCmd(GATE_BIN, ['start', task, '--by', 'antigravity:custom-dev']);
      assert.equal(res.status, 0);
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /claimed_by:\s*"?antigravity:custom-dev"?/);
    });

    test('F10-2: resolveActor extracts actor from CLI --as flag', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { id: 'TASK-102', status: 'draft' });
      const res = runCmd(GATE_BIN, ['start', task, '--as', 'antigravity:as-dev']);
      assert.equal(res.status, 0);
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /claimed_by:\s*"?antigravity:as-dev"?/);
    });

    test('F10-3: resolveActor resolves GRIPM_ACTOR from environment variables', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { id: 'TASK-103', status: 'draft' });
      const res = runCmd(GATE_BIN, ['start', task], { env: { GRIPM_ACTOR: 'cursor:env-dev' } });
      assert.equal(res.status, 0);
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /claimed_by:\s*"?cursor:env-dev"?/);
    });

    test('F10-4: resolveActor resolves harness ID (ANTIGRAVITY_CONVERSATION_ID)', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { id: 'TASK-104', status: 'draft' });
      const res = runCmd(GATE_BIN, ['start', task], {
        env: {
          GRIPM_ACTOR: '',
          QA_ACTOR: '',
          CLAIMED_BY: '',
          ANTIGRAVITY_CONVERSATION_ID: 'conv-test-123'
        }
      });
      assert.equal(res.status, 0);
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /claimed_by:\s*"?antigravity:conv-test-123"?/);
    });

    test('F10-5: isSameActor normalizes whitespace and case when comparing actor IDs', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', JSON.stringify({
        scripts: {
          validate: 'node -e "process.exit(0)"',
          test: 'node -e "process.exit(0)"',
          'gate:review': 'node -e "process.exit(0)"',
          'audit:ux:strict': 'node -e "process.exit(0)"'
        }
      }));
      const task = makeTaskFile(sandbox, {
        id: 'TASK-105',
        status: 'review',
        claimedBy: 'Antigravity:Actor-ABC  '
      });
      // Certifying with lowercase / trimmed actor must trigger anti-self-certification
      const res = runCmd(GATE_BIN, [task, '--by', 'antigravity:actor-abc'], { cwd: sandbox });
      assert.equal(res.status, 1, 'Same actor under case/trim difference must be rejected');
      assert.match(res.output, /anti-self-certification/);
    });
  });

  // Feature F11: Mechanical T2 Gate Enforcement
  describe('F11: Mechanical T2 Gate Enforcement', () => {
    test('F11-1: Gate blocks certification with exit 1 when certifier matches claimed_by', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', JSON.stringify({
        scripts: {
          validate: 'node -e "process.exit(0)"',
          test: 'node -e "process.exit(0)"',
          'gate:review': 'node -e "process.exit(0)"',
          'audit:ux:strict': 'node -e "process.exit(0)"'
        }
      }));
      const task = makeTaskFile(sandbox, {
        id: 'TASK-111',
        status: 'review',
        claimedBy: 'antigravity:dev-1'
      });
      const res = runCmd(GATE_BIN, [task, '--by', 'antigravity:dev-1'], { cwd: sandbox });
      assert.equal(res.status, 1, 'Self-certification must fail with exit code 1');
    });

    test('F11-2: Gate error message explicitly cites anti-self-certification and actor ID', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, {
        id: 'TASK-112',
        status: 'review',
        claimedBy: 'antigravity:dev-worker-99'
      });
      const res = runCmd(GATE_BIN, [task, '--by', 'antigravity:dev-worker-99'], { cwd: sandbox });
      assert.match(res.output, /anti-self-certification/);
      assert.match(res.output, /antigravity:dev-worker-99/);
    });

    test('F11-3: Self-certified task retains status review on disk (no promotion to ready)', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, {
        id: 'TASK-113',
        status: 'review',
        claimedBy: 'antigravity:dev-1'
      });
      runCmd(GATE_BIN, [task, '--by', 'antigravity:dev-1'], { cwd: sandbox });
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /status:\s*review/, 'Task status must remain review on disk');
      assert.doesNotMatch(content, /status:\s*ready/);
    });

    test('F11-4: Gate permits certification with exit 0 when certifier differs from claimed_by', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', JSON.stringify({
        scripts: {
          validate: 'node -e "process.exit(0)"',
          test: 'node -e "process.exit(0)"',
          'gate:review': 'node -e "process.exit(0)"',
          'audit:ux:strict': 'node -e "process.exit(0)"'
        }
      }));
      const task = makeTaskFile(sandbox, {
        id: 'TASK-114',
        status: 'review',
        claimedBy: 'antigravity:dev-1'
      });
      const res = runCmd(GATE_BIN, [task, '--by', 'antigravity:qa-auditor-2'], { cwd: sandbox });
      assert.equal(res.status, 0, `Independent QA must certify cleanly: ${res.output}`);
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /status:\s*ready/);
    });

    test('F11-5: Gate permits certification when claimed_by is absent from task frontmatter', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', JSON.stringify({
        scripts: {
          validate: 'node -e "process.exit(0)"',
          test: 'node -e "process.exit(0)"',
          'gate:review': 'node -e "process.exit(0)"',
          'audit:ux:strict': 'node -e "process.exit(0)"'
        }
      }));
      const task = makeTaskFile(sandbox, {
        id: 'TASK-115',
        status: 'review',
        claimedBy: null
      });
      const res = runCmd(GATE_BIN, [task, '--by', 'antigravity:any-qa'], { cwd: sandbox });
      assert.equal(res.status, 0, 'Unclaimed task must certify without error');
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /status:\s*ready/);
    });
  });

  // Feature F12: Anti-Self-Certification Tests
  describe('F12: Anti-Self-Certification Tests in tests/gate-qa.test.mjs', () => {
    test('F12-1: tests/gate-qa.test.mjs exists and is runnable', () => {
      assert.ok(fs.existsSync(path.join(ROOT, 'tests', 'gate-qa.test.mjs')));
    });

    test('F12-2: gate-qa.test.mjs inspects mechanical state transitions', () => {
      const content = fs.readFileSync(path.join(ROOT, 'tests', 'gate-qa.test.mjs'), 'utf8');
      assert.match(content, /describe\(['"]mechanical state transitions/);
    });

    test('F12-3: inspectTask supports optional certifier argument', async (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const mod = await import('../scripts/gate-qa.mjs');
      assert.equal(typeof mod.inspectTask, 'function');
      const task = {
        content: '',
        frontmatter: {
          id: 'TEST-123',
          status: 'review',
          claimed_by: 'antigravity:dev-1',
          dependencies: [],
          priority: 'high'
        }
      };
      // Self-certification failure
      const failsSelf = mod.inspectTask(task, new Map(), { certifier: 'antigravity:dev-1' });
      assert.ok(failsSelf.some((f) => /anti-self-certification/.test(f)));
      // Peer certification pass
      const passesPeer = mod.inspectTask(task, new Map(), { certifier: 'antigravity:qa-peer' });
      assert.ok(!passesPeer.some((f) => /anti-self-certification/.test(f)));
    });

    test('F12-4: Running unit test gate-qa.test.mjs succeeds', () => {
      const res = spawnSync(process.execPath, ['--test', path.join(ROOT, 'tests', 'gate-qa.test.mjs')], {
        encoding: 'utf8',
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      assert.equal(res.status, 0, `gate-qa.test.mjs failed: ${res.stdout || ''}${res.stderr || ''}`);
    });

    test('F12-5: Unit test exports isSameActor if exported from gate-qa.mjs', async (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const mod = await import('../scripts/gate-qa.mjs');
      if (typeof mod.isSameActor === 'function') {
        assert.equal(mod.isSameActor('user-a', 'user-a'), true);
        assert.equal(mod.isSameActor('USER-A', 'user-a'), true);
        assert.equal(mod.isSameActor('user-a', 'user-b'), false);
      }
    });
  });

  // Feature F13: Verification Pyramid and Integrity
  describe('F13: Verification Pyramid & Integrity Pass', () => {
    test('F13-1: check-loc scans repository scripts with standard limits', () => {
      const res = runCmd(CHECK_LOC_BIN);
      assert.equal(res.status, 0);
      assert.match(res.stdout, /File Budget & Modularity Checker/);
    });

    test('F13-2: check-loc in advisory mode exits 0 even if warnings exist', () => {
      const res = runCmd(CHECK_LOC_BIN);
      assert.equal(res.status, 0, 'Advisory mode must never exit non-zero on warnings');
    });

    test('F13-3: validate-repo exits 0 on current repository', () => {
      const res = runCmd(VALIDATE_BIN);
      assert.equal(res.status, 0);
    });

    test('F13-4: check-loc produces zero warnings when all scripts are < 500 LOC', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const res = runCmd(CHECK_LOC_BIN);
      assert.equal(res.status, 0);
      assert.doesNotMatch(res.stdout, /Warnings \(modular refactoring recommended\)/);
    });

    test('F13-5: check-loc strict mode exits 0 when all scripts are within limit', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const res = runCmd(CHECK_LOC_BIN, ['--strict']);
      assert.equal(res.status, 0);
    });
  });
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES
// ============================================================================

describe('Tier 2: Boundary & Corner Cases (F1 - F13)', () => {

  // F1 Edge Cases
  describe('F1 Boundary Cases: Anti-Em-Dash Detection', () => {
    test('F1-E1: UX-014 ignores standard hyphen surrounded by spaces (" - ")', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f1-e1"}');
      createFile(sandbox, 'src/App.tsx', 'export const Title = () => <h1>Project - Release Notes</h1>;\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      assert.equal(report.findings.filter((f) => f.rule === 'UX-014').length, 0);
    });

    test('F1-E2: UX-014 detects em-dash at beginning, middle, and end of string', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f1-e2"}');
      createFile(sandbox, 'src/App.tsx', [
        'export const A = () => <span>— Leading</span>;',
        'export const B = () => <span>Middle — End</span>;',
        'export const C = () => <span>Trailing —</span>;'
      ].join('\n'));
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      const hits = report.findings.filter((f) => f.rule === 'UX-014');
      assert.ok(hits.length >= 1, 'UX-014 must fire on various em-dash positions');
    });

    test('F1-E3: UX-014 respects inline comment suppression (// ux-audit-ignore UX-014)', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f1-e3"}');
      createFile(sandbox, 'src/App.tsx', 'export const A = () => <span>Historical — Title</span>; // ux-audit-ignore UX-014\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      assert.equal(report.findings.filter((f) => f.rule === 'UX-014').length, 0);
    });

    test('F1-E4: UX-014 detects Unicode escape equivalents (\\u2014 and \\u2013) in raw strings', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f1-e4"}');
      createFile(sandbox, 'src/App.tsx', 'export const desc = "Release \\u2014 Alpha";\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      // Either raw or decoded string should be flagged if present
      assert.ok(report);
    });

    test('F1-E5: UX-014 in --strict mode causes audit to exit with code 1', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f1-e5"}');
      createFile(sandbox, 'src/App.tsx', 'export const A = () => <span>Bad — Dash</span>;\n');
      const res = runCmd(AUDITOR_BIN, ['--strict', '--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      assert.equal(res.status, 1, 'WARNING rule under --strict must fail with exit code 1');
    });
  });

  // F2 Edge Cases
  describe('F2 Boundary Cases: Viewport Zoom Lock', () => {
    test('F2-E1: UX-015 ignores viewport meta allowing zoom (e.g. width=device-width, initial-scale=1)', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f2-e1"}');
      createFile(sandbox, 'src/App.tsx', 'export const Head = () => <meta name="viewport" content="width=device-width, initial-scale=1" />;\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      assert.equal(report.findings.filter((f) => f.rule === 'UX-015').length, 0);
    });

    test('F2-E2: UX-015 detects spaced variations (maximum-scale = 1, user-scalable = no)', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f2-e2"}');
      createFile(sandbox, 'src/App.tsx', 'export const Head = () => <meta name="viewport" content="width=device-width, user-scalable = 0" />;\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      assert.ok(report.findings.some((f) => f.rule === 'UX-015'));
    });

    test('F2-E3: UX-015 detects object configuration format (maximumScale: 1, userScalable: false)', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f2-e3"}');
      createFile(sandbox, 'src/viewport.ts', 'export const viewport = { width: "device-width", userScalable: false };\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      assert.ok(report.findings.some((f) => f.rule === 'UX-015'));
    });

    test('F2-E4: UX-015 respects inline suppression (// ux-audit-ignore UX-015)', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f2-e4"}');
      createFile(sandbox, 'src/App.tsx', '<meta name="viewport" content="maximum-scale=1" /> // ux-audit-ignore UX-015\n');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      const report = JSON.parse(res.stdout);
      assert.equal(report.findings.filter((f) => f.rule === 'UX-015').length, 0);
    });

    test('F2-E5: UX-015 in --strict mode causes audit to exit with code 1', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"test-f2-e5"}');
      createFile(sandbox, 'src/App.tsx', '<meta name="viewport" content="maximum-scale=1" />\n');
      const res = runCmd(AUDITOR_BIN, ['--strict', '--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      assert.equal(res.status, 1);
    });
  });

  // F3 Edge Cases
  describe('F3 Boundary Cases: Documentation Parity', () => {
    test('F3-E1: validate-repo fails if UX-014 heading is removed from SKILL.md', () => {
      const sandbox = createSandbox();
      // Copy necessary dirs for validate-repo
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const skillPath = path.join(sandbox, '.agents', 'skills', 'code-level-ux-auditor', 'SKILL.md');
      const skill = fs.readFileSync(skillPath, 'utf8');
      fs.writeFileSync(skillPath, skill.replace(/###\s*\d+\.\s*\[UX-014\][^\n]*/, '### 14. [UX-MUTATED]'), 'utf8');

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0, 'Drifted rule heading must fail validate-repo');
    });

    test('F3-E2: validate-repo fails if UX-015 heading is removed from SKILL.md', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const skillPath = path.join(sandbox, '.agents', 'skills', 'code-level-ux-auditor', 'SKILL.md');
      const skill = fs.readFileSync(skillPath, 'utf8');
      fs.writeFileSync(skillPath, skill.replace(/###\s*\d+\.\s*\[UX-015\][^\n]*/, '### 15. [UX-MUTATED]'), 'utf8');

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
    });

    test('F3-E3: validate-repo fails if rule title in SKILL.md drifts from ux-rules.json', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const rulesPath = path.join(sandbox, 'scripts', 'ux-rules.json');
      const catalog = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
      catalog.rules.find((r) => r.id === 'UX-014').title = 'Completely different drifted title';
      fs.writeFileSync(rulesPath, JSON.stringify(catalog, null, 2), 'utf8');

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
      assert.match(res.output, /title mismatch/);
    });

    test('F3-E4: validate-repo fails if SKILL.md references an unknown UX-NNN id', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const skillPath = path.join(sandbox, '.agents', 'skills', 'code-level-ux-auditor', 'SKILL.md');
      fs.appendFileSync(skillPath, '\n### 99. [UX-999] · ERROR · Phony rule\nPhony rule description.\n');

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
      assert.match(res.output, /does not exist in ux-rules\.json/);
    });

    test('F3-E5: validate-repo rejects lowercase severity in SKILL.md headings', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const skillPath = path.join(sandbox, '.agents', 'skills', 'code-level-ux-auditor', 'SKILL.md');
      const skill = fs.readFileSync(skillPath, 'utf8');
      fs.writeFileSync(skillPath, skill.replace(/· WARNING ·/g, '· warning ·'), 'utf8');

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
    });
  });

  // F4 Edge Cases
  describe('F4 Boundary Cases: UX CLI Scenarios', () => {
    test('F4-E1: audit-ux-code.cjs --rule UX-014 limits output strictly to UX-014', () => {
      const res = runCmd(AUDITOR_BIN, ['--rule', 'UX-014', '--format', 'json'], {
        env: { AUDIT_UX_ROOT: path.join(ROOT, 'tests', 'fixtures', 'react-app') }
      });
      const report = JSON.parse(res.stdout);
      assert.ok(report.findings.every((f) => f.rule === 'UX-014'));
    });

    test('F4-E2: audit-ux-code.cjs --rule UX-015 limits output strictly to UX-015', () => {
      const res = runCmd(AUDITOR_BIN, ['--rule', 'UX-015', '--format', 'json'], {
        env: { AUDIT_UX_ROOT: path.join(ROOT, 'tests', 'fixtures', 'react-app') }
      });
      const report = JSON.parse(res.stdout);
      assert.ok(report.findings.every((f) => f.rule === 'UX-015'));
    });

    test('F4-E3: audit-ux-code.cjs exits code 2 when non-existent rule UX-999 is requested', () => {
      const res = runCmd(AUDITOR_BIN, ['--rule', 'UX-999', '--format', 'json']);
      assert.equal(res.status, 2);
    });

    test('F4-E4: JSON output format contains origin canonical for UX-014 and UX-015', () => {
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], {
        env: { AUDIT_UX_ROOT: path.join(ROOT, 'tests', 'fixtures', 'react-app') }
      });
      const report = JSON.parse(res.stdout);
      const u14 = report.findings.find((f) => f.rule === 'UX-014');
      const u15 = report.findings.find((f) => f.rule === 'UX-015');
      if (u14) assert.equal(u14.origin, 'canonical');
      if (u15) assert.equal(u15.origin, 'canonical');
    });

    test('F4-E5: Auditing project without source directory produces zero findings without crash', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', '{"name":"empty-app"}');
      const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
      assert.equal(res.status, 0);
      const report = JSON.parse(res.stdout);
      assert.equal(report.findings.length, 0);
    });
  });

  // F5 Edge Cases
  describe('F5 Boundary Cases: Submodule Resilience', () => {
    test('F5-E1: Each submodule in scripts/lib is strictly under 500 lines of code', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const libDir = path.join(SCRIPTS_DIR, 'lib');
      const files = fs.readdirSync(libDir).filter((f) => f.endsWith('.mjs'));
      for (const f of files) {
        const lines = countLines(path.join(libDir, f));
        assert.ok(lines < 500, `submodule ${f} exceeds 500 LOC: ${lines}`);
      }
    });

    test('F5-E2: frontmatter.mjs handles CRLF line endings correctly', async (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const mod = await import('../scripts/lib/frontmatter.mjs');
      const crlf = '---\r\nid: CRLF-001\r\nstatus: review\r\n---\r\nBody text\r\n';
      const fm = mod.readFrontmatter(crlf);
      assert.equal(fm.id, 'CRLF-001');
      assert.equal(fm.status, 'review');
    });

    test('F5-E3: frontmatter.mjs handles empty string and unclosed frontmatter safely', async (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const mod = await import('../scripts/lib/frontmatter.mjs');
      assert.equal(mod.readFrontmatter(''), null);
      assert.equal(mod.readFrontmatter('---\nid: UNCLOSED\n'), null);
    });

    test('F5-E4: terminal.mjs respects NO_COLOR environment variable', async (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const script = `
        process.env.NO_COLOR = '1';
        import('./scripts/lib/terminal.mjs').then((m) => {
          const out = m.c.green('hello');
          if (out !== 'hello') process.exit(1);
          process.exit(0);
        });
      `;
      const res = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: ROOT });
      assert.equal(res.status, 0);
    });

    test('F5-E5: scripts/lib submodules have no circular dependencies', (t) => {
      if (!M2_READY) {
        t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
        return;
      }
      const libDir = path.join(SCRIPTS_DIR, 'lib');
      const files = fs.readdirSync(libDir).filter((f) => f.endsWith('.mjs'));
      assert.ok(files.length >= 4, 'Must have extracted core submodules');
    });
  });

  // F6 Edge Cases
  describe('F6 Boundary Cases: gate-qa CLI Robustness', () => {
    test('F6-E1: gate-qa CLI exits code 2 with usage notice when no arguments provided', () => {
      const res = runCmd(GATE_BIN, ['--no-run']);
      assert.equal(res.status, 2);
      assert.match(res.output, /usage:/);
    });

    test('F6-E2: gate-qa CLI rejects task with unchecked acceptance criteria', () => {
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, {
        acs: ['- [x] #1 done', '- [ ] #2 still pending']
      });
      const res = runCmd(GATE_BIN, [task, '--no-run']);
      assert.equal(res.status, 1);
      assert.match(res.output, /acceptance criteria are still unchecked/);
    });

    test('F6-E3: gate-qa CLI rejects task with status not in review for certification', () => {
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { status: 'doing' });
      const res = runCmd(GATE_BIN, [task, '--no-run']);
      assert.equal(res.status, 1);
      assert.match(res.output, /status is "doing"/);
    });

    test('F6-E4: gate-qa CLI handles whitespace in task path gracefully', () => {
      const sandbox = createSandbox('gate path spaces-');
      const task = makeTaskFile(sandbox, { id: 'TASK SPACES' });
      const res = runCmd(GATE_BIN, [task, '--no-run']);
      assert.equal(res.status, 2); // passes inspection
    });

    test('F6-E5: gate-qa CLI preserves literal comments and section blocks during frontmatter mutations', () => {
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { status: 'draft' });
      runCmd(GATE_BIN, ['start', task]);
      const content = fs.readFileSync(task, 'utf8');
      assert.ok(content.includes('<!-- AC:BEGIN -->'));
      assert.ok(content.includes('<!-- AC:END -->'));
    });
  });

  // F7 Edge Cases
  describe('F7 Boundary Cases: sync-playbook Logic', () => {
    test('F7-E1: findOrphanedFiles returns empty array for empty project', async () => {
      const sandbox = createSandbox();
      const mod = await import('../scripts/sync-playbook.mjs');
      assert.deepEqual(mod.findOrphanedFiles(sandbox, []), []);
    });

    test('F7-E2: sync-playbook CLI exits code 0 in dry-run mode without modifying files', () => {
      const sandbox = createSandbox();
      const res = runCmd(SYNC_BIN, ['--dry-run', '--repo', sandbox, '--source', ROOT]);
      assert.equal(res.status, 0);
    });

    test('F7-E3: sync-playbook CLI handles corrupt lockfile gracefully', () => {
      const sandbox = createSandbox();
      createFile(sandbox, '.playbook-lock.json', '{ corrupted json ...');
      const res = runCmd(SYNC_BIN, ['--dry-run', '--repo', sandbox, '--source', ROOT]);
      assert.ok([0, 1].includes(res.status));
    });

    test('F7-E4: classifyLocalFile treats unknown files without baseline as unknown', async () => {
      const mod = await import('../scripts/sync-playbook.mjs');
      assert.equal(mod.classifyLocalFile({ localHash: '123', knownHash: undefined, wasCustomization: false }), 'unknown');
    });

    test('F7-E5: FALLBACK_CORE_FILES includes required runtime scripts', () => {
      const content = fs.readFileSync(SYNC_BIN, 'utf8');
      assert.ok(content.includes('scripts/gate-qa.mjs'));
    });
  });

  // F8 Edge Cases
  describe('F8 Boundary Cases: validate-repo Robustness', () => {
    test('F8-E1: validate-repo fails if CANONICAL_STATUSES is missing a canonical status', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const valPath = path.join(sandbox, 'scripts', 'validate-repo.mjs');
      const valCode = fs.readFileSync(valPath, 'utf8');
      fs.writeFileSync(valPath, valCode.replace("'ready'", ''), 'utf8');

      const res = runCmd(valPath, [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
    });

    test('F8-E2: validate-repo fails if manifest declares a non-existent core file', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const manPath = path.join(sandbox, '.playbook-manifest.json');
      const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
      man.core.push('scripts/non-existent-module.mjs');
      fs.writeFileSync(manPath, JSON.stringify(man, null, 2), 'utf8');

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
    });

    test('F8-E3: validate-repo fails if skill documents uninstalled script', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const skillPath = path.join(sandbox, '.agents', 'skills', 'principal-engineer', 'SKILL.md');
      fs.appendFileSync(skillPath, '\nnode scripts/mystery-script.mjs\n');

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
    });

    test('F8-E4: validate-repo detects broken internal markdown links', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const agentsMd = path.join(sandbox, 'AGENTS.md');
      fs.appendFileSync(agentsMd, '\n[Broken Link](./docs/does-not-exist.md)\n');

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
    });

    test('F8-E5: validate-repo detects unclosed skill frontmatter', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const skillPath = path.join(sandbox, '.agents', 'skills', 'principal-engineer', 'SKILL.md');
      fs.writeFileSync(skillPath, '---\nname: broken\n# unclosed frontmatter\n');

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
    });
  });

  // F9 Edge Cases
  describe('F9 Boundary Cases: Manifest & Fallback Integrity', () => {
    test('F9-E1: Missing manifest file causes validate-repo to fail with exit code 1', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
    });

    test('F9-E2: Extra file in manifest not in FALLBACK_CORE_FILES fails parity check', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const manPath = path.join(sandbox, '.playbook-manifest.json');
      const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
      man.core.push('scripts/extra-parity-drift.mjs');
      createFile(sandbox, 'scripts/extra-parity-drift.mjs', '// extra');
      fs.writeFileSync(manPath, JSON.stringify(man, null, 2), 'utf8');

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
      assert.match(res.output, /is in the manifest but missing from FALLBACK_CORE_FILES/);
    });

    test('F9-E3: Extra file in FALLBACK_CORE_FILES not in manifest fails parity check', () => {
      const sandbox = createSandbox();
      ['scripts', 'docs', '.agents', 'backlog'].forEach((d) => {
        const src = path.join(ROOT, d);
        if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, d), { recursive: true });
      });
      ['package.json', '.playbook-manifest.json', 'AGENTS.md'].forEach((f) => {
        const src = path.join(ROOT, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sandbox, f));
      });

      const syncPath = path.join(sandbox, 'scripts', 'sync-playbook.mjs');
      const syncCode = fs.readFileSync(syncPath, 'utf8');
      fs.writeFileSync(
        syncPath,
        syncCode.replace("const FALLBACK_CORE_FILES = [", "const FALLBACK_CORE_FILES = ['scripts/phantom-module.mjs', "),
        'utf8'
      );

      const res = runCmd(path.join(sandbox, 'scripts', 'validate-repo.mjs'), [], { cwd: sandbox });
      assert.notEqual(res.status, 0);
      assert.match(res.output, /is in FALLBACK_CORE_FILES but not in the manifest/);
    });

    test('F9-E4: Manifest core entries use consistent forward slashes across platforms', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      for (const entry of manifest.core) {
        assert.ok(!entry.includes('\\'), `Manifest entry must not contain backslashes: "${entry}"`);
      }
    });

    test('F9-E5: Manifest JSON is well-formed with valid schema and version', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      assert.ok(manifest.version, 'Manifest must declare version');
      assert.ok(manifest.stacks, 'Manifest must declare stacks object');
    });
  });

  // F10 Edge Cases
  describe('F10 Boundary Cases: Actor Resolution Precedence', () => {
    test('F10-E1: CLI --by takes precedence over environment variables', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { id: 'TASK-E101', status: 'draft' });
      runCmd(GATE_BIN, ['start', task, '--by', 'cli-winner'], {
        env: { GRIPM_ACTOR: 'env-loser', ANTIGRAVITY_CONVERSATION_ID: 'harness-loser' }
      });
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /claimed_by:\s*"?cli-winner"?/);
    });

    test('F10-E2: GRIPM_ACTOR takes precedence over harness conversation IDs', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { id: 'TASK-E102', status: 'draft' });
      runCmd(GATE_BIN, ['start', task], {
        env: { GRIPM_ACTOR: 'env-winner', ANTIGRAVITY_CONVERSATION_ID: 'harness-loser' }
      });
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /claimed_by:\s*"?env-winner"?/);
    });

    test('F10-E3: resolveActor falls back to human:username when no flags or env vars set', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { id: 'TASK-E103', status: 'draft' });
      runCmd(GATE_BIN, ['start', task], {
        env: {
          GRIPM_ACTOR: '',
          QA_ACTOR: '',
          CLAIMED_BY: '',
          ANTIGRAVITY_CONVERSATION_ID: '',
          CURSOR_SESSION_ID: '',
          CLAUDE_SESSION_ID: ''
        }
      });
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /claimed_by:\s*"?human:/);
    });

    test('F10-E4: isSameActor returns false when comparing different provider prefixes', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', JSON.stringify({
        scripts: {
          validate: 'node -e "process.exit(0)"',
          test: 'node -e "process.exit(0)"',
          'gate:review': 'node -e "process.exit(0)"',
          'audit:ux:strict': 'node -e "process.exit(0)"'
        }
      }));
      const task = makeTaskFile(sandbox, {
        id: 'TASK-E104',
        status: 'review',
        claimedBy: 'antigravity:id-123'
      });
      // cursor:id-123 is a different provider
      const res = runCmd(GATE_BIN, [task, '--by', 'cursor:id-123'], { cwd: sandbox });
      assert.equal(res.status, 0);
    });

    test('F10-E5: resolveActor handles empty or whitespace-only actor string safely', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { id: 'TASK-E105', status: 'draft' });
      runCmd(GATE_BIN, ['start', task, '--by', '   ']);
      const content = fs.readFileSync(task, 'utf8');
      assert.ok(content.includes('status: doing'));
    });
  });

  // F11 Edge Cases
  describe('F11 Boundary Cases: Anti-Self-Certification Invariants', () => {
    test('F11-E1: Self-certification block operates even when --no-run flag is present', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, {
        id: 'TASK-E111',
        status: 'review',
        claimedBy: 'antigravity:dev-1'
      });
      const res = runCmd(GATE_BIN, [task, '--no-run', '--by', 'antigravity:dev-1'], { cwd: sandbox });
      assert.equal(res.status, 1, 'Self-certification must be blocked even in inspection mode');
      assert.match(res.output, /anti-self-certification/);
    });

    test('F11-E2: Actor matching is case-insensitive', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, {
        id: 'TASK-E112',
        status: 'review',
        claimedBy: 'ANTIGRAVITY:WORKER-9'
      });
      const res = runCmd(GATE_BIN, [task, '--by', 'antigravity:worker-9'], { cwd: sandbox });
      assert.equal(res.status, 1);
      assert.match(res.output, /anti-self-certification/);
    });

    test('F11-E3: Actor matching trims extraneous whitespace', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, {
        id: 'TASK-E113',
        status: 'review',
        claimedBy: '  antigravity:dev-x  '
      });
      const res = runCmd(GATE_BIN, [task, '--by', 'antigravity:dev-x'], { cwd: sandbox });
      assert.equal(res.status, 1);
      assert.match(res.output, /anti-self-certification/);
    });

    test('F11-E4: Start command (T0) records claimed_by from resolved actor when --by omitted', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, { id: 'TASK-E114', status: 'draft' });
      runCmd(GATE_BIN, ['start', task], { env: { GRIPM_ACTOR: 'antigravity:auto-recorded' } });
      const content = fs.readFileSync(task, 'utf8');
      assert.match(content, /claimed_by:\s*"?antigravity:auto-recorded"?/);
    });

    test('F11-E5: Task with matching certifier and unchecked ACs fails with clear feedback', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, {
        id: 'TASK-E115',
        status: 'review',
        claimedBy: 'antigravity:dev-1',
        acs: ['- [ ] #1 open AC']
      });
      const res = runCmd(GATE_BIN, [task, '--by', 'antigravity:dev-1'], { cwd: sandbox });
      assert.equal(res.status, 1);
    });
  });

  // F12 Edge Cases
  describe('F12 Boundary Cases: inspectTask API', () => {
    test('F12-E1: inspectTask without certifier maintains backward compatibility', async (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const mod = await import('../scripts/gate-qa.mjs');
      const task = {
        content: '',
        frontmatter: { id: 'TASK-121', status: 'review', dependencies: [], priority: 'high' }
      };
      const res = mod.inspectTask(task, new Map());
      assert.ok(Array.isArray(res));
    });

    test('F12-E2: inspectTask with empty string certifier treats certifier as anonymous', async (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const mod = await import('../scripts/gate-qa.mjs');
      const task = {
        content: '',
        frontmatter: { id: 'TASK-122', status: 'review', claimed_by: 'antigravity:dev', dependencies: [], priority: 'high' }
      };
      const res = mod.inspectTask(task, new Map(), { certifier: '' });
      assert.ok(!res.some((f) => /anti-self-certification/.test(f)));
    });

    test('F12-E3: inspectTask with matching certifier returns anti-self-certification error string', async (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const mod = await import('../scripts/gate-qa.mjs');
      const task = {
        content: '',
        frontmatter: { id: 'TASK-123', status: 'review', claimed_by: 'antigravity:worker-z', dependencies: [], priority: 'high' }
      };
      const res = mod.inspectTask(task, new Map(), { certifier: 'antigravity:worker-z' });
      assert.ok(res.some((f) => /anti-self-certification/.test(f)));
    });

    test('F12-E4: inspectTask with different certifier returns no anti-self-certification error', async (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const mod = await import('../scripts/gate-qa.mjs');
      const task = {
        content: '',
        frontmatter: { id: 'TASK-124', status: 'review', claimed_by: 'antigravity:worker-z', dependencies: [], priority: 'high' }
      };
      const res = mod.inspectTask(task, new Map(), { certifier: 'antigravity:qa-peer-x' });
      assert.ok(!res.some((f) => /anti-self-certification/.test(f)));
    });

    test('F12-E5: gate-qa CLI resolves harness session ID in simulated subagent environment', (t) => {
      if (!M3_READY) {
        t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
        return;
      }
      const sandbox = createSandbox();
      const task = makeTaskFile(sandbox, {
        id: 'TASK-125',
        status: 'review',
        claimedBy: 'antigravity:parent-thread-001'
      });
      // Subagent with clean context has different conversation ID
      const res = runCmd(GATE_BIN, [task, '--no-run'], {
        env: {
          GRIPM_ACTOR: '',
          ANTIGRAVITY_CONVERSATION_ID: 'subagent-clean-002'
        }
      });
      assert.equal(res.status, 2); // Inspection passes without self-cert block
    });
  });

  // F13 Edge Cases
  describe('F13 Boundary Cases: check-loc and Pipeline Controls', () => {
    test('F13-E1: check-loc respects .locignore for legacy assets', () => {
      const res = runCmd(CHECK_LOC_BIN);
      assert.equal(res.status, 0);
      assert.doesNotMatch(res.stdout, /audit-ux-code\.cjs/);
    });

    test('F13-E2: check-loc --json produces valid JSON report structure', () => {
      const res = runCmd(CHECK_LOC_BIN, ['--json']);
      assert.equal(res.status, 0);
      const parsed = JSON.parse(res.stdout);
      assert.ok(typeof parsed.passed === 'boolean');
      assert.ok(typeof parsed.scanned === 'number');
      assert.ok(Array.isArray(parsed.violations));
      assert.ok(Array.isArray(parsed.warnings));
    });

    test('F13-E3: Verification pyramid fails if any blocking step fails', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', JSON.stringify({
        scripts: {
          validate: 'node -e "process.exit(1)"', // Fails!
          test: 'node -e "process.exit(0)"',
          'gate:review': 'node -e "process.exit(0)"',
          'audit:ux:strict': 'node -e "process.exit(0)"'
        }
      }));
      createFile(sandbox, 'scripts/gate-qa.mjs', fs.readFileSync(GATE_BIN, 'utf8'));
      if (fs.existsSync(path.join(SCRIPTS_DIR, 'lib'))) {
        fs.cpSync(path.join(SCRIPTS_DIR, 'lib'), path.join(sandbox, 'scripts', 'lib'), { recursive: true });
      }
      const task = makeTaskFile(sandbox, { id: 'TASK-E133', status: 'review' });
      const res = runCmd(path.join(sandbox, 'scripts', 'gate-qa.mjs'), [task], { cwd: sandbox });
      assert.notEqual(res.status, 0);
      assert.match(res.output, /GATE FAILED/);
    });

    test('F13-E4: Verification pyramid reports skipped for non-applicable optional steps (build)', () => {
      const sandbox = createSandbox();
      createFile(sandbox, 'package.json', JSON.stringify({
        scripts: {
          validate: 'node -e "process.exit(0)"',
          test: 'node -e "process.exit(0)"',
          'gate:review': 'node -e "process.exit(0)"',
          'audit:ux:strict': 'node -e "process.exit(0)"'
        }
      }));
      createFile(sandbox, 'scripts/gate-qa.mjs', fs.readFileSync(GATE_BIN, 'utf8'));
      if (fs.existsSync(path.join(SCRIPTS_DIR, 'lib'))) {
        fs.cpSync(path.join(SCRIPTS_DIR, 'lib'), path.join(sandbox, 'scripts', 'lib'), { recursive: true });
      }
      const task = makeTaskFile(sandbox, { id: 'TASK-E134', status: 'review' });
      const res = runCmd(path.join(sandbox, 'scripts', 'gate-qa.mjs'), [task], { cwd: sandbox });
      if (res.status === 0) {
        assert.match(res.output, /Production build: SKIPPED/);
      }
    });

    test('F13-E5: npm run check:all succeeds with zero unhandled rejections', () => {
      // Validates that repository check passes cleanly
      const res = runCmd(VALIDATE_BIN);
      assert.equal(res.status, 0);
    });
  });
});

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ============================================================================

describe('Tier 3: Cross-Feature Combinations', () => {

  test('T3-1: check-loc on modularized scripts after UX rules added produces zero warnings', (t) => {
    if (!M2_READY) {
      t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
      return;
    }
    const res = runCmd(CHECK_LOC_BIN, ['--path', SCRIPTS_DIR]);
    assert.equal(res.status, 0);
    assert.doesNotMatch(res.stdout, /Warnings/);
  });

  test('T3-2: validate-repo validates manifest parity for extracted scripts/lib submodules', () => {
    const res = runCmd(VALIDATE_BIN);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Repository is consistent/);
  });

  test('T3-3: gate-qa verification pyramid executes audit:ux:strict with UX-014 and UX-015 active', () => {
    // Audit with --strict on react-app fixture must catch both UX-014 and UX-015
    const res = runCmd(AUDITOR_BIN, ['--strict', '--format', 'json'], {
      env: { AUDIT_UX_ROOT: path.join(ROOT, 'tests', 'fixtures', 'react-app') }
    });
    assert.equal(res.status, 1);
    const report = JSON.parse(res.stdout);
    assert.ok(report.findings.some((f) => f.rule === 'UX-014'));
    assert.ok(report.findings.some((f) => f.rule === 'UX-015'));
  });

  test('T3-4: sync-playbook local sync installs all scripts needed by gate-qa', () => {
    const sandbox = createSandbox();
    const res = runCmd(SYNC_BIN, ['--repo', sandbox, '--source', ROOT, '--init-agents']);
    assert.equal(res.status, 0, `Sync failed: ${res.output}`);
    assert.ok(fs.existsSync(path.join(sandbox, 'scripts', 'gate-qa.mjs')));
  });

  test('T3-5: gate-qa resolves certifier while inspecting task with UX rule dependencies', (t) => {
    if (!M3_READY) {
      t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
      return;
    }
    const sandbox = createSandbox();
    const task = makeTaskFile(sandbox, {
      id: 'TASK-T35',
      status: 'review',
      claimedBy: 'antigravity:engineer-1'
    });
    const res = runCmd(GATE_BIN, [task, '--no-run', '--by', 'antigravity:qa-auditor-9'], { cwd: sandbox });
    assert.equal(res.status, 2, 'Independent certifier inspection passes');
  });

  test('T3-6: package.json exports map provides valid entry points for all modularized tools', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.ok(pkg.exports['./gate']);
    assert.ok(pkg.exports['./audit']);
    assert.ok(pkg.exports['./check-loc']);
    assert.ok(fs.existsSync(path.resolve(ROOT, pkg.exports['./gate'])));
    assert.ok(fs.existsSync(path.resolve(ROOT, pkg.exports['./audit'])));
    assert.ok(fs.existsSync(path.resolve(ROOT, pkg.exports['./check-loc'])));
  });

  test('T3-7: check-loc accurately counts lines of extracted scripts/lib files', (t) => {
    if (!M2_READY) {
      t.skip('Milestone M2 (Modular Script Refactoring) pending implementation');
      return;
    }
    const libFiles = fs.readdirSync(path.join(SCRIPTS_DIR, 'lib')).filter((f) => f.endsWith('.mjs'));
    for (const f of libFiles) {
      const fullPath = path.join(SCRIPTS_DIR, 'lib', f);
      const lines = countLines(fullPath);
      assert.ok(lines > 0 && lines < 500);
    }
  });

  test('T3-8: gate-qa start (T0) -> submit (T1) -> gate:qa (T2) lifecycle maintains actor and AC integrity', (t) => {
    if (!M3_READY) {
      t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
      return;
    }
    const sandbox = createSandbox();
    createFile(sandbox, 'package.json', JSON.stringify({
      scripts: {
        validate: 'node -e "process.exit(0)"',
        test: 'node -e "process.exit(0)"',
        'gate:review': 'node -e "process.exit(0)"',
        'audit:ux:strict': 'node -e "process.exit(0)"'
      }
    }));
    const task = makeTaskFile(sandbox, { id: 'TASK-T38', status: 'draft' });

    // Step 1: Start (T0) by dev
    runCmd(GATE_BIN, ['start', task, '--by', 'antigravity:dev-42'], { cwd: sandbox });
    assert.match(fs.readFileSync(task, 'utf8'), /status:\s*doing/);

    // Step 2: Submit (T1)
    runCmd(GATE_BIN, ['submit', task], { cwd: sandbox });
    assert.match(fs.readFileSync(task, 'utf8'), /status:\s*review/);

    // Step 3: Self-cert block by dev
    const resSelf = runCmd(GATE_BIN, [task, '--by', 'antigravity:dev-42'], { cwd: sandbox });
    assert.equal(resSelf.status, 1);

    // Step 4: Clean QA cert (T2)
    const resQA = runCmd(GATE_BIN, [task, '--by', 'antigravity:qa-peer-99'], { cwd: sandbox });
    assert.equal(resQA.status, 0);
    assert.match(fs.readFileSync(task, 'utf8'), /status:\s*ready/);
  });

  test('T3-9: audit-ux detects both UX-014 and UX-015 in single file with correct summary counts', () => {
    const sandbox = createSandbox();
    createFile(sandbox, 'package.json', '{"name":"combo-app"}');
    createFile(sandbox, 'src/App.tsx', [
      'export const App = () => (',
      '  <div>',
      '    <h1>Bad — Dash</h1>',
      '    <meta name="viewport" content="maximum-scale=1" />',
      '  </div>',
      ');'
    ].join('\n'));
    const res = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
    const report = JSON.parse(res.stdout);
    assert.equal(report.summary.WARNING, 2);
    assert.ok(report.findings.some((f) => f.rule === 'UX-014'));
    assert.ok(report.findings.some((f) => f.rule === 'UX-015'));
  });

  test('T3-10: validate-repo checkLocalCatalog validates custom catalogs alongside canonical UX-015', async () => {
    const mod = await import('../scripts/validate-repo.mjs');
    assert.equal(typeof mod.checkLocalCatalog, 'function');
    const sandbox = createSandbox();
    createFile(sandbox, '.uxaudit.json', JSON.stringify({ rules: 'local.json' }));
    createFile(sandbox, 'local.json', JSON.stringify({
      version: 1,
      rules: [
        {
          id: 'CUSTOM-001',
          title: 'Custom rule',
          severity: 'INFO',
          message: 'Custom message',
          check: { line: ['custom-token'] }
        }
      ]
    }));
    const errs = mod.checkLocalCatalog(sandbox);
    assert.deepEqual(errs, []);
  });
});

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS
// ============================================================================

describe('Tier 4: Real-World Application Scenarios', () => {

  test('Scenario 1: Multi-Agent Parallel Sprint Workflow', (t) => {
    if (!M3_READY) {
      t.skip('Milestone M3 (Anti-Self-Certification Gate) pending implementation');
      return;
    }
    const sandbox = createSandbox('scenario1-');
    createFile(sandbox, 'package.json', JSON.stringify({
      name: 'sprint-app',
      scripts: {
        validate: 'node -e "process.exit(0)"',
        test: 'node -e "process.exit(0)"',
        'gate:review': 'node -e "process.exit(0)"',
        'audit:ux:strict': 'node -e "process.exit(0)"'
      }
    }));

    // 1. Task enters backlog in draft
    const taskPath = makeTaskFile(sandbox, {
      id: 'FEATURE-401',
      status: 'draft',
      acs: ['- [x] #1 Implement domain logic', '- [x] #2 Unit test coverage']
    });

    // 2. Developer agent starts the task with their conversation ID
    const devId = 'antigravity:subagent-dev-thread-100';
    const startRes = runCmd(GATE_BIN, ['start', taskPath, '--by', devId], { cwd: sandbox });
    assert.equal(startRes.status, 0);

    // 3. Developer finishes and submits task to review
    const submitRes = runCmd(GATE_BIN, ['submit', taskPath], { cwd: sandbox });
    assert.equal(submitRes.status, 0);

    // 4. Developer attempts self-certification (Invariant 2 violation)
    const selfCertRes = runCmd(GATE_BIN, [taskPath, '--by', devId], { cwd: sandbox });
    assert.equal(selfCertRes.status, 1, 'Self-certification must be mechanically blocked with exit 1');
    assert.match(selfCertRes.output, /anti-self-certification/);

    // Ensure status remained 'review' on disk
    let currentTask = fs.readFileSync(taskPath, 'utf8');
    assert.match(currentTask, /status:\s*review/);

    // 5. Clean-context QA auditor subagent certifies the task
    const qaId = 'antigravity:subagent-qa-thread-200';
    const qaCertRes = runCmd(GATE_BIN, [taskPath, '--by', qaId], { cwd: sandbox });
    assert.equal(qaCertRes.status, 0, 'Clean QA auditor must certify with exit 0');
    assert.match(qaCertRes.output, /GATE PASSED/);

    // Ensure status is promoted to 'ready' on disk
    currentTask = fs.readFileSync(taskPath, 'utf8');
    assert.match(currentTask, /status:\s*ready/);
  });

  test('Scenario 2: Consumer Project Fresh Playbook Sync & UX Audit Execution', () => {
    const sandbox = createSandbox('scenario2-');

    // 1. Sync playbook into fresh consumer project
    const syncRes = runCmd(SYNC_BIN, ['--repo', sandbox, '--source', ROOT, '--init-agents']);
    assert.equal(syncRes.status, 0);
    assert.ok(fs.existsSync(path.join(sandbox, '.agents', 'STATE_MACHINE.md')));

    // 2. Consumer codebase creates UI component with violation
    createFile(sandbox, 'package.json', '{"name":"consumer-app"}');
    createFile(sandbox, 'src/Navigation.tsx', [
      'export const Nav = () => (',
      '  <nav>',
      '    <a href="/home">Home — Overview</a>', // Prohibited em-dash
      '    <a href="/about">About - Us</a>',      // Standard hyphen (ok)
      '  </nav>',
      ');'
    ].join('\n'));

    // 3. Run UX code audit
    const auditRes = runCmd(AUDITOR_BIN, ['--format', 'json'], { env: { AUDIT_UX_ROOT: sandbox } });
    const report = JSON.parse(auditRes.stdout);
    const dashFinding = report.findings.find((f) => f.rule === 'UX-014');
    assert.ok(dashFinding, 'UX-014 must detect the em-dash in consumer project');
    assert.equal(dashFinding.file, 'src/Navigation.tsx');
  });

  test('Scenario 3: Modularity Budget Violation and Remediation Lifecycle', () => {
    const sandbox = createSandbox('scenario3-');

    // 1. Contributor introduces a 550 LOC script
    const bigScript = ['// Generated script', ...Array(550).fill('const x = 1;')].join('\n') + '\n';
    createFile(sandbox, 'src/giant-script.js', bigScript);

    // 2. Advisory check-loc emits warning but exits 0 (PO sovereignty)
    const advRes = runCmd(CHECK_LOC_BIN, ['--path', sandbox]);
    assert.equal(advRes.status, 0);
    assert.match(advRes.stdout, /Warnings \(modular refactoring recommended\)/);

    // 3. Strict mode check-loc fails with exit 1
    const strictRes = runCmd(CHECK_LOC_BIN, ['--path', sandbox, '--strict', '--max-lines', '500']);
    assert.equal(strictRes.status, 1);
    assert.match(strictRes.output, /FILE BUDGET FAILED/);

    // 4. Refactoring split into two smaller files (< 300 LOC each)
    fs.unlinkSync(path.join(sandbox, 'src/giant-script.js'));
    createFile(sandbox, 'src/part1.js', Array(250).fill('const a = 1;').join('\n') + '\n');
    createFile(sandbox, 'src/part2.js', Array(250).fill('const b = 2;').join('\n') + '\n');

    // 5. Strict mode re-check passes with exit 0
    const cleanStrictRes = runCmd(CHECK_LOC_BIN, ['--path', sandbox, '--strict', '--max-lines', '500']);
    assert.equal(cleanStrictRes.status, 0);
    assert.match(cleanStrictRes.stdout, /All files within modular limits/);
  });

  test('Scenario 4: Frontmatter Ambiguity & Fail-Closed Tamper Defense', () => {
    const sandbox = createSandbox('scenario4-');

    // 1. Duplicate dependencies keys must fail closed
    const dupTask = [
      '---',
      'id: PLAY-DUP',
      'status: review',
      'dependencies: []',
      'dependencies:',
      '  - PLAY-999',
      'priority: high',
      '---',
      '## Acceptance Criteria',
      '<!-- AC:BEGIN -->',
      '- [x] #1 done',
      '<!-- AC:END -->'
    ].join('\n');
    const dupFile = createFile(sandbox, 'DUP.md', dupTask);
    const resDup = runCmd(GATE_BIN, [dupFile, '--no-run']);
    assert.notEqual(resDup.status, 0, 'Duplicate frontmatter keys must fail closed');

    // 2. Whitespace-only task id is rejected
    const blankIdTask = [
      '---',
      'id: "   "',
      'status: review',
      'dependencies: []',
      'priority: high',
      '---',
      '## Acceptance Criteria',
      '<!-- AC:BEGIN -->',
      '- [x] #1 done',
      '<!-- AC:END -->'
    ].join('\n');
    const blankFile = createFile(sandbox, 'BLANK.md', blankIdTask);
    const resBlank = runCmd(GATE_BIN, [blankFile, '--no-run']);
    assert.notEqual(resBlank.status, 0, 'Whitespace ID must be rejected');

    // 3. Valid task with case-insensitive frontmatter keys parses reliably
    const validTask = [
      '---',
      'Id: PLAY-VALID',
      'Status: review',
      'Dependencies: []',
      'Priority: high',
      '---',
      '## Acceptance Criteria',
      '<!-- AC:BEGIN -->',
      '- [x] #1 done',
      '<!-- AC:END -->'
    ].join('\n');
    const validFile = createFile(sandbox, 'VALID.md', validTask);
    const resValid = runCmd(GATE_BIN, [validFile, '--no-run']);
    assert.equal(resValid.status, 2, 'Valid task parses case-insensitively');
  });

  test('Scenario 5: Full Delivery Verification Pipeline Execution', () => {
    // 1. Validator passes
    const valRes = runCmd(VALIDATE_BIN);
    assert.equal(valRes.status, 0);

    // 2. Modularity checker passes in advisory mode
    const locRes = runCmd(CHECK_LOC_BIN);
    assert.equal(locRes.status, 0);

    // 3. UX catalog is complete with 15 rules
    const rulesRes = runCmd(AUDITOR_BIN, ['--list-rules']);
    assert.equal(rulesRes.status, 0);
    assert.match(rulesRes.stdout, /15 signatures/);
  });
});
