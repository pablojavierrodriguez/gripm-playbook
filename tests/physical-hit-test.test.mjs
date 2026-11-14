import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveHitBox,
  evaluatePhysicalClickability,
  assertPhysicallyClickable,
  assertLocatorPhysicallyClickable,
} from '../scripts/lib/physical-hit-test.mjs';

function makeMockElement({ tagName = 'BUTTON', id = '', className = '', rect, contains = null } = {}) {
  return {
    tagName,
    id,
    className,
    getBoundingClientRect: () => rect,
    contains: (other) => {
      if (typeof contains === 'function') return contains(other);
      return false;
    },
  };
}

describe('Physical hit-testing helper (PLAY-071)', () => {
  test('computeEffectiveHitBox accurately applies CSS padding-box border subtraction for ::after expanders', () => {
    // 24px (h-6) x 44px toggle with border-2 (2px all around) -> 20px height padding-box
    const rect = { x: 16, y: 120, left: 16, top: 120, right: 60, bottom: 144, width: 44, height: 24 };
    const styles = {
      borderLeftWidth: '2px',
      borderRightWidth: '2px',
      borderTopWidth: '2px',
      borderBottomWidth: '2px',
    };

    // after:-inset-y-2.5 (-10px) -> 20 + 20 = 40px (below 44px threshold!)
    const insufficient = computeEffectiveHitBox(rect, styles, {
      content: '""',
      position: 'absolute',
      top: '-10px',
      bottom: '-10px',
      left: '-2px',
      right: '-2px',
    });
    assert.equal(insufficient.paddingBox.height, 20);
    assert.equal(insufficient.height, 40);
    assert.ok(insufficient.height < 44);

    // after:-inset-y-3 (-12px) -> 20 + 24 = 44px (meets 44px threshold!)
    const sufficient = computeEffectiveHitBox(rect, styles, {
      content: '""',
      position: 'absolute',
      top: '-12px',
      bottom: '-12px',
      left: '-2px',
      right: '-2px',
    });
    assert.equal(sufficient.height, 44);
    assert.equal(sufficient.width, 44);
  });

  test('ignores inactive or pointer-events:none pseudo-elements when computing effective box', () => {
    const rect = { left: 10, top: 100, right: 42, bottom: 132, width: 32, height: 32 };
    const styles = {};

    const inactive = computeEffectiveHitBox(rect, styles, {
      content: 'none',
      position: 'absolute',
      top: '-12px',
      bottom: '-12px',
      left: '-12px',
      right: '-12px',
    });
    assert.equal(inactive.height, 32);

    const nonInteractive = computeEffectiveHitBox(rect, styles, {
      content: '""',
      position: 'absolute',
      pointerEvents: 'none',
      top: '-12px',
      bottom: '-12px',
      left: '-12px',
      right: '-12px',
    });
    assert.equal(nonInteractive.height, 32);
  });

  test('assertPhysicallyClickable accepts 44x44+ target owned directly or via descendant', () => {
    const childIcon = { tagName: 'SVG', id: '', className: 'icon' };
    const button = makeMockElement({
      tagName: 'BUTTON',
      id: 'pay-cta',
      rect: { x: 20, y: 680, left: 20, top: 680, right: 355, bottom: 728, width: 335, height: 48 },
      contains: (node) => node === childIcon,
    });

    const directHit = assertPhysicallyClickable(button, {
      doc: { elementFromPoint: () => button },
      styles: {},
    });
    assert.equal(directHit.ok, true);

    const descendantHit = assertPhysicallyClickable(button, {
      doc: { elementFromPoint: () => childIcon },
      styles: {},
    });
    assert.equal(descendantHit.ok, true);
  });

  test('assertPhysicallyClickable rejects element occluded by BottomNav or overlay at center', () => {
    const bottomNav = makeMockElement({ tagName: 'NAV', id: 'bottom-nav', className: 'fixed bottom-0 z-40' });
    const button = makeMockElement({
      tagName: 'BUTTON',
      id: 'save-btn',
      rect: { x: 16, y: 740, left: 16, top: 740, right: 359, bottom: 788, width: 343, height: 48 },
    });

    assert.throws(
      () => assertPhysicallyClickable(button, { doc: { elementFromPoint: () => bottomNav }, styles: {} }),
      /hit <nav#bottom-nav\.fixed\.bottom-0>/,
    );
  });

  test('rejects ancestor mask wrapping target when elementFromPoint returns ancestor', () => {
    const overlayMask = makeMockElement({ tagName: 'DIV', id: 'trap-mask', className: 'backdrop' });
    const button = makeMockElement({
      tagName: 'BUTTON',
      rect: { x: 16, y: 200, left: 16, top: 200, right: 200, bottom: 248, width: 184, height: 48 },
    });
    overlayMask.contains = (node) => node === button;

    const res = evaluatePhysicalClickability({
      element: button,
      doc: { elementFromPoint: () => overlayMask },
      styles: {},
    });
    assert.equal(res.ok, false);
    assert.match(res.reason, /hit <div#trap-mask\.backdrop> instead of <button>/);
  });

  test('rejects elements protruding beyond 375x812 viewport or smaller than 44x44px', () => {
    const offscreenY = makeMockElement({
      tagName: 'BUTTON',
      rect: { x: 20, y: 780, left: 20, top: 780, right: 355, bottom: 828, width: 335, height: 48 },
    });
    const resY = evaluatePhysicalClickability({
      element: offscreenY,
      doc: { elementFromPoint: () => offscreenY },
      styles: {},
    });
    assert.equal(resY.ok, false);
    assert.match(resY.reason, /exceed mobile viewport height 812px/);

    const switchFail = makeMockElement({
      tagName: 'BUTTON',
      rect: { x: 300, y: 120, left: 300, top: 120, right: 344, bottom: 144, width: 44, height: 24 },
    });
    const resSwitch = evaluatePhysicalClickability({
      element: switchFail,
      styles: { borderTopWidth: '2px', borderBottomWidth: '2px', borderLeftWidth: '2px', borderRightWidth: '2px' },
      afterStyle: { content: '""', position: 'absolute', top: '-10px', bottom: '-10px', left: '-2px', right: '-2px' },
      doc: { elementFromPoint: () => switchFail },
    });
    assert.equal(resSwitch.ok, false);
    assert.match(resSwitch.reason, /44x40px is below 44x44px minimum/);
  });

  test('assertLocatorPhysicallyClickable evaluates Playwright-style locators using single-source math', async () => {
    const fakeButtonNode = {
      tagName: 'BUTTON',
      id: 'cta',
      className: 'primary',
      getBoundingClientRect: () => ({ left: 20, top: 300, right: 355, bottom: 348, width: 335, height: 48 }),
      contains: () => false,
    };
    const occludingBanner = { tagName: 'DIV', id: 'promo-banner' };

    function makeLocator(hitTarget) {
      return {
        async evaluate(fn, arg) {
          const prevWindow = globalThis.window;
          const prevDoc = globalThis.document;
          globalThis.window = {
            innerWidth: 375,
            innerHeight: 812,
            getComputedStyle: (_el, pseudo) => (pseudo ? { content: 'none' } : {}),
          };
          globalThis.document = {
            elementFromPoint: () => hitTarget,
          };
          try {
            return fn(fakeButtonNode, arg);
          } finally {
            globalThis.window = prevWindow;
            globalThis.document = prevDoc;
          }
        },
      };
    }

    const okRes = await assertLocatorPhysicallyClickable(makeLocator(fakeButtonNode));
    assert.equal(okRes.ok, true);
    assert.deepEqual(okRes.center, { x: 187.5, y: 324 });

    await assert.rejects(
      () => assertLocatorPhysicallyClickable(makeLocator(occludingBanner)),
      /physically occluded by <div#promo-banner>/,
    );
  });
});
