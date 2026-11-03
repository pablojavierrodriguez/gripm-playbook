#!/usr/bin/env node

'use strict';

/**
 * scripts/audit-ux-code.cjs
 *
 * Generic static UX / ergonomics auditor.
 *
 * This file is only an ENGINE. All detection knowledge lives in
 * scripts/ux-rules.json, which is the single source of truth shared with
 * .agents/skills/code-level-ux-auditor/SKILL.md.
 *
 * Design constraints:
 *  - Stack agnostic. Rules that depend on a library (date-fns, framer-motion)
 *    declare `requires.deps` and are skipped when the dependency is absent.
 *  - Project agnostic. No file names, no project names, no hardcoded paths.
 *  - Never crashes on a missing source directory or a non-JS project.
 *
 * Usage:
 *   node scripts/audit-ux-code.cjs [options]
 *
 * Options:
 *   --src <dir>        Source directory to scan (default: auto-detect)
 *   --config <file>    Config file (default: .uxaudit.json in project root)
 *   --strict           Exit 1 on WARNING as well as ERROR
 *   --format <fmt>     human (default) | json
 *   --list-rules       Print the rule catalog and exit
 *   --rule <ID>        Only run this rule (repeatable)
 *   --quiet            Only print the summary
 *   --update-baseline  Rewrite the accepted-observations snapshot and exit
 *
 * Programmatic use:
 *
 *   const { auditProject } = require('./audit-ux-code.cjs');
 *   const { findings, summary } = auditProject({ root: process.cwd() });
 *
 * Importing this module does not run an audit; only executing it as a binary
 * does. `auditProject` never prints or exits, so a consumer owns presentation.
 *   --help             Print usage
 *
 * Exit codes:
 *   0  no blocking findings (or nothing to scan)
 *   1  blocking findings present
 *   2  fatal error (bad config, unreadable rules file)
 */

const fs = require('fs');
const path = require('path');

const {
  DEFAULT_RULES_PATH,
  CONFIG_NAME,
  BASELINE_NAME,
  BASELINE_VERSION,
  SEVERITY_ORDER,
  SCAN_EXTENSIONS,
  SKIP_DIRS,
  SKIP_FILE_PATTERN,
  parseArgs,
  printRuleCatalog,
  resolveConfigFile,
  resolveBaselineFile,
  loadConfig,
  detectSourceDir,
  loadDependencies,
  collectFiles,
  toPosixPath,
  compileExcludes,
  isExcluded,
  applyExcludes,
  loadRules,
  loadLocalRules,
  loadCatalog,
  fingerprint,
  loadBaseline,
  writeBaseline,
  diffAgainstBaseline,
} = require('./lib/ux-catalog.cjs');

const {
  TAG_OPEN,
  EXPRESSION_LABEL,
  CONDITIONAL_PREFIX,
  countTagKinds,
  findTagEnd,
  stripExpressions,
  isTextExpression,
  isConditionalChild,
  buildUnits,
  hasVisibleText,
  matchesComponentName,
  isWithinComponent,
  buildWindow,
  lineMatches,
} = require('./lib/ux-jsx-parser.cjs');

// ROOT is the project being audited. AUDIT_UX_ROOT or --root/--cwd points explicitly.
// Defaults to process.cwd() for consumer portability.
function resolveAuditRoot() {
  if (process.env.AUDIT_UX_ROOT) return path.resolve(process.env.AUDIT_UX_ROOT);
  for (let i = 2; i < process.argv.length; i++) {
    if ((process.argv[i] === '--root' || process.argv[i] === '--cwd') && process.argv[i + 1]) {
      return path.resolve(process.argv[i + 1]);
    }
    if (process.argv[i].startsWith('--root=')) return path.resolve(process.argv[i].split('=')[1]);
    if (process.argv[i].startsWith('--cwd=')) return path.resolve(process.argv[i].split('=')[1]);
  }
  const isInNodeModules = __dirname.split(path.sep).includes('node_modules');
  const scriptParent = path.resolve(__dirname, '..');
  const cwd = process.cwd();
  if (isInNodeModules) return cwd;
  if (cwd !== scriptParent && (fs.existsSync(path.join(cwd, 'package.json')) || fs.existsSync(path.join(cwd, 'src')))) {
    return cwd;
  }
  return scriptParent;
}

const ROOT = resolveAuditRoot();
const RULES_PATH = path.join(__dirname, 'ux-rules.json');

const isColorSupported =
  !('NO_COLOR' in process.env) &&
  (process.env.FORCE_COLOR === '1' || (process.stdout?.isTTY && process.env.TERM !== 'dumb'));

