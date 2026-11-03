'use strict';

/**
 * scripts/lib/ux-catalog.cjs
 *
 * Catalog, configuration, exclusions, file discovery, and baseline management
 * for the UX static code auditor.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_RULES_PATH = path.join(__dirname, '..', 'ux-rules.json');
const CONFIG_NAME = '.uxaudit.json';
const BASELINE_NAME = 'audit-ux-baseline.json';
const BASELINE_VERSION = 1;

const SEVERITY_ORDER = ['ERROR', 'WARNING', 'INFO'];
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  'coverage',
  '.gripm',
]);
const SKIP_FILE_PATTERN = /(\.test\.|\.spec\.|\.stories\.|\.d\.ts$|^\.env)/;

function fatal(message) {
  const isJson = process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'json';
  if (isJson) {
    console.log(JSON.stringify({ error: message, findings: [] }, null, 2));
  } else {
    console.error(`\n  \x1b[31m✖\x1b[0m audit-ux: ${message}\n`);
  }
  process.exit(2);
}

function resolveConfigFile(explicitPath, root = process.cwd()) {
  if (explicitPath) return path.resolve(root, explicitPath);
  const gripmConfigDot = path.join(root, '.gripm', CONFIG_NAME);
  if (fs.existsSync(gripmConfigDot)) return gripmConfigDot;
  const gripmConfigNoDot = path.join(root, '.gripm', 'uxaudit.json');
  if (fs.existsSync(gripmConfigNoDot)) return gripmConfigNoDot;
  return path.join(root, CONFIG_NAME);
}

function resolveBaselineFile(root = process.cwd(), forWrite = false) {
  const gripmBaseline = path.join(root, '.gripm', BASELINE_NAME);
  const rootBaseline = path.join(root, BASELINE_NAME);
  if (forWrite) {
    if (fs.existsSync(rootBaseline) && !fs.existsSync(gripmBaseline)) return rootBaseline;
    if (fs.existsSync(path.join(root, '.gripm'))) return gripmBaseline;
    return rootBaseline;
  }
  if (fs.existsSync(gripmBaseline)) return gripmBaseline;
  return rootBaseline;
}

function loadConfig(opts = {}, root = process.cwd()) {
  const configPath = resolveConfigFile(opts.config, root);

  if (!fs.existsSync(configPath)) return { configPath, config: {} };

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { configPath, config: config || {} };
  } catch (err) {
    fatal(`Config file ${configPath} is not valid JSON: ${err.message}`);
  }
}

function detectSourceDir(explicit, config = {}, root = process.cwd()) {
  if (explicit) {
    const resolved = path.resolve(root, explicit);
    if (!fs.existsSync(resolved)) fatal(`--src directory does not exist: ${resolved}`);
    return resolved;
  }

  if (config.src) {
    const resolved = path.resolve(root, config.src);
    if (!fs.existsSync(resolved)) fatal(`Config "src" directory does not exist: ${resolved}`);
    return resolved;
  }

  for (const candidate of ['src', 'app', 'frontend', 'web', 'client']) {
    const resolved = path.join(root, candidate);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) return resolved;
  }

  return null;
}

function loadDependencies(root = process.cwd()) {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return new Set();

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ]);
  } catch {
    return new Set();
  }
}

function collectFiles(dir, out = [], unreadable = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    unreadable.push({ dir, error: err.message });
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectFiles(full, out, unreadable);
    } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
      if (SKIP_FILE_PATTERN.test(entry.name)) continue;
      out.push(full);
    }
  }

  return out;
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function globToRegExpSource(glob) {
  return glob
    .split('')
    .reduce((acc, char, index, chars) => {
      if (char === '*') {
        if (chars[index + 1] === '*') return `${acc}.*`;
        return `${acc}[^/]*`;
      }
      if (char === '?') return `${acc}[^/]`;
      if (char === '/') return `${acc}/`;
      return acc + char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }, '');
}

function compileExcludes(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return [];

  return patterns.map((pattern) => {
    const normalized = String(pattern).replace(/\\/g, '/').replace(/^\.\//, '');

    const anchors = normalized.startsWith('/')
      ? [normalized.slice(1)]
      : [normalized, `**/${normalized}`];

    return {
      pattern: normalized,
      regexp: new RegExp(`^(?:${anchors.map(globToRegExpSource).join('|')})$`),
    };
  });
}

function isExcluded(relPath, excludes) {
  return excludes.some(({ regexp }) => regexp.test(relPath));
}

function applyExcludes(files, excludes, root = process.cwd()) {
  if (excludes.length === 0) return files;

  return files.filter((file) => !isExcluded(toPosixPath(path.relative(root, file)), excludes));
}

function loadRules(rulesPath = DEFAULT_RULES_PATH) {
  let raw;
  try {
    raw = fs.readFileSync(rulesPath, 'utf8');
  } catch {
    fatal(`Cannot read the rule catalog at ${rulesPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fatal(`Rule catalog is not valid JSON: ${err.message}`);
  }

  if (!Array.isArray(parsed.rules) || parsed.rules.length === 0) {
    fatal('Rule catalog contains no rules.');
  }

  const seen = new Set();
  for (const rule of parsed.rules) {
    for (const field of ['id', 'title', 'severity', 'message']) {
      if (!rule[field]) fatal(`Rule is missing required field "${field}": ${JSON.stringify(rule)}`);
    }
    if (!SEVERITY_ORDER.includes(rule.severity)) {
      fatal(`Rule ${rule.id} has invalid severity "${rule.severity}".`);
    }
    if (seen.has(rule.id)) fatal(`Duplicate rule id: ${rule.id}`);
    seen.add(rule.id);
  }

  return {
    version: parsed.version || 1,
    rules: parsed.rules.map((rule) => ({ ...rule, origin: 'canonical' })),
  };
}

