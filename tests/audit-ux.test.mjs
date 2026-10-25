import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDITOR = path.join(ROOT, 'scripts', 'audit-ux-code.cjs');
const requireCjs = createRequire(import.meta.url);
const VIOLATION_SNIPPET = 'export const A = () => <span className="text-[13px]">x</span>;\n';
const RULES = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'ux-rules.json'), 'utf8'));
const ALL_IDS = RULES.rules.map((rule) => rule.id);

function audit(fixture, args = []) {
  try {
    const stdout = execFileSync(process.execPath, [AUDITOR, '--format', 'json', ...args], {
      env: { ...process.env, AUDIT_UX_ROOT: path.join(ROOT, 'tests', 'fixtures', fixture) },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, report: JSON.parse(stdout) };
  } catch (err) {
    if (err.status === undefined) throw err;
    return { code: err.status, report: JSON.parse(err.stdout) };
  }
}

function rulesIn(fixture, args = []) {
  return audit(fixture, args).report.findings.map((finding) => finding.rule).sort();
}

/** Builds an absolute fixture arg for a project living outside tests/fixtures. */
function fixtureAt(absPath) {
  return path.relative(path.join(ROOT, 'tests', 'fixtures'), absPath);
}

describe('rule catalog integrity', () => {
  test('ids are unique and sequential from UX-001', () => {
    assert.equal(new Set(ALL_IDS).size, ALL_IDS.length, 'duplicate rule ids');
    ALL_IDS.forEach((id, index) => {
      assert.equal(id, `UX-${String(index + 1).padStart(3, '0')}`);
    });
  });

  test('every rule is complete', () => {
    for (const rule of RULES.rules) {
      for (const field of ['id', 'title', 'severity', 'signature', 'impact', 'fix', 'message']) {
        assert.ok(rule[field], `${rule.id} is missing "${field}"`);
      }
      assert.ok(
        ['ERROR', 'WARNING', 'INFO'].includes(rule.severity),
        `${rule.id} has an invalid severity`,
      );
      assert.ok(rule.check && Array.isArray(rule.check.line) && rule.check.line.length,
        `${rule.id} has no detection signature`);
    }
  });

  test('UX-001..UX-008 keep their historical ids documented in the skill', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, '.agents', 'skills', 'code-level-ux-auditor', 'SKILL.md'),
      'utf8',
    );
    for (const rule of RULES.rules) {
      assert.ok(skill.includes(`[${rule.id}]`), `${rule.id} is not documented in the skill`);
      assert.ok(skill.includes(rule.title), `${rule.id} title not found verbatim in the skill`);
    }
  });
});

describe('detection', () => {
  test('every catalogued rule fires on the violations fixture', () => {
    const found = rulesIn('react-app');
    const missing = ALL_IDS.filter((id) => !found.includes(id));
    assert.deepEqual(missing, [], `rules that did not fire: ${missing.join(', ')}`);
  });

  test('a compliant component produces zero findings', () => {
    const report = audit('react-app').report;
    const clean = report.findings.filter((f) => f.file.endsWith('Clean.tsx'));
    assert.deepEqual(clean, [], `unexpected findings on Clean.tsx: ${JSON.stringify(clean, null, 2)}`);
  });

  test('a multiline input with an escape hatch is not split by arrow functions', () => {
    const report = audit('react-app').report;
    const multiline = report.findings.filter((f) => f.file.endsWith('Multiline.tsx'));
    assert.deepEqual(
      multiline.filter((f) => f.rule === 'UX-001'),
      [],
      `UX-001 false positives on multiline inputs: ${JSON.stringify(multiline, null, 2)}`,
    );
  });

  test('dependency-gated rules stay silent without their library', () => {
    const found = rulesIn('minimal');
    assert.ok(!found.includes('UX-004'), 'UX-004 (date-fns) fired without date-fns');
    assert.ok(!found.includes('UX-003'), 'UX-003 (framer-motion) fired without framer-motion');
    assert.ok(found.includes('UX-001'), 'stack-agnostic rules must still fire');
  });
});

