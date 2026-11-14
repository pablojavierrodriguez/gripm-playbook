/**
 * Physical hit-testing verifier for mobile viewports (default 375x812).
 *
 * Beyond visibility assertions (which only inspect CSS/opacity), this helper
 * verifies three physical runtime invariants in one check:
 * 1. Effective interactive area >= 44x44px (accounting for ::before / ::after
 *    pseudo-element expansion relative to the element's padding-box).
 * 2. Bounding box fits inside the active mobile viewport bounds (0..viewportHeight).
 * 3. document.elementFromPoint(cx, cy) at the effective center resolves to the
 *    target element itself or one of its descendants (not an occluding overlay).
 */

const INACTIVE_PSEUDO_CONTENT = new Set(['none', 'normal']);

export function parsePxValue(value, fallback = null) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'auto' || trimmed === 'none' || trimmed === 'normal') return fallback;
  if (!/^[-+]?\d*\.?\d+(px)?$/.test(trimmed)) return fallback;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeBox(rect) {
  const left = Number.isFinite(rect?.left) ? rect.left : (Number.isFinite(rect?.x) ? rect.x : 0);
  const top = Number.isFinite(rect?.top) ? rect.top : (Number.isFinite(rect?.y) ? rect.y : 0);
  const width = Number.isFinite(rect?.width)
    ? rect.width
    : (Number.isFinite(rect?.right) ? Math.max(0, rect.right - left) : 0);
  const height = Number.isFinite(rect?.height)
    ? rect.height
    : (Number.isFinite(rect?.bottom) ? Math.max(0, rect.bottom - top) : 0);
  const right = Number.isFinite(rect?.right) ? rect.right : left + width;
  const bottom = Number.isFinite(rect?.bottom) ? rect.bottom : top + height;
  return { x: left, y: top, left, top, right, bottom, width, height };
}

function resolveAxisSpan(startVal, endVal, sizeVal, padStart, padEnd) {
  if (startVal !== null && endVal !== null) {
    return [padStart + startVal, padEnd - endVal];
  }
  if (startVal !== null && sizeVal !== null) {
    return [padStart + startVal, padStart + startVal + sizeVal];
  }
  if (endVal !== null && sizeVal !== null) {
    const edgeEnd = padEnd - endVal;
    return [edgeEnd - sizeVal, edgeEnd];
  }
  if (sizeVal !== null) {
    return [padStart, padStart + sizeVal];
  }
  if (startVal !== null) {
    return [padStart + startVal, padEnd];
  }
  if (endVal !== null) {
    return [padStart, padEnd - endVal];
  }
  return [padStart, padEnd];
}

function resolvePseudoBox(paddingBox, pseudoStyle) {
  if (!pseudoStyle || typeof pseudoStyle !== 'object') return null;

  if (typeof pseudoStyle.content === 'string') {
    const normalizedContent = pseudoStyle.content.trim().toLowerCase();
    if (INACTIVE_PSEUDO_CONTENT.has(normalizedContent)) return null;
  }

  if (pseudoStyle.pointerEvents === 'none') return null;
  if (pseudoStyle.position && pseudoStyle.position !== 'absolute' && pseudoStyle.position !== 'fixed') {
    return null;
  }

  const top = parsePxValue(pseudoStyle.top);
  const bottom = parsePxValue(pseudoStyle.bottom);
  const left = parsePxValue(pseudoStyle.left);
  const right = parsePxValue(pseudoStyle.right);
  const width = parsePxValue(pseudoStyle.width);
  const height = parsePxValue(pseudoStyle.height);

  const hasInsets = top !== null || bottom !== null || left !== null || right !== null;
  const hasExplicitSize = (width !== null && width > 0) || (height !== null && height > 0);
  if (!hasInsets && !hasExplicitSize) return null;

  const [pLeft, pRight] = resolveAxisSpan(left, right, width, paddingBox.left, paddingBox.right);
  const [pTop, pBottom] = resolveAxisSpan(top, bottom, height, paddingBox.top, paddingBox.bottom);
  if (pRight <= pLeft && pBottom <= pTop) return null;

  return normalizeBox({
    left: pLeft,
    top: pTop,
    right: pRight,
    bottom: pBottom,
    width: Math.max(0, pRight - pLeft),
    height: Math.max(0, pBottom - pTop),
  });
}

/**
 * Computes effective clickable bounding box of an element including any active
 * ::before / ::after pseudo-element hit-target expanders (whose CSS inset values
 * anchor to the element's padding-box, after subtracting border widths).
 */
