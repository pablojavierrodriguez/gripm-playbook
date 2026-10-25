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
const crypto = require('crypto');

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
const CONFIG_NAME = '.uxaudit.json';
const BASELINE_NAME = 'audit-ux-baseline.json';
const BASELINE_VERSION = 1;

const SEVERITY_ORDER = ['ERROR', 'WARNING', 'INFO'];
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next',
  '.turbo', '.svelte-kit', '.cache', 'vendor', '__tests__', '__mocks__',
  '__snapshots__', 'storybook', 'stories', 'e2e', 'cypress',
]);
const SKIP_FILE_PATTERN = /(\.test\.|\.spec\.|\.stories\.|\.d\.ts$|^\.env)/;

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

function loadRules() {
  let raw;
  try {
    raw = fs.readFileSync(RULES_PATH, 'utf8');
  } catch {
    fatal(`Cannot read the rule catalog at ${RULES_PATH}`);
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

/**
 * Loads a project-owned catalog and merges it with the canonical one.
 *
 * A project that needs its own signatures must not fork the engine to get them.
 * It writes a catalog of its own and names it in `.uxaudit.json`; the canonical
 * catalog stays untouched by the sync and the rules simply run alongside it.
 *
 * `UX-NNN` is reserved. Squatting a canonical id is what lets one project read
 * "my UX-009 is touch target" while the skill documents something else, so a
 * local catalog using that pattern is rejected rather than merged.
 */
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

function loadCatalog(config, root) {
  const canonical = loadRules();
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

function resolveConfigFile(explicitPath, root = ROOT) {
  if (explicitPath) return path.resolve(root, explicitPath);
  const gripmConfig = path.join(root, '.gripm', CONFIG_NAME);
  if (fs.existsSync(gripmConfig)) return gripmConfig;
  return path.join(root, CONFIG_NAME);
}

function resolveBaselineFile(root = ROOT, forWrite = false) {
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

function loadConfig(opts, root = ROOT) {
  const configPath = resolveConfigFile(opts.config, root);

  if (!fs.existsSync(configPath)) return { configPath, config: {} };

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { configPath, config: config || {} };
  } catch (err) {
    fatal(`Config file ${configPath} is not valid JSON: ${err.message}`);
  }
}

function detectSourceDir(explicit, config, root = ROOT) {
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

function loadDependencies(root = ROOT) {
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

/** Normalizes a path to forward slashes so glob matching is OS independent. */
function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

/**
 * Compiles the `exclude` patterns of .uxaudit.json into matchers.
 *
 * Supports the glob subset that is meaningful for source paths: `**` (any depth,
 * including none), `*` (any run of chars except a separator) and `?`. Patterns are
 * resolved relative to ROOT so a project can exclude `src/legacy/**` regardless of
 * the directory the auditor was pointed at with --src.
 */
function compileExcludes(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return [];

  return patterns.map((pattern) => {
    const normalized = String(pattern).replace(/\\/g, '/').replace(/^\.\//, '');

    // A pattern matches both as written (`src/legacy/**`, relative to ROOT)
    // and at any depth (`**/src/legacy/**`), so authors never have to guess
    // whether a path is anchored to the project root or to a nested folder.
    const anchors = normalized.startsWith('/')
      ? [normalized.slice(1)]
      : [normalized, `**/${normalized}`];

    return {
      pattern: normalized,
      regexp: new RegExp(`^(?:${anchors.map(globToRegExpSource).join('|')})$`),
    };
  });
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

function isExcluded(relPath, excludes) {
  return excludes.some(({ regexp }) => regexp.test(relPath));
}

/** Drops excluded files before auditing so their paths never reach the report. */
function applyExcludes(files, excludes, root = ROOT) {
  if (excludes.length === 0) return files;

  return files.filter((file) => !isExcluded(toPosixPath(path.relative(root, file)), excludes));
}

/** Returns '*' for a blanket suppression or the list of suppressed rule ids. */
function readSuppression(line) {
  const match = line.match(/ux-audit-ignore\s*([A-Z]+-\d+)?/);
  if (!match) return null;
  return match[1] || '*';
}

function buildWindow(lines, index, radius) {
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines.slice(start, end).join('\n');
}

const TAG_OPEN = /<[A-Za-z][\w.]*/g;

/**
 * Classifies the tags a chunk of text opens, closes and self-closes.
 *
 * The three kinds have to be told apart for nesting depth to mean anything:
 *
 *     <button onClick={save}>     open       depth +1
 *       <Icon />                  self-close depth  0   <- must NOT close the parent
 *       <span>Guardar</span>      open + close      0
 *     </button>                   close      depth -1
 *
 * Counting bare `>` characters instead cannot tell a self-closing child from a
 * parent with children, so `<button>` and its contents end up in different units
 * and any rule asking for "the content of this element" sees an empty string.
 */
function countTagKinds(text) {
  const open = (text.match(TAG_OPEN) || []).length;
  const close = (text.match(/<\/[A-Za-z][\w.]*\s*>/g) || []).length;
  const self = (text.match(/\/>/g) || []).length;
  return { open, close, self };
}

/**
 * Offset of the `>` that terminates the opening tag at `from`, or -1.
 *
 * Scanning is needed because several `>` characters are not terminators: an arrow
 * (`=>`), a comparison (`a > b`), a generic (`Array<string>`) and anything inside
 * a string or an attribute expression. A multiline opening tag ends wherever its
 * real terminator sits, which is what tells the attribute lines from the children.
 */
function findTagEnd(text, from) {
  let i = from;
  while (i < text.length) {
    const ch = text[i];

    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }

    if (ch === '{') {
      let depth = 0;
      while (i < text.length) {
        if (text[i] === '{') depth += 1;
        else if (text[i] === '}') {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
        i += 1;
      }
      continue;
    }

    if (ch === '=' && text[i + 1] === '>') {
      i += 2;
      continue;
    }

    if (ch === '>') {
      return i;
    }

    i += 1;
  }

  return -1;
}

/** Stands in for a label expression that survived `stripExpressions`. */
const EXPRESSION_LABEL = 'label';

/**
 * Removes `{...}` expression containers, respecting nesting and quotes.
 *
 * A JSX expression renders whatever it evaluates to, not its own source, so the
 * source cannot be read as visible text — with one exception, `keep`. An
 * expression sitting in the CHILD LIST that is itself a label does render text:
 * `{t('header.newItem')}` is the whole reason an internationalized control used
 * to be indistinguishable from an icon-only one.
 *
 * LOCATION is the entire distinction, never "stop stripping". Attributes never
 * reach this function (they live in the opening tag, which the child-region
 * segments skip), so `onClick={() => go()}` is still discarded — and
 * `isTextExpression` rejects any arrow outright, so a handler that somehow landed
 * in a child position could not become a label either.
 */
function stripExpressions(source, keep = () => false) {
  let out = '';
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }

    if (ch === '{') {
      const start = i;
      let depth = 0;
      let closed = -1;
      while (i < source.length) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            closed = i;
            break;
          }
        }
        i += 1;
      }

      // An unterminated `{` is unbalanced markup, not an expression. It is
      // dropped either way; `keep` simply gets no chance to vouch for it.
      const inner = closed === -1 ? source.slice(start + 1) : source.slice(start + 1, closed - 1);
      if (keep(inner)) out += EXPRESSION_LABEL;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/**
 * Whether a child-position expression is itself a visible label.
 *
 * A call or a literal renders text — `t('common.delete')`, `i18n.t('x')` and
 * `` `Saved ${n}` `` are the everyday spelling of a localized label. Anything
 * that builds a subtree (`{cond && <X />}`, `{items.map(...)}`) renders
 * elements, not text, and whatever text it eventually shows belongs to that
 * subtree, which is parsed and weighted on its own.
 *
 * Quoted arguments are blanked before the verdict so a key cannot decide it:
 * `t('is it?')` is a label, `cond && label` is not. `=>` is rejected outright —
 * an arrow is code, never a name.
 */
function isTextExpression(inner) {
  const code = inner.trim().replace(/\?\./g, '.');
  if (!code) return false;

  let bare = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < code.length && code[i] !== quote) i += code[i] === '\\' ? 2 : 1;
      i += 1;
      bare += quote + quote;
      continue;
    }
    bare += ch;
    i += 1;
  }

  if (/=>|[&|]|\?/.test(bare)) return false;
  if (/^[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*\(.*\)$/s.test(bare)) return true;
  if (/^(?:''|""|``)$/.test(bare)) return true;
  return /^(?:\d[\d_]*(?:\.\d+)?|true|false)$/.test(bare);
}

/**
 * Characters that can only precede a child element from inside an expression.
 *
 * `{cond && <span>Guardar</span>}` is not a label. When the condition is false
 * the control renders no name at all, and deciding which branch is live is the
 * author's call, not the detector's — counting that subtree upwards would
 * silence a finding for a control whose accessible name is not guaranteed.
 */
const CONDITIONAL_PREFIX = /[&|?:(]/;

function isConditionalChild(child, text) {
  let i = child.at - 1;
  while (i >= 0 && /\s/.test(text[i])) i -= 1;
  return i >= 0 && CONDITIONAL_PREFIX.test(text[i]);
}

/**
 * Groups lines into JSX elements.
 *
 * Every element produces one unit carrying two granularities:
 *
 *   `text`       the opening tag and its attributes only. Rules that look for a
 *                signature (`line`, `alsoLine`, `unlessLine`) match here, so a
 *                finding points at the element that actually carries the
 *                problem instead of at the outermost wrapper.
 *
 *   `scopeText`  the element plus every descendant. Rules that ask about
 *                content (`needsContent`, `unlessContent`) match here, which is
 *                what makes "this button contains an icon" a question that can
 *                actually be answered.
 *
 * Nesting is tracked so a self-closing child does not end its parent, and
 * statements outside JSX become their own units so they never over-merge.
 */
function buildUnits(lines) {
  const units = [];
  const allFrames = [];
  const text = lines.join('\n');
  const stack = [];

  const lineStarts = [];
  let acc = 0;
  for (const line of lines) {
    lineStarts.push(acc);
    acc += line.length + 1;
  }

  const lineOf = (pos) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const closeFrame = (frame, endLine, spanEnd, closeAt) => {
    frame.endLine = endLine;
    frame.spanEnd = spanEnd;
    frame.closeAt = closeAt;

    const start = Math.min(frame.startLine, endLine);
    const ancestors = [];
    let curr = frame.parent;
    while (curr) {
      if (curr.name) ancestors.push(curr.name);
      curr = curr.parent;
    }

    const unit = {
      name: frame.name || null,
      ancestors,
      startLine: start + 1,
      headEndLine: frame.headEndLine,
      endLine: Math.max(start, endLine) + 1,
      parts: lines.slice(frame.startLine, frame.headEndLine + 1),
      // The opening tag itself, not the physical line. Several elements often
      // share one line, and a self-closing `<Icon />` sitting next to a `<button`
      // must not inherit the button's signature and be reported as one.
      text: text.slice(frame.at, frame.tagEnd + 1),
      scopeText: lines.slice(start, Math.max(start, endLine) + 1).join('\n'),
      isElement: true,
      spanStart: frame.at,
      spanEnd,
    };

    units.push(unit);
    allFrames.push(frame);
    frame.unit = unit;
    if (frame.parent) frame.parent.children.push(frame);
    return unit;
  };

  let i = 0;

  while (i < text.length) {
    const at = text.indexOf('<', i);
    if (at === -1) break;

    // A `<` that cannot start a tag is a comparison or a generic.
    const next = text[at + 1];
    if (!next || !/[A-Za-z/>]/.test(next)) {
      i = at + 1;
      continue;
    }

    const tagEnd = findTagEnd(text, at);
    if (tagEnd === -1) {
      i = at + 1;
      continue;
    }

    const tagText = text.slice(at, tagEnd + 1);
    const headEndLine = lineOf(tagEnd);

    if (tagText.startsWith('</')) {
      const name = (tagText.match(/^<\/\s*([A-Za-z][\w.]*)?/) || [])[1] || '';
      // A fragment close (`</>`) has no name and closes whatever is innermost.
      const index = name
        ? stack.map((frame) => frame.name).lastIndexOf(name)
        : stack.length - 1;

      if (index !== -1) {
        // Anything still open above the match is markup the author left
        // unbalanced. It is closed here rather than dropped, so an unclosed
        // element never swallows the rest of the file and never hides a finding.
        for (let n = stack.length - 1; n > index; n -= 1) {
          closeFrame(stack[n], headEndLine, at - 1, at);
        }

        const frame = stack[index];
        stack.length = index;
        closeFrame(frame, headEndLine, tagEnd, at);
      }

      i = tagEnd + 1;
      continue;
    }

    const name = (tagText.match(/^<\s*([A-Za-z][\w.]*)/) || [])[1] || '';
    const parent = stack.length ? stack[stack.length - 1] : null;
    const frame = {
      name,
      startLine: lineOf(at),
      headEndLine,
      at,
      tagEnd,
      parent,
      children: [],
    };

    if (/\/>\s*$/.test(tagText)) {
      closeFrame(frame, headEndLine, tagEnd, tagEnd + 1);
    } else {
      stack.push(frame);
    }

    i = tagEnd + 1;
  }

  // Unbalanced markup must not swallow the rest of the file.
  while (stack.length) {
    const frame = stack.pop();
    closeFrame(frame, lineOf(text.length - 1), text.length - 1, text.length);
  }

  // An element's own content: its source minus the source of every nested
  // element. Without this level a wrapper inherits its child's signature — a
  // `<div>` around `<span>{format(date, "MMMM")}</span>` would report the date
  // leak and point at the wrapper instead of the element rendering the value.
  // Renderable text, bottom-up: an element's own text plus the text its
  // descendants render. Attributes are excluded by construction (they live in
  // the opening tag, which the segments skip). A `{...}` expression in the child
  // list counts only when it is itself a label (`{t('x')}`); a subtree built by
  // one (`{cond && <span/>}`) is never pulled upwards, because neither it nor
  // the condition that guards it guarantees a name.
  //
  // Descendant text has to be included. A control labelled `<Icon /><span>
  // Guardar</span>` shows "Guardar" to the user, so counting only the element's
  // direct text nodes would call it unlabelled — which is how `unlessVisibleText`
  // ended up inert for the most common button shape there is.
  for (const frame of allFrames) {
    const segments = [];
    let cursor = frame.tagEnd + 1;

    for (const child of frame.children) {
      if (child.at > cursor) segments.push(text.slice(cursor, child.at));
      cursor = Math.max(cursor, child.spanEnd + 1);
    }
    if (frame.closeAt > cursor) segments.push(text.slice(cursor, frame.closeAt));

    frame.unit.ownContent =
      text.slice(frame.at, frame.tagEnd + 1) + segments.join('') + text.slice(frame.closeAt, frame.spanEnd + 1);

    frame.unit.textContent = stripExpressions(segments.join(''), isTextExpression);
  }

  for (const frame of allFrames.slice().reverse()) {
    if (!frame.children.length) continue;
    frame.unit.textContent = frame.children.reduce(
      (sum, child) => sum + (isConditionalChild(child, text) ? '' : child.unit.textContent),
      frame.unit.textContent,
    );
  }

  // Statements outside JSX are units too, so line-based rules still see them.
  const covered = new Set();
  for (const unit of units) {
    for (let n = unit.startLine; n <= unit.endLine; n += 1) covered.add(n);
  }
  // `covered` holds 1-based line numbers, matching the units.
  for (let n = 0; n < lines.length; n += 1) {
    if (covered.has(n + 1) || !lines[n].trim()) continue;
    units.push({
      name: null,
      ancestors: [],
      startLine: n + 1,
      headEndLine: n,
      endLine: n + 1,
      parts: [lines[n]],
      text: lines[n],
      scopeText: lines[n],
      isElement: false,
    });
  }

  units.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
  return units;
}

function ruleAppliesToProject(rule, relPath, deps) {
  const check = rule.check || {};

  if ((check.unlessFile || []).some((token) => relPath.includes(token))) return false;

  // The positive counterpart of `unlessFile`. Without it a rule scoped by
  // context — "`truncate` inside a dialog" — cannot be expressed at all, because
  // a file filter can only ever switch a rule off.
  if ((check.onlyFile || []).length
    && !(check.onlyFile || []).some((token) => relPath.includes(token))) return false;

  const required = rule.requires && rule.requires.deps;
  if (required && required.length && !required.some((dep) => deps.has(dep))) return false;

  return true;
}

/**
 * Whether an element renders any visible text.
 *
 * This is what separates an icon-only button from a labelled one, and a token
 * list cannot express it: `<button><span>Guardar</span></button>` is accessible
 * because the user sees "Guardar", and no `aria-*` attribute is involved. The
 * escapes an attribute list can hold never cover that case.
 *
 * `textContent` is derived from parse offsets rather than stripped from the raw
 * source, so an arrow function inside an attribute cannot be mistaken for a label.
 */
function hasVisibleText(unit) {
  if (typeof unit.textContent === 'string') return unit.textContent.trim().length > 0;
  return false;
}

/**
 * Checks if a JSX component name matches a target token.
 * Matches exact name ("Dialog") or dotted compound names ("Dialog.Content" matches "Dialog" or "Dialog.Content").
 */
function matchesComponentName(componentName, token) {
  if (!componentName || !token) return false;
  if (componentName === token) return true;
  if (componentName.startsWith(token + '.')) return true;
  return false;
}

/**
 * Checks whether an element unit is rendered inside ANY of the specified component tokens.
 * Evaluates the element itself and all of its enclosing AST ancestors.
 */
function isWithinComponent(unit, tokens) {
  if (!tokens || !tokens.length) return true;
  const candidates = [];
  if (unit && unit.name) candidates.push(unit.name);
  if (unit && Array.isArray(unit.ancestors)) {
    candidates.push(...unit.ancestors);
  }
  if (!candidates.length) return false;

  return tokens.some((token) =>
    candidates.some((candidate) => matchesComponentName(candidate, token))
  );
}

/**
 * Decides whether a rule matches one element unit.
 *
 * The unit carries two granularities and each check kind reads the right one:
 *
 *   `line`, `alsoLine`, `unlessLine`  →  `unit.text`, the opening tag and its
 *       attributes. A signature belongs to the element that carries it, and a
 *       finding should point at that element rather than at its wrapper.
 *
 *   `needsContent`, `unlessContent`  →  `unit.scopeText`, the element plus every
 *       descendant. "Does this button contain an icon?" is a question about the
 *       subtree, so evaluating it against the whole file — as an earlier version
 *       did — made one `Icon` declaration turn every button in the file into an
 *       icon-only button.
 *
 * `unlessVisibleText` reads that same subtree but semantically, for rules about
 * whether a control exposes a name to the user.
 *
 * `nearby` and `unlessNearby` keep reading a line window, which is inherently
 * positional.
 */
function lineMatches(rule, unit, lines, unitIndex, content) {
  const check = rule.check || {};
  const text = unit.text;
  const scope = unit.scopeText;

  const anyIn = (list) => list.some((token) => text.includes(token));
  const anyInScope = (list) => list.some((token) => scope.includes(token));

  if (!(check.line || []).some((token) => text.includes(token))
      && !(check.alsoContent || []).some((token) => (unit.ownContent || scope).includes(token))) return false;
  if ((check.alsoLine || []).length && !anyIn(check.alsoLine)) return false;
  if (anyIn(check.unlessLine || [])) return false;
  if (anyInScope(check.unlessContent || [])) return false;
  if ((check.needsContent || []).length && !anyInScope(check.needsContent)) return false;
  if (check.unlessVisibleText && hasVisibleText(unit)) return false;
  if ((check.withinComponent || []).length && !isWithinComponent(unit, check.withinComponent)) return false;
  if ((check.unlessComponent || []).length && isWithinComponent(unit, check.unlessComponent)) return false;

  const radius = typeof check.window === 'number' ? check.window : 6;
  if ((check.nearby || []).length || (check.unlessNearby || []).length) {
    const window = buildWindow(lines, unit.startLine - 1, radius);
    if ((check.nearby || []).length && !(check.nearby || []).some((t) => window.includes(t))) return false;
    if ((check.unlessNearby || []).some((t) => window.includes(t))) return false;
  }

  return true;
}

function auditFile(filePath, rules, deps, disabledRules, root = ROOT) {
  const findings = [];
  // The fingerprint embeds this path, so a baseline written on Windows must
  // match the same snapshot read on macOS and vice versa. Without the
  // normalization the keys are `src\App.tsx` on one platform and `src/App.tsx`
  // on the other, nothing matches, and the gate silently reports every
  // accepted observation as new — the same normalization `applyExcludes`
  // already performs for `exclude` globs.
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
    baseline: report.baseline,
    findings: report.findings,
  }, null, 2));
}

/**
 * Stable identity for an observation, used to match findings against a baseline.
 *
 * Rule, file and a digest of the offending source. Line numbers are excluded on
 * purpose: inserting an import above a violation must not invalidate the whole
 * snapshot.
 */
function fingerprint(finding) {
  const normalized = (finding.snippet || finding.message || '').replace(/\s+/g, ' ').trim();
  const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  return `${finding.rule}|${finding.file}|${digest}`;
}

function loadBaseline(root = ROOT) {
  const file = resolveBaselineFile(root, false);
  if (!fs.existsSync(file)) return { version: BASELINE_VERSION, entries: {} };

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed.version !== BASELINE_VERSION) {
      console.warn(
        `  ${c.yellow('▲')} Baseline is v${parsed.version}, this auditor expects v${BASELINE_VERSION}. ` +
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

function writeBaseline(findings, root = ROOT, partialRuleIds = null) {
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

  const targetPath = resolveBaselineFile(root || ROOT, true);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`);
  return entries;
}

/**
 * Splits findings into accepted-by-baseline and new.
 *
 * Occurrences are counted with multiplicity, so a fifth instance of something the
 * snapshot accepted four times is reported as new. ERROR never enters this path:
 * a severity that blocks the build cannot be silenced by a snapshot.
 */
function diffAgainstBaseline(all, root = ROOT) {
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
    console.log(`        signature: ${rule.signature}`);
    console.log(`        fix: ${rule.fix}`);
    console.log('');
  }
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

  // Config is read first so `--list-rules` can show the project's own signatures
  // alongside the canonical ones.
  const { config } = loadConfig(opts);
  const catalog = loadCatalog(config, ROOT);

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

  // A snapshot of already-reviewed observations lets a project adopt the
  // auditor on a codebase that already carries hundreds of findings, without
  // either silencing the gate or drowning in noise nobody will ever read.
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
 * This is the programmatic entry point. It exists because a project that needs
 * its own signatures must be able to *extend* the auditor, and forking the file
 * was the only way to do that before. A consumer now imports this, adds whatever
 * it needs around the findings, and keeps the canonical catalog untouched by the
 * sync.
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
  const { config } = loadConfig({ config: options.config }, root);
  const catalog = loadCatalog(config, root);

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

  // `diffAgainstBaseline` returns the observations the snapshot does NOT cover,
  // which are exactly the ones worth reporting.
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

// Running as a binary is what triggers an audit. Importing the module is not,
// so a consumer can build on top of it without the CLI firing as a side effect.
if (require.main === module) main();