describe('unit scoping (DEV-187)', () => {
  test('UX-010 ignores a control that renders a visible label', () => {
    const report = audit('react-app').report;
    const findings = report.findings.filter((f) => f.rule === 'UX-010');

    // Dev187Repro:5 carries aria-label, :6 plain text and :7 a <span> label.
    for (const line of [5, 6, 7]) {
      assert.ok(
        !findings.some((f) => f.file.endsWith('Dev187Repro.tsx') && f.line === line),
        `UX-010 must not report Dev187Repro.tsx:${line} — that button is accessible`,
      );
    }

    // IconOnly.tsx holds every labelled shape a control takes. Counting them
    // explicitly is the point: an earlier version of this fixture only had the
    // single-line span case, which made the suite blind to the defect the
    // consumer reported — `unlessVisibleText` counted only direct text nodes, so
    // a label wrapped in markup looked like no label at all.
    const labelled = report.findings.filter((f) => f.file.endsWith('IconOnly.tsx') && f.rule === 'UX-010');
    const reportedLines = labelled.map((f) => f.line).sort((a, b) => a - b);

    assert.deepEqual(
      reportedLines,
      [49, 58],
      'only the two controls with no accessible name may be reported',
    );
  });

  test('UX-010 detects a control with an icon and no accessible name', () => {
    const findings = audit('react-app').report.findings.filter((f) => f.rule === 'UX-010');

    // IconOnly.tsx:49 is a <button> holding only <Icon /> across several lines;
    // :53 is a div[role=button] holding only <Icon />. The second one is the
    // shape a custom control takes, and a rule that only matched <button> left
    // it completely uncovered.
    assert.ok(
      findings.some((f) => f.file.endsWith('IconOnly.tsx') && f.line === 49),
      'a multiline icon-only <button> must be reported',
    );
    assert.ok(
      findings.some((f) => f.file.endsWith('IconOnly.tsx') && f.line === 58),
      'a div[role=button] holding only an icon must be reported',
    );
  });

  test('needsContent is scoped to the element, not to the whole file', () => {
    // UX-006 pairs a padded scroll container with a fixed bottom bar. Those are
    // two different elements, so the rule asks for the bar nearby rather than in
    // its own content.
    const findings = audit('react-app').report.findings.filter((f) => f.rule === 'UX-006');
    assert.deepEqual(findings.map((f) => f.line), [20], 'UX-006 must fire once, on the padded container');

    // Negative control: the padding alone is not occlusion. Under the previous
    // file-scoped check a file mentioning `bottom-0` anywhere matched everything.
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-ux006-'));
    fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(temp, 'src', 'List.tsx'),
      'export const List = () => <div className="pb-16" />;\n',
    );
    assert.ok(
      !audit(fixtureAt(temp)).report.findings.some((f) => f.rule === 'UX-006'),
      'UX-006 must not fire without a fixed bottom bar nearby',
    );
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('a handler containing `=>` is not mistaken for a visible label', () => {
    // `<button onClick={() => go()}>` has a `>` that is not a tag terminator.
    // A regex strip of `/<[^>]*>/g` stops there and leaves `go()}` behind, which
    // makes an icon-only button look like it renders text and silences UX-010.
    const findings = audit('react-app').report.findings.filter((f) => f.rule === 'UX-010');
    assert.ok(
      findings.some((f) => f.file.endsWith('Edge.tsx') && f.line === 27),
      'UX-010 must fire on an icon-only button whose handler contains an arrow',
    );
  });

  test('UX-001 survives a `>` inside an attribute expression', () => {
    // The multiline escape-hatch regression from DEV-184, now with a comparison
    // inside the handler: `buildUnits` must not close the element at that `>`.
    const findings = audit('react-app').report.findings.filter((f) => f.rule === 'UX-001');
    assert.ok(
      findings.some((f) => f.file.endsWith('Edge.tsx') && f.line === 19),
      'UX-001 must fire on a multiline input whose handler contains a comparison',
    );
  });

  test('fragments, unbalanced markup and self-closing roots parse without crashing', () => {
    const { code, report } = audit('react-app', ['--rule', 'UX-010']);
    assert.equal(code, 0, 'UX-010 is a WARNING, so it must not fail the gate on its own');
    const findings = report.findings.filter((f) => f.rule === 'UX-010');
    assert.ok(
      findings.some((f) => f.file.endsWith('Edge.tsx') && f.line === 34),
      'an unclosed <button> holding an icon must not hide the finding',
    );
  });

  test('a rule never fires on a wrapper that only contains the offending child', () => {
    // UX-013 reports the element that renders the value. Reporting the outer
    // wrapper instead would point developers at the wrong element.
    const findings = audit('react-app').report.findings.filter((f) => f.rule === 'UX-013');
    for (const finding of findings) {
      if (!finding.file.endsWith('Violations.tsx')) continue;
      assert.equal(finding.line, 27, 'UX-013 must point at the <b>, not at the wrapping div');
    }
  });
});

describe('localized labels', () => {
  test('a control labelled with a translation expression is not reported', () => {
    // `{t('header.newItem')}` IS a label. `stripExpressions` used to erase every
    // `{...}` in the child list, so an app that ships translations failed UX-010
    // by construction: the detector reported accessible buttons as icon-only.
    // Location is what distinguishes this from `onClick={() => go()}`, not the
    // presence of an expression.
    const { code, report } = audit('i18n-app', ['--strict']);
    assert.deepEqual(
      report.findings,
      [],
      `UX-010 must not fire on a localized label: ${JSON.stringify(report.findings, null, 2)}`,
    );
    assert.equal(code, 0, '--strict must pass a project whose labels are all expressions');
  });

  test('the expression guard does not silence a genuinely unnamed control', () => {
    // The other half of the sensitivity guard. Not every expression is a label:
    // a logical expression is code, and a subtree built inside one renders only
    // when its condition holds, so it cannot stand in for an accessible name.
    const findings = audit('i18n-unlabelled').report.findings.filter((f) => f.rule === 'UX-010');
    assert.deepEqual(
      findings.map((f) => f.line).sort((a, b) => a - b),
      [16, 23, 31],
      'only the controls with no accessible name may be reported',
    );
  });

  test('a mapped expression is not read as a label', () => {
    // `{items.map(i => <li />)}` is a call, so a naive "call means text" rule
    // would call this button labelled and silence it. The arrow is the tell.
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-i18n-'));
    fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(temp, 'src', 'List.tsx'),
      'export const List = ({ items, go }) => (\n'
      + '  <button onClick={() => go()}>\n'
      + '    <Icon />\n'
      + "    {items.map((item) => <li key={item}><Icon /></li>)}\n"
      + '  </button>\n'
      + ');\n',
    );
    const findings = audit(fixtureAt(temp), ['--rule', 'UX-010']).report.findings;
    assert.ok(
      findings.some((f) => f.line === 2),
      `a mapped child expression must not count as a label: ${JSON.stringify(findings, null, 2)}`,
    );
    fs.rmSync(temp, { recursive: true, force: true });
  });
});