const c = {
  bold: (s) => (isColorSupported ? `\x1b[1m${s}\x1b[22m` : s),
  dim: (s) => (isColorSupported ? `\x1b[2m${s}\x1b[22m` : s),
  cyan: (s) => (isColorSupported ? `\x1b[36m${s}\x1b[39m` : s),
  green: (s) => (isColorSupported ? `\x1b[32m${s}\x1b[39m` : s),
  yellow: (s) => (isColorSupported ? `\x1b[33m${s}\x1b[39m` : s),
  red: (s) => (isColorSupported ? `\x1b[31m${s}\x1b[39m` : s),
};

const OUTPUT_FORMAT = process.argv.includes('--format')
  ? process.argv[process.argv.indexOf('--format') + 1]
  : 'human';

function fatal(message) {
  if (OUTPUT_FORMAT === 'json') {
    console.log(JSON.stringify({ error: message, findings: [] }, null, 2));
  } else {
    console.error(`\n  ${c.red('✖')} audit-ux: ${message}\n`);
  }
  process.exit(2);
}
function ruleAppliesToProject(rule, relPath, deps) {
  const check = rule.check || {};

  if ((check.unlessFile || []).some((token) => relPath.includes(token))) return false;

  if ((check.onlyFile || []).length
    && !(check.onlyFile || []).some((token) => relPath.includes(token))) return false;

  const required = rule.requires && rule.requires.deps;
  if (required && required.length && !required.some((dep) => deps.has(dep))) return false;

  return true;
}

function readSuppression(line) {
  const match = line.match(/ux-audit-ignore\s*([A-Z]+-\d+)?/);
  if (!match) return null;
  return match[1] || '*';
}

function auditFile(filePath, rules, deps, disabledRules, root = ROOT) {
  const findings = [];
  const relPath = toPosixPath(path.relative(root, filePath));

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return { findings, error: err.message };
  }

  const lines = content.split('\n');
  const units = buildUnits(lines);

  for (const rule of rules) {
    if (disabledRules.has(rule.id)) continue;
    if (!ruleAppliesToProject(rule, relPath, deps)) continue;

    for (let i = 0; i < units.length; i += 1) {
      const unit = units[i];
      const suppression = unit.parts.map(readSuppression).find(Boolean);
      if (suppression === '*') continue;
      if (suppression === rule.id) continue;

      if (!lineMatches(rule, unit, lines, i, content)) continue;

      findings.push({
        rule: rule.id,
        origin: rule.origin || 'canonical',
        title: rule.title,
        severity: rule.severity,
        file: relPath,
        line: unit.startLine,
        message: rule.message,
        fix: rule.fix || null,
        snippet: unit.parts[0].trim().slice(0, 160),
      });
    }
  }

  return { findings, error: null };
}

function printHuman(report, opts) {
  const { findings, summary, srcDir, rulesVersion } = report;

  if (!opts.quiet) {
    console.log(`\n  ${c.bold('gripm')} ${c.dim('·')} Static UX & Mobile Ergonomics Auditor`);
    console.log(`  ${c.dim(`rules v${rulesVersion}  ·  ${summary.total} finding(s)  ·  ${srcDir}`)}\n`);
  }

  if (findings.length === 0) {
    if (!opts.quiet) {
      console.log(`  ${c.green('✔')} No static UX anti-patterns detected.\n`);
    }
    return;
  }

  const icons = {
    ERROR: c.red('✖'),
    WARNING: c.yellow('▲'),
    INFO: c.dim('ℹ'),
  };

  for (const finding of findings) {
    const originTag = finding.origin === 'local' ? ` ${c.dim('[local]')}` : ` ${c.dim('[canonical]')}`;
    console.log(`  ${icons[finding.severity]} [${c.bold(finding.rule)}]${originTag} ${finding.file}:${finding.line}`);
    console.log(`    ${finding.message}`);
    if (finding.fix) console.log(`    ${c.dim('fix:')} ${finding.fix}`);
    console.log('');
  }

  const originBreakdown =
    typeof summary.canonical === 'number' && typeof summary.local === 'number'
      ? ` (${summary.canonical} canonical, ${summary.local} local)`
      : '';
  console.log(`  ${c.bold('Summary:')} ${summary.ERROR} error(s), ${summary.WARNING} warning(s), ${summary.INFO} suggestion(s)${originBreakdown}.\n`);
}

