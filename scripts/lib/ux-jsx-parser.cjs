'use strict';

/**
 * scripts/lib/ux-jsx-parser.cjs
 *
 * JSX and AST heuristic unit parser for the UX static code auditor.
 * Extracts structural units, scopes, visible text nodes, and component hierarchy.
 */

const TAG_OPEN = /<[A-Za-z][\w.]*/g;

/**
 * Classifies the tags a chunk of text opens, closes and self-closes.
 *
 * The three kinds have to be told apart for nesting depth to mean anything:
 *     <button onClick={save}>     open       depth +1
 *       <Icon />                  self-close depth  0   <- must NOT close the parent
 *       <span>Guardar</span>      open + close      0
 *     </button>                   close      depth -1
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
 * a string or an attribute expression.
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
 * source cannot be read as visible text - with one exception, `keep`. An
 * expression sitting in the CHILD LIST that is itself a label does render text:
 * `{t('header.newItem')}` is the whole reason an internationalized control used
 * to be indistinguishable from an icon-only one.
 */
function stripExpressions(source, keep = () => false) {
  let result = '';
  let i = 0;

  while (i < source.length) {
    if (source[i] === '{') {
      const exprStart = i;
      let depth = 0;
      let inQuote = null;

      while (i < source.length) {
        const ch = source[i];

        if (inQuote) {
          if (ch === '\\') {
            i += 2;
            continue;
          }
          if (ch === inQuote) inQuote = null;
          i += 1;
          continue;
        }

        if (ch === '"' || ch === "'" || ch === '`') {
          inQuote = ch;
          i += 1;
          continue;
        }

        if (ch === '{') depth += 1;
        else if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
        i += 1;
      }

      const inner = source.slice(exprStart + 1, i - 1);
      if (keep(inner)) {
        result += EXPRESSION_LABEL;
      }
      continue;
    }

    result += source[i];
    i += 1;
  }

  return result;
}

/**
 * Tests whether an expression sitting directly in the child list renders a label.
 *
 * Translation helpers, string literals, string interpolations and ternary
 * expressions whose branches are labels all produce visible text.
 */
function isTextExpression(inner) {
  const trimmed = inner.trim();

  // Translation helpers: `t('key')`, `i18n.t('key')`, `formatMessage({ id: 'x' })`.
  if (/\b(?:t|formatMessage|msg)\s*\(/.test(trimmed)) return true;

  // Raw string literal: `{'Submit'}`.
  if (/^(['"`]).*\1$/s.test(trimmed)) return true;

  // Simple identifier passed down: `{label}`, `{title}`, `{labelText}`.
  if (/^[A-Za-z_$][\w$]*$/.test(trimmed) && /(label|title|text|name|caption)/i.test(trimmed)) {
    return true;
  }

  // Ternary where either branch could be a label: `{loading ? 'Saving...' : 'Save'}`.
  const question = trimmed.indexOf('?');
  const colon = trimmed.lastIndexOf(':');
  if (question !== -1 && colon > question) {
    const left = trimmed.slice(question + 1, colon).trim();
    const right = trimmed.slice(colon + 1).trim();
    if (isTextExpression(left) || isTextExpression(right)) return true;
  }

  return false;
}

const CONDITIONAL_PREFIX = /[&|?:(]/;

/**
 * Distinguishes an unconditional element from one rendered by an expression.
 */
function isConditionalChild(child, text) {
  let at = child.at - 1;
  while (at >= 0 && /\s/.test(text[at])) at -= 1;
  if (at < 0) return false;
  return CONDITIONAL_PREFIX.test(text[at]);
}

/**
 * Slices the file into syntactic units with their context.
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
      const index = name
        ? stack.map((frame) => frame.name).lastIndexOf(name)
        : stack.length - 1;

      if (index !== -1) {
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

  while (stack.length) {
    const frame = stack.pop();
    closeFrame(frame, lineOf(text.length - 1), text.length - 1, text.length);
  }

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

  const covered = new Set();
  for (const unit of units) {
    for (let n = unit.startLine; n <= unit.endLine; n += 1) covered.add(n);
  }

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

/**
 * Whether an element renders any visible text.
 */
function hasVisibleText(unit) {
  if (typeof unit.textContent === 'string') return unit.textContent.trim().length > 0;
  return false;
}

/**
 * Checks if a JSX component name matches a target token.
 */
function matchesComponentName(componentName, token) {
  if (!componentName || !token) return false;
  if (componentName === token) return true;
  if (componentName.startsWith(token + '.')) return true;
  return false;
}

/**
 * Checks whether an element unit is rendered inside ANY of the specified component tokens.
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

function buildWindow(lines, index, radius) {
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines.slice(start, end).join('\n');
}

/**
 * Decides whether a rule matches one element unit.
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

module.exports = {
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
};