describe('suppression', () => {
  test('inline suppression silences the target line only', () => {
    const report = audit('react-app').report;
    const inSuppressed = report.findings.filter((f) => f.file.endsWith('Suppressed.tsx'));
    assert.deepEqual(inSuppressed, [], 'a suppressed line must produce nothing');

    // The same three ids still fire in Violations.tsx, so suppression is proven
    // per line rather than by the rules being globally disabled.
    const inViolations = report.findings
      .filter((f) => f.file.endsWith('Violations.tsx'))
      .map((f) => f.rule)
      .sort();
    for (const id of ['UX-001', 'UX-005', 'UX-013']) {
      assert.ok(inViolations.includes(id), `${id} must still fire outside Suppressed.tsx`);
    }
  });

  test('--rule narrows the run to a single signature', () => {
    const found = rulesIn('react-app', ['--rule', 'UX-011']);
    assert.deepEqual(found, ['UX-011']);
  });

  test('config `exclude` drops matching paths from the report', () => {
    const baseline = audit('react-app').report.findings;
    const fromViolations = baseline.filter((f) => f.file.includes('Violations.tsx')).length;
    assert.ok(fromViolations > 0, 'fixture must produce findings to exclude');

    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-exclude-'));
    fs.cpSync(path.join(ROOT, 'tests', 'fixtures', 'react-app'), temp, { recursive: true });
    fs.writeFileSync(
      path.join(temp, '.uxaudit.json'),
      JSON.stringify({ src: 'src', exclude: ['**/Violations.tsx'] }),
    );

    const report = audit(fixtureAt(temp)).report;
    assert.equal(
      report.findings.filter((f) => f.file.includes('Violations.tsx')).length,
      0,
      'excluded file must not appear in the report',
    );
    assert.equal(
      report.findings.length,
      baseline.length - fromViolations,
      'excluding one file must not silence the rest of the project',
    );
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('config `exclude` accepts directory globs', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-exclude-dir-'));
    fs.cpSync(path.join(ROOT, 'tests', 'fixtures', 'react-app'), temp, { recursive: true });
    fs.writeFileSync(
      path.join(temp, '.uxaudit.json'),
      JSON.stringify({ src: 'src', exclude: ['src/components/**'] }),
    );

    assert.equal(audit(fixtureAt(temp)).report.findings.length, 0);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('an unknown rule id is a fatal usage error', () => {
    const result = audit('react-app', ['--rule', 'UX-999']);
    assert.equal(result.code, 2);
  });
});

describe('baseline', () => {
  function probeProject() {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-baseline-'));
    fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'package.json'), '{"name":"probe"}');
    return temp;
  }

  function run(root, args = []) {
    try {
      const stdout = execFileSync(process.execPath, [AUDITOR, '--format', 'json', ...args], {
        env: { ...process.env, AUDIT_UX_ROOT: root },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, report: JSON.parse(stdout) };
    } catch (err) {
      return { code: err.status, report: JSON.parse(err.stdout) };
    }
  }

  const VIOLATION = 'export const A = () => <span className="text-[13px]">x</span>;\n';
  const BLOCKER = 'export const B = () => <input type="number" />;\n';

  test('without a baseline every observation is reported', () => {
    const temp = probeProject();
    fs.writeFileSync(path.join(temp, 'src', 'A.tsx'), VIOLATION);
    const { report } = run(temp);
    assert.equal(report.findings.length, 1);
    assert.equal(report.baseline, undefined, 'no baseline file means nothing is absorbed');
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('--update-baseline absorbs reviewed observations on the next run', () => {
    const temp = probeProject();
    fs.writeFileSync(path.join(temp, 'src', 'A.tsx'), VIOLATION);

    const written = run(temp, ['--update-baseline']);
    assert.equal(written.report.findings.length, 0, 'writing a baseline reports nothing');
    assert.ok(fs.existsSync(path.join(temp, 'audit-ux-baseline.json')));

    const after = run(temp);
    assert.equal(after.report.findings.length, 0, 'a reviewed observation is absorbed');
    assert.equal(after.report.baseline.absorbed, 1);
    assert.equal(after.code, 0, 'an absorbed INFO must not fail the gate');
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('a baseline is portable across path separator conventions', () => {
    // The fingerprint embeds `finding.file`, so a snapshot written on Windows
    // (`src\App.tsx`) never matched the same snapshot read on macOS
    // (`src/App.tsx`). Nothing errored: the gate simply stopped absorbing
    // anything and reported every reviewed observation as new. Keys are written
    // POSIX-normalized, which is what makes one committed file serve both.
    const temp = probeProject();
    fs.writeFileSync(path.join(temp, 'src', 'A.tsx'), VIOLATION);
    run(temp, ['--update-baseline']);

    const file = path.join(temp, 'audit-ux-baseline.json');
    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const key of Object.keys(written.entries)) {
      assert.ok(
        !key.includes('\\'),
        `baseline keys must not embed a platform separator: "${key}"`,
      );
    }

    // Re-key with forward slashes, exactly as a POSIX machine would have
    // committed it, and prove the run still absorbs.
    const posix = { ...written, entries: {} };
    for (const [key, count] of Object.entries(written.entries)) {
      posix.entries[key.replace(/\\/g, '/')] = count;
    }
    fs.writeFileSync(file, JSON.stringify(posix, null, 2));

    const after = run(temp);
    assert.equal(after.report.findings.length, 0, 'a POSIX-written baseline must absorb on any platform');
    assert.equal(after.report.baseline.absorbed, 1);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('a baseline never absorbs ERROR', () => {
    const temp = probeProject();
    fs.writeFileSync(path.join(temp, 'src', 'B.tsx'), BLOCKER);

    run(temp, ['--update-baseline']);
    const after = run(temp);
    assert.equal(after.report.findings.length, 1, 'ERROR must survive the baseline');
    assert.equal(after.code, 1, 'ERROR must keep failing the build');
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('a new occurrence is reported even when the signature was accepted', () => {
    const temp = probeProject();
    fs.writeFileSync(path.join(temp, 'src', 'A.tsx'), VIOLATION);
    run(temp, ['--update-baseline']);

    // A different file carrying the same rule is a new occurrence, not the
    // accepted one.
    fs.writeFileSync(path.join(temp, 'src', 'B.tsx'), VIOLATION);
    const after = run(temp);
    assert.equal(after.report.findings.length, 1);
    assert.ok(after.report.findings[0].file.endsWith('B.tsx'));
    fs.rmSync(temp, { recursive: true, force: true });
  });
});

describe('programmatic API (PLAY-005)', () => {
  function createProject() {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-api-'));
    fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'package.json'), '{"name":"probe"}');
    return temp;
  }

  const LOCAL_RULE = {
    version: 1,
    rules: [{
      id: 'ENV-002',
      title: 'Truncated text in a dialog',
      severity: 'WARNING',
      message: '`truncate` in a dialog.',
      check: { line: ['truncate'], onlyFile: ['Modal', 'Dialog'] },
    }],
  };

  function writeLocalCatalog(root, catalog) {
    fs.writeFileSync(path.join(root, 'rules.json'), JSON.stringify(catalog, null, 2));
  }

  test('importing the module does not run the audit', () => {
    // Forcing the module through a child process and asserting empty stdout is
    // what proves the CLI is guarded. A require() in this file would be a no-op
    // either way.
    const script = [
      `const api = require(${JSON.stringify(AUDITOR)});`,
      'if (typeof api.auditProject !== "function") process.exit(3);',
    ].join('');
    const stdout = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    assert.equal(stdout, '', 'requiring the auditor must not print anything');
  });

  test('auditProject returns a report without printing or exiting', () => {
    const temp = createProject();
    fs.writeFileSync(path.join(temp, 'src', 'A.tsx'), VIOLATION_SNIPPET);
    const { auditProject } = requireCjs(AUDITOR);
    const report = auditProject({ root: temp, useBaseline: false });

    assert.equal(report.srcDir, 'src');
    assert.equal(report.findings.length, 1);
    assert.equal(report.summary.total, 1);
    assert.ok(Array.isArray(report.unreadable));
  });

  test('onlyFile restricts a rule to matching paths', () => {
    const temp = createProject();
    fs.writeFileSync(path.join(temp, 'src', 'ConfirmDialog.tsx'), 'export const A = () => <p className="truncate">x</p>;\n');
    fs.writeFileSync(path.join(temp, 'src', 'Overlays.tsx'), 'export const B = () => <p className="truncate">y</p>;\n');
    writeLocalCatalog(temp, LOCAL_RULE);
    fs.writeFileSync(
      path.join(temp, '.uxaudit.json'),
      JSON.stringify({ src: 'src', rules: 'rules.json' }),
    );

    const { auditProject } = requireCjs(AUDITOR);
    const report = auditProject({ root: temp, useBaseline: false });

    assert.equal(report.findings.length, 1, 'only the dialog file must be reported');
    assert.ok(report.findings[0].file.endsWith('ConfirmDialog.tsx'));
    assert.equal(report.findings[0].rule, 'ENV-002');
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('withinComponent matches enclosing JSX parent regardless of file name (PLAY-007)', () => {
    const temp = createProject();
    // Overlays.tsx does not contain "Dialog" or "Modal" in its file name.
    fs.writeFileSync(
      path.join(temp, 'src', 'Overlays.tsx'),
      'export const A = () => <Dialog><DialogContent><p className="truncate">inside dialog</p></DialogContent></Dialog>;\n' +
      'export const B = () => <Card><p className="truncate">outside dialog</p></Card>;\n'
    );
    writeLocalCatalog(temp, {
      version: 1,
      rules: [{
        id: 'ENV-003',
        title: 'Truncated text in a dialog',
        severity: 'WARNING',
        message: '`truncate` in a dialog.',
        check: { line: ['truncate'], withinComponent: ['Dialog'] },
      }],
    });
    fs.writeFileSync(
      path.join(temp, '.uxaudit.json'),
      JSON.stringify({ src: 'src', rules: 'rules.json' }),
    );

    const { auditProject } = requireCjs(AUDITOR);
    const report = auditProject({ root: temp, useBaseline: false });

    assert.equal(report.findings.length, 1, 'only the element inside Dialog must be reported');
    assert.ok(report.findings[0].file.endsWith('Overlays.tsx'));
    assert.equal(report.findings[0].line, 1);
    assert.equal(report.findings[0].rule, 'ENV-003');
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('withinComponent supports dotted component notation and unlessComponent suppression (PLAY-007)', () => {
    const temp = createProject();
    fs.writeFileSync(
      path.join(temp, 'src', 'Views.tsx'),
      'export const A = () => <Modal.Root><Modal.Body><p className="truncate">warn</p></Modal.Body></Modal.Root>;\n' +
      'export const B = () => <Modal.Root><Tooltip><p className="truncate">suppressed</p></Tooltip></Modal.Root>;\n'
    );
    writeLocalCatalog(temp, {
      version: 1,
      rules: [{
        id: 'ENV-004',
        title: 'Truncated text in modal except tooltip',
        severity: 'WARNING',
        message: '`truncate` in modal.',
        check: { line: ['truncate'], withinComponent: ['Modal'], unlessComponent: ['Tooltip'] },
      }],
    });
    fs.writeFileSync(
      path.join(temp, '.uxaudit.json'),
      JSON.stringify({ src: 'src', rules: 'rules.json' }),
    );

    const { auditProject } = requireCjs(AUDITOR);
    const report = auditProject({ root: temp, useBaseline: false });

    assert.equal(report.findings.length, 1);
    assert.ok(report.findings[0].file.endsWith('Views.tsx'));
    assert.equal(report.findings[0].line, 1);
    assert.equal(report.findings[0].rule, 'ENV-004');
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('a local catalog runs alongside the canonical one', () => {
    const temp = createProject();
    fs.writeFileSync(path.join(temp, 'src', 'ConfirmDialog.tsx'), 'export const A = () => <p className="truncate">x</p>;\n');
    writeLocalCatalog(temp, LOCAL_RULE);
    fs.writeFileSync(
      path.join(temp, '.uxaudit.json'),
      JSON.stringify({ src: 'src', rules: 'rules.json' }),
    );

    const result = audit(fixtureAt(temp), ['--format', 'json', '--rule', 'ENV-002']);
    assert.equal(result.report.findings.length, 1, 'the local rule is reachable by id');

    // The canonical catalog is untouched and still complete.
    assert.equal(ALL_IDS.length, 15);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('a local rule may not squat a canonical UX-NNN id', () => {
    const temp = createProject();
    // 1. Colliding with an existing canonical rule (UX-009) names the canonical signature
    writeLocalCatalog(temp, { version: 1, rules: [{ ...LOCAL_RULE.rules[0], id: 'UX-009' }] });
    fs.writeFileSync(
      path.join(temp, '.uxaudit.json'),
      JSON.stringify({ src: 'src', rules: 'rules.json' }),
    );

    let stderr = '';
    try {
      execFileSync(process.execPath, [AUDITOR, '--format', 'json'], {
        env: { ...process.env, AUDIT_UX_ROOT: temp },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      stderr = err.stdout || '';
      assert.equal(err.status, 2, 'a colliding canonical id is a fatal usage error');
    }
    assert.match(JSON.parse(stderr).error, /collides with canonical rule "Sub-44px touch target"/);

    // 2. Using an unassigned UX-NNN id triggers the reserved canonical pattern error
    writeLocalCatalog(temp, { version: 1, rules: [{ ...LOCAL_RULE.rules[0], id: 'UX-099' }] });
    stderr = '';
    try {
      execFileSync(process.execPath, [AUDITOR, '--format', 'json'], {
        env: { ...process.env, AUDIT_UX_ROOT: temp },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      stderr = err.stdout || '';
      assert.equal(err.status, 2, 'a reserved id is a fatal usage error');
    }
    assert.match(stderr, /reserved canonical pattern/);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('a missing local catalog is a fatal usage error, not a silent skip', () => {
    const temp = createProject();
    fs.writeFileSync(
      path.join(temp, '.uxaudit.json'),
      JSON.stringify({ src: 'src', rules: 'nope.json' }),
    );

    let out = '';
    let status = 0;
    try {
      out = execFileSync(process.execPath, [AUDITOR, '--format', 'json'], {
        env: { ...process.env, AUDIT_UX_ROOT: temp },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      status = err.status;
      out = err.stdout || '';
    }
    assert.equal(status, 2);
    assert.match(out, /does not exist/);
    fs.rmSync(temp, { recursive: true, force: true });
  });
});

describe('severity and exit codes', () => {
  test('ERROR findings fail the audit without --strict', () => {
    const { code } = audit('react-app');
    assert.equal(code, 1);
  });

  test('INFO-only projects pass without --strict and with it', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-info-'));
    fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(temp, 'src', 'Info.tsx'),
      'export const A = () => <span className="text-[13px]">x</span>;\n',
    );
    const run = () => {
      try {
        execFileSync(process.execPath, [AUDITOR, '--quiet'], {
          env: { ...process.env, AUDIT_UX_ROOT: temp },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        return 0;
      } catch (err) {
        return err.status;
      }
    };
    assert.equal(run(), 0, 'INFO findings must not fail the audit');
    fs.rmSync(temp, { recursive: true, force: true });
  });
});

describe('robustness', () => {
  test('a project without a JS source directory is not an error', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-empty-'));
    fs.writeFileSync(path.join(temp, 'package.json'), '{"name":"go-service"}');
    let stdout;
    let code = 0;
    try {
      stdout = execFileSync(process.execPath, [AUDITOR, '--format', 'json'], {
        env: { ...process.env, AUDIT_UX_ROOT: temp },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      code = err.status;
      stdout = err.stdout;
    }
    assert.equal(code, 0, 'missing src/ must exit 0, not crash');
    assert.equal(JSON.parse(stdout).findings.length, 0);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('the repository itself has no source directory to audit', () => {
    assert.equal(
      fs.existsSync(path.join(ROOT, 'src')),
      false,
      'the playbook repo is not an application and must not grow a src/',
    );
    const stdout = execFileSync(process.execPath, [AUDITOR, '--format', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.equal(JSON.parse(stdout).findings.length, 0);
  });
});

describe('canonical vs local findings & partial baseline (PLAY-009)', () => {
  const LOCAL_WARN_CATALOG = {
    version: 1,
    rules: [
      {
        id: 'LOC-001',
        title: 'Local custom warning',
        severity: 'WARNING',
        message: 'Local rule triggered.',
        check: { line: ['data-local-warn'] },
      },
    ],
  };

  function setupMixedProject({ canonicalWarn = true, localWarn = true } = {}) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-play009-'));
    fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'rules.json'), JSON.stringify(LOCAL_WARN_CATALOG, null, 2));
    fs.writeFileSync(
      path.join(temp, '.uxaudit.json'),
      JSON.stringify({ src: 'src', rules: 'rules.json' }),
    );

    const lines = [];
    if (canonicalWarn) {
      // UX-009 WARNING: Sub-44px touch target (<button with h-6)
      lines.push('export const Bar = () => <button className="h-6 w-6" onClick={fn}>bar</button>;');
    }
    if (localWarn) {
      lines.push('export const Foo = () => <div data-local-warn="1">foo</div>;');
    }
    if (!lines.length) {
      lines.push('export const Ok = () => <div>ok</div>;');
    }
    fs.writeFileSync(path.join(temp, 'src', 'App.tsx'), lines.join('\n') + '\n');
    return temp;
  }

  test('JSON and human output declare origin (canonical vs local) and summary breakdown (AC #1 & #5)', () => {
    const temp = setupMixedProject({ canonicalWarn: true, localWarn: true });

    const jsonOut = execFileSync(process.execPath, [AUDITOR, '--format', 'json'], {
      env: { ...process.env, AUDIT_UX_ROOT: temp },
      encoding: 'utf8',
    });
    const report = JSON.parse(jsonOut);
    assert.equal(report.summary.canonical, 1);
    assert.equal(report.summary.local, 1);

    const canonicalFinding = report.findings.find((f) => f.rule === 'UX-009');
    const localFinding = report.findings.find((f) => f.rule === 'LOC-001');
    assert.equal(canonicalFinding.origin, 'canonical');
    assert.equal(localFinding.origin, 'local');

    const humanOut = execFileSync(process.execPath, [AUDITOR], {
      env: { ...process.env, AUDIT_UX_ROOT: temp, NO_COLOR: '1' },
      encoding: 'utf8',
    });
    assert.match(humanOut, /\[UX-009\] \[canonical\]/);
    assert.match(humanOut, /\[LOC-001\] \[local\]/);
    assert.match(humanOut, /\(1 canonical, 1 local\)/);

    fs.rmSync(temp, { recursive: true, force: true });
  });

  test('--strict --canonical-only ignores local warnings for exit code but fails on canonical warnings (AC #2)', () => {
    // Only local warning present -> --strict fails, but --strict --canonical-only passes!
    const localOnly = setupMixedProject({ canonicalWarn: false, localWarn: true });

    let strictCode = 0;
    try {
      execFileSync(process.execPath, [AUDITOR, '--strict', '--format', 'json'], {
        env: { ...process.env, AUDIT_UX_ROOT: localOnly },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      strictCode = err.status;
    }
    assert.equal(strictCode, 1, '--strict alone must fail on local WARNING');

    let canonicalOnlyCode = 0;
    try {
      execFileSync(process.execPath, [AUDITOR, '--strict', '--canonical-only', '--format', 'json'], {
        env: { ...process.env, AUDIT_UX_ROOT: localOnly },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      canonicalOnlyCode = err.status;
    }
    assert.equal(canonicalOnlyCode, 0, '--strict --canonical-only must pass when only local WARNING exists');

    // Canonical warning present -> --strict --canonical-only fails!
    const both = setupMixedProject({ canonicalWarn: true, localWarn: true });
    let bothCode = 0;
    try {
      execFileSync(process.execPath, [AUDITOR, '--strict', '--canonical-only', '--format', 'json'], {
        env: { ...process.env, AUDIT_UX_ROOT: both },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      bothCode = err.status;
    }
    assert.equal(bothCode, 1, '--strict --canonical-only must fail when canonical WARNING exists');

    fs.rmSync(localOnly, { recursive: true, force: true });
    fs.rmSync(both, { recursive: true, force: true });
  });

  test('--update-baseline --only local regenerates local signatures without losing canonical baseline entries (AC #3 & #4)', () => {
    const temp = setupMixedProject({ canonicalWarn: true, localWarn: true });

    // 1. Write full baseline (absorbs both UX-009 and LOC-001)
    execFileSync(process.execPath, [AUDITOR, '--update-baseline', '--quiet'], {
      env: { ...process.env, AUDIT_UX_ROOT: temp },
    });

    const initialBaseline = JSON.parse(fs.readFileSync(path.join(temp, 'audit-ux-baseline.json'), 'utf8'));
    const initialKeys = Object.keys(initialBaseline.entries);
    assert.equal(initialKeys.some((k) => k.startsWith('UX-009|')), true);
    assert.equal(initialKeys.some((k) => k.startsWith('LOC-001|')), true);

    // 2. Modify App.tsx: add a second local violation, and temporarily remove canonical violation from file
    // to prove that regenerating `--only local` preserves the canonical entry in the baseline!
    fs.writeFileSync(
      path.join(temp, 'src', 'App.tsx'),
      [
        'export const Foo1 = () => <div data-local-warn="1">foo1</div>;',
        'export const Foo2 = () => <div data-local-warn="2">foo2</div>;',
      ].join('\n') + '\n',
    );

    execFileSync(process.execPath, [AUDITOR, '--update-baseline', '--only', 'local', '--quiet'], {
      env: { ...process.env, AUDIT_UX_ROOT: temp },
    });

    const updatedBaseline = JSON.parse(fs.readFileSync(path.join(temp, 'audit-ux-baseline.json'), 'utf8'));
    const updatedKeys = Object.keys(updatedBaseline.entries);

    // Canonical UX-009 entry was preserved even though it wasn't in the partial run!
    assert.equal(
      updatedKeys.some((k) => k.startsWith('UX-009|')),
      true,
      'canonical baseline review must be preserved during --only local update',
    );
    // Both new local occurrences are recorded
    const localEntries = updatedKeys.filter((k) => k.startsWith('LOC-001|'));
    assert.equal(localEntries.length, 2, 'local baseline entries must be updated');

    fs.rmSync(temp, { recursive: true, force: true });
  });
});

describe('UX-014: anti-em-dash / anti-AI cliché detector', () => {
  function auditSnippet(code) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-014-'));
    fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'package.json'), '{"name":"test-ux014"}');
    fs.writeFileSync(path.join(temp, 'src', 'Component.tsx'), code);
    try {
      const { auditProject } = requireCjs(AUDITOR);
      const report = auditProject({ root: temp, useBaseline: false });
      return report.findings.filter((f) => f.rule === 'UX-014');
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }

  test('detects em-dash in JSX text children', () => {
    const findings = auditSnippet('export const A = () => <h1>Release — Notes</h1>;\n');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'UX-014');
    assert.equal(findings[0].severity, 'WARNING');
  });

  test('detects en-dash in JSX text children', () => {
    const findings = auditSnippet('export const A = () => <span>Option – Description</span>;\n');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'UX-014');
    assert.equal(findings[0].severity, 'WARNING');
  });

  test('detects em-dash and en-dash in attributes', () => {
    const emFindings = auditSnippet('export const A = () => <button title="Save — Exit">Save</button>;\n');
    assert.equal(emFindings.length, 1);
    assert.equal(emFindings[0].rule, 'UX-014');

    const enFindings = auditSnippet('export const B = () => <input placeholder="Filter – Search" />;\n');
    assert.equal(enFindings.length, 1);
    assert.equal(enFindings[0].rule, 'UX-014');
  });

  test('clean text passes with standard hyphen', () => {
    const findings = auditSnippet('export const A = () => <span>Release - Notes</span>;\nexport const B = () => <button title="Save - Exit">Save</button>;\n');
    assert.equal(findings.length, 0);
  });

  test('inline suppression works for UX-014', () => {
    const findings = auditSnippet('export const A = () => <span>Release — Notes</span>; // ux-audit-ignore UX-014\n');
    assert.equal(findings.length, 0);
  });
});

describe('UX-015: viewport touch zoom lock', () => {
  function auditSnippet(code) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ux-015-'));
    fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'package.json'), '{"name":"test-ux015"}');
    fs.writeFileSync(path.join(temp, 'src', 'Component.tsx'), code);
    try {
      const { auditProject } = requireCjs(AUDITOR);
      const report = auditProject({ root: temp, useBaseline: false });
      return report.findings.filter((f) => f.rule === 'UX-015');
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }

  test('detects maximum-scale=1 in viewport meta', () => {
    const findings = auditSnippet('export const Viewport = () => <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />;\n');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'UX-015');
    assert.equal(findings[0].severity, 'WARNING');
  });

  test('detects user-scalable=no in viewport meta', () => {
    const findings = auditSnippet('export const Viewport = () => <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />;\n');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'UX-015');
    assert.equal(findings[0].severity, 'WARNING');
  });

  test('detects user-scalable=0 in viewport meta', () => {
    const findings = auditSnippet('export const Viewport = () => <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=0" />;\n');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'UX-015');
    assert.equal(findings[0].severity, 'WARNING');
  });

  test('clean viewport passes (allows pinch-to-zoom)', () => {
    const findings = auditSnippet('export const Viewport = () => <meta name="viewport" content="width=device-width, initial-scale=1" />;\nexport const Zoomable = () => <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />;\n');
    assert.equal(findings.length, 0);
  });

  test('inline suppression works for UX-015', () => {
    const findings = auditSnippet('export const Viewport = () => <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />; // ux-audit-ignore UX-015\n');
    assert.equal(findings.length, 0);
  });
});