function printJson(report) {
  console.log(JSON.stringify({
    rulesVersion: report.rulesVersion,
    src: report.srcDir,
    summary: report.summary,
    findings: report.findings,
    baseline: report.baseline,
  }, null, 2));
}
function printUsage() {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').replace(/^ \* ?/gm, ''));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printUsage();
    return;
  }

  const { config } = loadConfig(opts, ROOT);
  const catalog = loadCatalog(config, ROOT, RULES_PATH);

  if (opts.listRules) {
    printRuleCatalog(catalog);
    return;
  }

  const unknown = opts.rules.filter((id) => !catalog.rules.some((rule) => rule.id === id));
  if (unknown.length) fatal(`Unknown rule id requested with --rule: ${unknown.join(', ')}`);

  const disabledRules = new Set(config.disableRules || []);

  const activeRules = opts.rules.length
    ? catalog.rules.filter((rule) => opts.rules.includes(rule.id))
    : catalog.rules;

  const srcDir = detectSourceDir(opts.src, config, ROOT);

  if (!srcDir) {
    if (opts.format === 'json') {
      printJson({ rulesVersion: catalog.version, srcDir: null, summary: { total: 0, ERROR: 0, WARNING: 0, INFO: 0, canonical: 0, local: 0 }, findings: [] });
    } else if (!opts.quiet) {
      console.log(`  ${c.dim('ℹ')} No JavaScript/TypeScript source directory found (looked for src, app, frontend, web, client).`);
      console.log(`    ${c.dim('Nothing to audit. Pass --src <dir> to point the auditor somewhere else.')}\n`);
    }
    return;
  }

  const deps = loadDependencies(ROOT);
  const excludes = compileExcludes(config.exclude);
  const files = [];
  const unreadable = [];
  collectFiles(srcDir, files, unreadable);
  const scannedFiles = applyExcludes(files, excludes, ROOT);

  const findings = [];
  for (const file of scannedFiles) {
    const result = auditFile(file, activeRules, deps, disabledRules, ROOT);
    findings.push(...result.findings);
  }

  const severityRank = { ERROR: 0, WARNING: 1, INFO: 2 };
  findings.sort((a, b) => (
    severityRank[a.severity] - severityRank[b.severity]
    || a.file.localeCompare(b.file)
    || a.line - b.line
    || a.rule.localeCompare(b.rule)
  ));

  const summary = { total: findings.length, ERROR: 0, WARNING: 0, INFO: 0, canonical: 0, local: 0 };
  for (const finding of findings) {
    summary[finding.severity] += 1;
    if (finding.origin === 'local') summary.local += 1;
    else summary.canonical += 1;
  }

  const { keys: unreviewed } = diffAgainstBaseline(findings, ROOT);

  if (opts.updateBaseline) {
    let partialRuleIds = null;
    if (opts.only === 'local') {
      partialRuleIds = new Set((catalog.localRules || []).map((r) => r.id));
    } else if (opts.only === 'canonical') {
      partialRuleIds = new Set(catalog.rules.filter((r) => r.origin !== 'local').map((r) => r.id));
    }
    if (opts.rules.length > 0) {
      const requested = new Set(opts.rules);
      partialRuleIds = partialRuleIds
        ? new Set([...partialRuleIds].filter((id) => requested.has(id)))
        : requested;
    }

    const entries = writeBaseline(
      findings.filter((f) => f.severity !== 'ERROR'),
      ROOT,
      partialRuleIds,
    );
    const total = Object.values(entries).reduce((sum, n) => sum + n, 0);

    if (opts.format === 'json') {
      printJson({
        rulesVersion: catalog.version,
        src: srcDir,
        baseline: { file: BASELINE_NAME, signatures: Object.keys(entries).length },
        findings: [],
      });
    } else if (!opts.quiet) {
      console.log(`\n  ${c.green('✔')} Baseline written: ${BASELINE_NAME} (${total} observation(s), ${Object.keys(entries).length} unique signature(s)).`);
      console.log(`    ${c.dim('Run `node scripts/audit-ux-code.cjs` again to see only what is new.')}\n`);
    }
    return;
  }

  const reported = findings.filter((f) => unreviewed.has(f));
  const absorbed = findings.length - reported.length;

  const finalSummary = { total: reported.length, ERROR: 0, WARNING: 0, INFO: 0, canonical: 0, local: 0 };
  for (const finding of reported) {
    finalSummary[finding.severity] += 1;
    if (finding.origin === 'local') finalSummary.local += 1;
    else finalSummary.canonical += 1;
  }

  const report = {
    rulesVersion: catalog.version,
    srcDir: path.relative(ROOT, srcDir) || '.',
    summary: finalSummary,
    findings: reported,
    baseline: absorbed > 0 ? { absorbed } : undefined,
  };

  if (opts.format === 'json') printJson(report);
  else {
    printHuman(report, opts);
    if (absorbed > 0 && !opts.quiet) {
      console.log(`  ${c.dim('ℹ')} ${absorbed} observation(s) matched the accepted baseline in ${BASELINE_NAME}.\n`);
    }
  }

  if (opts.format !== 'json' && !opts.quiet && unreadable.length) {
    console.log(`  ${c.yellow('▲')} ${unreadable.length} directory(ies) could not be read and were skipped.\n`);
  }

  const gatingFindings = opts.canonicalOnly
    ? reported.filter((f) => f.origin !== 'local')
    : reported;
  const gatingErrors = gatingFindings.filter((f) => f.severity === 'ERROR').length;
  const gatingWarnings = gatingFindings.filter((f) => f.severity === 'WARNING').length;

  const blocked = gatingErrors > 0 || (opts.strict && gatingWarnings > 0);
  if (blocked) {
    if (opts.format === 'json') process.exitCode = 1;
    else {
      console.error(`  ${c.red('✖')} audit-ux failed: ${gatingErrors} error(s)${opts.strict ? `, ${gatingWarnings} warning(s)` : ''}${opts.canonicalOnly ? ' (canonical only)' : ''}.\n`);
      process.exitCode = 1;
    }
  }
}