export function computeEffectiveHitBox(rect, styles = {}, pseudoAfterStyle = null, pseudoBeforeStyle = null) {
  const borderBox = normalizeBox(rect);
  const borderLeft = Math.max(0, parsePxValue(styles?.borderLeftWidth, 0));
  const borderRight = Math.max(0, parsePxValue(styles?.borderRightWidth, 0));
  const borderTop = Math.max(0, parsePxValue(styles?.borderTopWidth, 0));
  const borderBottom = Math.max(0, parsePxValue(styles?.borderBottomWidth, 0));

  const paddingBox = normalizeBox({
    left: borderBox.left + borderLeft,
    top: borderBox.top + borderTop,
    right: borderBox.right - borderRight,
    bottom: borderBox.bottom - borderBottom,
    width: Math.max(0, borderBox.width - borderLeft - borderRight),
    height: Math.max(0, borderBox.height - borderTop - borderBottom),
  });

  const boxes = [borderBox];
  const afterBox = resolvePseudoBox(paddingBox, pseudoAfterStyle);
  if (afterBox) boxes.push(afterBox);
  const beforeBox = resolvePseudoBox(paddingBox, pseudoBeforeStyle);
  if (beforeBox) boxes.push(beforeBox);

  const effLeft = Math.min(...boxes.map((b) => b.left));
  const effTop = Math.min(...boxes.map((b) => b.top));
  const effRight = Math.max(...boxes.map((b) => b.right));
  const effBottom = Math.max(...boxes.map((b) => b.bottom));

  return {
    ...normalizeBox({
      left: effLeft,
      top: effTop,
      right: effRight,
      bottom: effBottom,
      width: Math.max(0, effRight - effLeft),
      height: Math.max(0, effBottom - effTop),
    }),
    borderBox,
    paddingBox,
    afterBox,
    beforeBox,
  };
}

function describeElement(el) {
  if (!el || typeof el !== 'object') return '(null)';
  const tag = String(el.tagName || el.nodeName || 'element').toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = typeof el.className === 'string' && el.className.trim()
    ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
    : '';
  return `<${tag}${id}${cls}>`;
}

/**
 * Evaluates physical clickability without throwing. Safe in both browser DOM
 * and pure Node unit tests with mocked geometry.
 */