function loadLocalRules(relativePath, root, canonical) {
  const localPath = path.resolve(root, relativePath);

  if (!fs.existsSync(localPath)) {
    fatal(`Config "rules" points at ${localPath}, which does not exist.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  } catch (err) {
    fatal(`Local rule catalog ${localPath} is not valid JSON: ${err.message}`);
  }

  if (!Array.isArray(parsed.rules)) {
    fatal(`Local rule catalog ${localPath} has no "rules" array.`);
  }

  const canonicalMap = new Map((canonical?.rules || []).map((r) => [r.id, r]));

  for (const rule of parsed.rules) {
    if (typeof rule.id === 'string') {
      if (canonicalMap.has(rule.id)) {
        const canonicalRule = canonicalMap.get(rule.id);
        fatal(
          `Local rule ${rule.id} collides with canonical rule "${canonicalRule.title}". ` +
          'A local catalog adds rules; it cannot redefine shared ones.',
        );
      }
      if (/^UX-\d{3}$/.test(rule.id)) {
        fatal(
          `Local rule ${rule.id} uses the reserved canonical pattern. ` +
          'UX-NNN belongs to scripts/ux-rules.json so that one id means one thing ' +
          'across every consumer. Give the local rule its own prefix.',
        );
      }
    }
  }

  return { version: parsed.version || 1, rules: parsed.rules, localPath };
}

function loadCatalog(config, root = process.cwd(), rulesPath = DEFAULT_RULES_PATH) {
  const canonical = loadRules(rulesPath);
  if (!config || !config.rules) return { ...canonical, localRules: [] };

  const local = loadLocalRules(config.rules, root, canonical);

  const merged = [
    ...canonical.rules.map((rule) => ({ ...rule, origin: 'canonical' })),
    ...local.rules.map((rule) => ({ ...rule, origin: 'local' })),
  ];

  for (const rule of merged) {
    for (const field of ['id', 'title', 'severity', 'message']) {
      if (!rule[field]) fatal(`Rule is missing required field "${field}": ${JSON.stringify(rule)}`);
    }
    if (!SEVERITY_ORDER.includes(rule.severity)) {
      fatal(`Rule ${rule.id} has invalid severity "${rule.severity}".`);
    }
    if (!rule.check || !Array.isArray(rule.check.line) || !rule.check.line.length
      && !rule.check.alsoContent) {
      fatal(`Rule ${rule.id} has no detection signature.`);
    }
  }

  return { version: canonical.version, rules: merged, localRules: local.rules, localPath: local.localPath };
}

function fingerprint(finding) {
  const normalized = (finding.snippet || finding.message || '').replace(/\s+/g, ' ').trim();
  const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  return `${finding.rule}|${finding.file}|${digest}`;
}

function loadBaseline(root = process.cwd()) {
  const file = resolveBaselineFile(root, false);
  if (!fs.existsSync(file)) return { version: BASELINE_VERSION, entries: {} };

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed.version !== BASELINE_VERSION) {
      console.warn(
        `  \x1b[33m▲\x1b[0m Baseline is v${parsed.version}, this auditor expects v${BASELINE_VERSION}. ` +
        `Regenerate it with: node scripts/audit-ux-code.cjs --update-baseline`,
      );
      return { version: BASELINE_VERSION, entries: {} };
    }
    return parsed;
  } catch (err) {
    fatal(`Cannot read ${BASELINE_NAME}: ${err.message}`);
  }

  return { version: BASELINE_VERSION, entries: {} };
}

function writeBaseline(findings, root = process.cwd(), partialRuleIds = null) {
  const entries = {};

  if (partialRuleIds instanceof Set) {
    const existing = loadBaseline(root);
    for (const [key, count] of Object.entries(existing.entries || {})) {
      const ruleId = key.split('|')[0];
      if (!partialRuleIds.has(ruleId)) {
        entries[key] = count;
      }
    }
  }

  for (const finding of findings) {
    if (partialRuleIds instanceof Set && !partialRuleIds.has(finding.rule)) continue;
    const key = fingerprint(finding);
    entries[key] = (entries[key] || 0) + 1;
  }

  const payload = {
    version: BASELINE_VERSION,
    description:
      'Observations already reviewed. WARNING and INFO only; ERROR is never absorbed.',
    entries,
  };

  const targetPath = resolveBaselineFile(root, true);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`);
  return entries;
}

function diffAgainstBaseline(all, root = process.cwd()) {
  const baseline = loadBaseline(root);
  const counts = new Map(Object.entries(baseline.entries || {}));
  const regressions = new Set();

  for (const finding of all) {
    if (finding.severity === 'ERROR') {
      regressions.add(finding);
      continue;
    }

    const key = fingerprint(finding);
    const left = counts.get(key) || 0;
    if (left > 0) counts.set(key, left - 1);
    else regressions.add(finding);
  }

  return { baseline, keys: regressions };
}

function parseArgs(argv) {
  const opts = {
    src: null,
    config: null,
    strict: false,
    canonicalOnly: false,
    only: null,
    format: 'human',
    listRules: false,
    rules: [],
    quiet: false,
    help: false,
    updateBaseline: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--root':
      case '--cwd':
        i += 1;
        break;
      case '--src': opts.src = argv[++i]; break;
      case '--config': opts.config = argv[++i]; break;
      case '--strict': opts.strict = true; break;
      case '--canonical-only': opts.canonicalOnly = true; break;
      case '--only': opts.only = argv[++i]; break;
      case '--format': opts.format = argv[++i]; break;
      case '--list-rules': opts.listRules = true; break;
      case '--rule': opts.rules.push(argv[++i]); break;
      case '--quiet': opts.quiet = true; break;
      case '--update-baseline': opts.updateBaseline = true; break;
      case '--help':
      case '-h': opts.help = true; break;
      default:
        if (arg.startsWith('--root=') || arg.startsWith('--cwd=')) {
          break;
        }
        if (arg.startsWith('--')) fatal(`Unknown option: ${arg}`);
    }
  }

  if (!['human', 'json'].includes(opts.format)) {
    fatal(`Unknown --format "${opts.format}". Expected "human" or "json".`);
  }

  if (opts.only && !['canonical', 'local'].includes(opts.only)) {
    fatal(`Unknown --only "${opts.only}". Expected "canonical" or "local".`);
  }

  return opts;
}

function printRuleCatalog(catalog) {
  const local = (catalog.localRules || []).length;
  console.log('');
  console.log(
    `Rule catalog v${catalog.version} - ${catalog.rules.length} signatures`
    + (local ? ` (${catalog.rules.length - local} canonical, ${local} local)` : ''),
  );
  if (catalog.localPath) console.log(`Local catalog: ${path.basename(catalog.localPath)}`);
  console.log('');
  for (const rule of catalog.rules) {
    const gated = rule.requires && rule.requires.deps
      ? ` [requires: ${rule.requires.deps.join(' | ')}]`
      : ' [stack agnostic]';
    console.log(`${rule.severity.padEnd(7)} ${rule.id}  ${rule.title}${gated}`);
  }
  console.log('');
}

module.exports = {
  DEFAULT_RULES_PATH,
  CONFIG_NAME,
  BASELINE_NAME,
  BASELINE_VERSION,
  SEVERITY_ORDER,
  SCAN_EXTENSIONS,
  SKIP_DIRS,
  SKIP_FILE_PATTERN,
  fatal,
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
};