/**
 * Runs an audit and returns the report, without printing or exiting.
 *
 * @param {object}  [options]
 * @param {string}  [options.root]        Project to audit. Defaults to the repo this file lives in.
 * @param {string}  [options.src]         Source directory, relative to root.
 * @param {string}  [options.config]      Config file path, relative to root.
 * @param {string[]} [options.rules]      Only these rule ids. Defaults to every active rule.
 * @param {boolean} [options.useBaseline] Subtract the accepted baseline. Defaults to true.
 * @returns {{rulesVersion: number, srcDir: string|null, summary: object, findings: object[], unreadable: string[], absorbed: number}}
 */
function auditProject(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const { config } = loadConfig({ config: options.config, preset: options.preset }, root);
  const catalog = loadCatalog(config, root, RULES_PATH);

  const disabledRules = new Set(config.disableRules || []);
  const activeRules = options.rules && options.rules.length
    ? catalog.rules.filter((rule) => options.rules.includes(rule.id))
    : catalog.rules;

  const srcDir = detectSourceDir(options.src, config, root);
  if (!srcDir) {
    return {
      rulesVersion: catalog.version,
      srcDir: null,
      summary: { total: 0, ERROR: 0, WARNING: 0, INFO: 0, canonical: 0, local: 0 },
      findings: [],
      unreadable: [],
      absorbed: 0,
    };
  }

  const deps = loadDependencies(root);
  const excludes = compileExcludes(config.exclude);
  const files = [];
  const unreadable = [];
  collectFiles(srcDir, files, unreadable);

  const findings = [];
  for (const file of applyExcludes(files, excludes, root)) {
    findings.push(...auditFile(file, activeRules, deps, disabledRules, root).findings);
  }

  const severityRank = { ERROR: 0, WARNING: 1, INFO: 2 };
  findings.sort((a, b) => (
    severityRank[a.severity] - severityRank[b.severity]
    || a.file.localeCompare(b.file)
    || a.line - b.line
    || a.rule.localeCompare(b.rule)
  ));

  const applyBaseline = options.useBaseline !== false;

  let reported = findings;
  let absorbed = 0;
  if (applyBaseline) {
    const { keys } = diffAgainstBaseline(findings, root);
    reported = findings.filter((f) => keys.has(f));
    absorbed = findings.length - reported.length;
  }

  const summary = { total: reported.length, ERROR: 0, WARNING: 0, INFO: 0, canonical: 0, local: 0 };
  for (const finding of reported) {
    summary[finding.severity] += 1;
    if (finding.origin === 'local') summary.local += 1;
    else summary.canonical += 1;
  }

  return {
    rulesVersion: catalog.version,
    srcDir: path.relative(root, srcDir) || '.',
    summary,
    findings: reported,
    unreadable,
    absorbed,
  };
}

module.exports = {
  auditProject,
  loadCatalog,
  loadConfig,
  loadRules,
  buildUnits,
  lineMatches,
  hasVisibleText,
  isWithinComponent,
  matchesComponentName,
  fingerprint,
};
if (require.main === module) main();