export function evaluatePhysicalClickability(input = {}) {
  const {
    element = null,
    rect = null,
    box = null,
    styles = {},
    afterStyle = null,
    beforeStyle = null,
    viewport = {},
    viewportWidth: optWidth = undefined,
    viewportHeight: optHeight = undefined,
    minTarget = 44,
    doc = null,
    hitElement = undefined,
    isHitOwned: explicitOwnership = undefined,
    hitDescription = null,
    skipHitTest = false,
  } = input;

  const vw = optWidth ?? viewport.width ?? 375;
  const vh = optHeight ?? viewport.height ?? 812;
  const rawRect = rect || box || element?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const rawBox = normalizeBox(rawRect);
  const effectiveBox = computeEffectiveHitBox(rawBox, styles, afterStyle, beforeStyle);

  const cx = Math.round((effectiveBox.x + effectiveBox.width / 2) * 100) / 100;
  const cy = Math.round((effectiveBox.y + effectiveBox.height / 2) * 100) / 100;
  const reasons = [];

  if (rawBox.width <= 0 || rawBox.height <= 0) {
    reasons.push(`element has zero layout dimensions (${rawBox.width}x${rawBox.height}px)`);
  }

  if (effectiveBox.width < minTarget || effectiveBox.height < minTarget) {
    reasons.push(
      `effective hit target ${effectiveBox.width}x${effectiveBox.height}px is below ${minTarget}x${minTarget}px minimum`,
    );
  }

  if (rawBox.y < 0 || rawBox.y + rawBox.height > vh) {
    reasons.push(
      `element vertical bounds [${rawBox.y}, ${rawBox.y + rawBox.height}] exceed mobile viewport height ${vh}px`,
    );
  }

  if (rawBox.x < 0 || rawBox.x + rawBox.width > vw) {
    reasons.push(
      `element horizontal bounds [${rawBox.x}, ${rawBox.x + rawBox.width}] exceed viewport width ${vw}px`,
    );
  }

  let resolvedHit = hitElement;
  if (resolvedHit === undefined && explicitOwnership === undefined && !skipHitTest) {
    if (doc && typeof doc.elementFromPoint === 'function') {
      resolvedHit = doc.elementFromPoint(cx, cy);
    } else {
      reasons.push('missing document.elementFromPoint(cx, cy) result - cannot confirm element is unoccluded');
    }
  }

  if (!skipHitTest) {
    if (explicitOwnership !== undefined) {
      if (!explicitOwnership) {
        reasons.push(
          `center (${cx}, ${cy}) is physically occluded by ${hitDescription || 'another layer'} instead of target element`,
        );
      }
    } else if (resolvedHit !== undefined) {
      if (!resolvedHit) {
        reasons.push(`document.elementFromPoint(${cx}, ${cy}) returned null (outside viewport or obscured)`);
      } else if (element) {
        const owned = resolvedHit === element || (typeof element.contains === 'function' && element.contains(resolvedHit));
        if (!owned) {
          reasons.push(
            `center (${cx}, ${cy}) hit ${describeElement(resolvedHit)} instead of ${describeElement(element)} or its descendants`,
          );
        }
      }
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    reason: reasons[0] || null,
    box: rawBox,
    effectiveBox: {
      x: effectiveBox.x,
      y: effectiveBox.y,
      width: effectiveBox.width,
      height: effectiveBox.height,
    },
    paddingBox: effectiveBox.paddingBox,
    afterBox: effectiveBox.afterBox,
    beforeBox: effectiveBox.beforeBox,
    center: { x: cx, y: cy },
    viewport: { width: vw, height: vh },
    hitDescription: hitDescription || (resolvedHit ? describeElement(resolvedHit) : null),
  };
}

/**
 * Synchronously asserts that a rendered DOM element satisfies physical size,
 * mobile viewport containment, and unoccluded hit-testing via elementFromPoint.
 */
export function assertPhysicallyClickable(element, options = {}) {
  if (!element || typeof element.getBoundingClientRect !== 'function') {
    throw new Error('assertPhysicallyClickable requires a DOM element with getBoundingClientRect().');
  }

  const doc = options.doc || element.ownerDocument || globalThis.document || null;
  const win = options.win || doc?.defaultView || globalThis.window || null;
  const pickStyle = (style) => (style
    ? {
      content: style.content,
      position: style.position,
      pointerEvents: style.pointerEvents,
      borderLeftWidth: style.borderLeftWidth,
      borderRightWidth: style.borderRightWidth,
      borderTopWidth: style.borderTopWidth,
      borderBottomWidth: style.borderBottomWidth,
      top: style.top,
      right: style.right,
      bottom: style.bottom,
      left: style.left,
      width: style.width,
      height: style.height,
    }
    : null);

  const result = evaluatePhysicalClickability({
    element,
    rect: element.getBoundingClientRect(),
    styles: options.styles ?? pickStyle(win?.getComputedStyle?.(element)),
    afterStyle: options.afterStyle ?? pickStyle(win?.getComputedStyle?.(element, '::after')),
    beforeStyle: options.beforeStyle ?? pickStyle(win?.getComputedStyle?.(element, '::before')),
    viewport: {
      width: options.viewportWidth ?? win?.innerWidth ?? 375,
      height: options.viewportHeight ?? win?.innerHeight ?? 812,
    },
    minTarget: options.minTarget ?? 44,
    doc,
    hitElement: options.hitElement,
  });

  if (!result.ok) {
    const label = options.label || describeElement(element);
    throw new Error(`Physical hit-test failed for ${label}: ${result.reasons.join('; ')}`);
  }
  return result;
}

/**
 * Async wrapper for Playwright / browser locators supporting .evaluate().
 * Reads raw DOM geometry & hit ownership without duplicating calculation math.
 */
export async function assertLocatorPhysicallyClickable(locator, options = {}) {
  if (!locator || typeof locator.evaluate !== 'function') {
    throw new Error('assertLocatorPhysicallyClickable requires a Playwright-compatible locator with .evaluate().');
  }

  const snapshot = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const pick = (s) => (s
      ? {
        content: s.content,
        position: s.position,
        pointerEvents: s.pointerEvents,
        borderLeftWidth: s.borderLeftWidth,
        borderRightWidth: s.borderRightWidth,
        borderTopWidth: s.borderTopWidth,
        borderBottomWidth: s.borderBottomWidth,
        top: s.top,
        right: s.right,
        bottom: s.bottom,
        left: s.left,
        width: s.width,
        height: s.height,
      }
      : null);
    return {
      rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
      styles: pick(window.getComputedStyle(el)),
      afterStyle: pick(window.getComputedStyle(el, '::after')),
      beforeStyle: pick(window.getComputedStyle(el, '::before')),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      label: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
    };
  });

  const geometryCheck = evaluatePhysicalClickability({
    ...snapshot,
    viewportWidth: options.viewportWidth ?? snapshot.viewport.width,
    viewportHeight: options.viewportHeight ?? snapshot.viewport.height,
    minTarget: options.minTarget ?? 44,
    skipHitTest: true,
  });

  const hitProbe = await locator.evaluate((el, point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    const owned = Boolean(hit && (hit === el || el.contains(hit)));
    const tag = hit
      ? `<${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}>`
      : null;
    return { owned, tag };
  }, geometryCheck.center);

  const fullResult = evaluatePhysicalClickability({
    ...snapshot,
    viewportWidth: options.viewportWidth ?? snapshot.viewport.width,
    viewportHeight: options.viewportHeight ?? snapshot.viewport.height,
    minTarget: options.minTarget ?? 44,
    isHitOwned: hitProbe.owned,
    hitDescription: hitProbe.tag,
  });

  if (!fullResult.ok) {
    const label = options.label || `<${snapshot.label}>`;
    throw new Error(`Physical hit-test failed for ${label}: ${fullResult.reasons.join('; ')}`);
  }
  return fullResult;
}
