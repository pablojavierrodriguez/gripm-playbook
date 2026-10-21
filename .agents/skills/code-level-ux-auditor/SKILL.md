---
name: code-level-ux-auditor
description: Audits source code statically for mobile UX anti-patterns, gesture and scroll collisions, fixed-UI occlusion, render jank, micro-ergonomics, and accessibility. Use when reviewing UI code, before a commit, or when the task mentions touch targets, mobile viewport, virtual keyboard, scroll, drag, or static a11y.
---

# Code-Level UX Auditor Skill

## Mission and Philosophy

User experience quality is not a coat of paint: **it is programmed into the code**. The bugs that frustrate users the most (stuck drag, scroll jumps, inputs that reject the comma, content hidden behind the bottom bar, 15 FPS stutter, buttons with no accessible name) carry **unequivocal static signatures** in the source code.

This skill defines the inspection rules and delegates mechanical detection to a declarative rules runner.

---

## ⚙️ Tooling: the rule catalog is the source of truth

Detection is **not** hardcoded in the script. It lives in `scripts/ux-rules.json`, the canonical source of truth shared by this skill and the runner:

```bash
node scripts/audit-ux-code.cjs            # human report
node scripts/audit-ux-code.cjs --strict   # fails on WARNING too
node scripts/audit-ux-code.cjs --format json
node scripts/audit-ux-code.cjs --list-rules
node scripts/audit-ux-code.cjs --rule UX-006
node scripts/audit-ux-code.cjs --update-baseline   # snapshot what was already reviewed
```

- **The engine is stack-agnostic.** Rules that depend on a library declare `requires.deps` and skip themselves when the dependency is not in the project's `package.json`. The engine contains no file or project names.
- **Severities:** `ERROR` (breaks tactile functionality, fails the audit without `--strict`), `WARNING` (degrades, fails with `--strict`), `INFO` (hygiene).
- **Suppression:** `// ux-audit-ignore` disables every rule on that line; `// ux-audit-ignore UX-004` disables only that one. Per-project opt-out lives in `.uxaudit.json` (`disableRules`, `exclude`).
- **Baseline:** `audit-ux-baseline.json` records observations already reviewed, so the auditor can be adopted on a codebase that already has hundreds of findings without silencing the gate or drowning in unrecoverable noise. `node scripts/audit-ux-code.cjs --update-baseline` rewrites the snapshot. **`ERROR` is never absorbed:** a severity that breaks the build is never silenced by a file.

### Anatomy of a unit

The engine segments the file into **JSX elements**, and each element exposes three granularities. Picking the right one is what separates a precise rule from one that floods the report with false positives:

| Field | What it includes | What it is for |
| :--- | :--- | :--- |
| `text` | Only the opening tag and its attributes | `line`, `alsoLine`, `unlessLine` - the signature lives on the element that carries it, and the finding points at that element, not its wrapper |
| `ownContent` | The opening tag, the closing tag, and its own text nodes, **excluding** descendants | `alsoContent` - "is this element the one rendering the value?" |
| `scopeText` | The element **plus** all of its descendants | `needsContent`, `unlessContent`, `unlessVisibleText` - "does this element contain that?" |

Example that separates the last two:

```tsx
<div className="card">
  <span>{format(date, "MMMM yyyy")}</span>
</div>
```

On the `<div>`, `needsContent: ["MMMM"]` matches (the `<span>` is its descendant), but `alsoContent: ["MMMM"]` does **not** - the `MMMM` lives inside the child, not in the div's own content. On the `<span>`, both match.

That distinction is why `UX-004` reports the `<span>` that renders the date rather than the `<div>` wrapping it.

- `unlessVisibleText: true` suppresses the rule when the element renders visible text. No token list can express that, and it is what separates a labelled button from an icon-only one: `<button><span>Save</span></button>` is accessible with no `aria-*` attribute at all.
- `onlyFile` is the counterpart of `unlessFile`: the rule runs **only** when the path contains one of the tokens. Without it, a context-scoped rule (`truncate` inside a dialog) cannot be declared, because a file filter can only turn a rule off, never on.

### Project-specific rules

A project that needs its own signatures **does not fork the engine**. It declares its own catalog in `.uxaudit.json` and its rules run alongside the canonical ones:

```json
{ "src": "src", "rules": "audit-ux.local-rules.json" }
```

> [!CAUTION]
> **`UX-NNN` is reserved** for `scripts/ux-rules.json`. A local catalog using that pattern is rejected with an error. This is what guarantees that a `UX-009` means the same thing in every consumer: when a project read its own `UX-009` as "touch target" while the skill documented something else, the catalog stopped being trustworthy. Pick a different prefix.

For what the declarative catalog cannot reach, import the engine instead of copying it:

```js
const { auditProject } = require('@gripm/playbook/scripts/audit-ux-code.cjs');
const { findings, summary } = auditProject({ root: process.cwd() });
```

Importing the module does **not** run an audit; only executing it as a binary does. `auditProject` returns `{ rulesVersion, srcDir, summary, findings, unreadable, absorbed }` and neither prints nor exits, so the consumer owns presentation.

> [!IMPORTANT]
> **Maintenance rule:** if you add a new signature, its `id` must exist on **both** sides (`ux-rules.json` and this table) with the same title and severity. `UX-001..UX-008` are historical IDs: **never renumber them**. New signatures are added starting from `UX-009`.

---

## 📋 Canonical signature catalog

### 1. [UX-001] · ERROR · Regional decimal comma blocker (input[type=number])
- **Signature:** `<input type="number">` used to capture decimal numeric values.
- **Impact:** On LATAM mobile keyboards the numeric pad often shows only `,` and hides `.`, while the HTML5 `type="number"` standard rejects the comma in WebKit/Blink: empty value or silent error.
- **Fix:** `inputMode="decimal"` with bidirectional locale-aware format/parse helpers.

### 2. [UX-002] · INFO · Physical keyboard shortcuts leaking into touch layouts
- **Signature:** `<kbd>` chips, the `⌘` glyph, or `Ctrl+` labels without responsive hiding.
- **Impact:** On a smartphone there is no physical keyboard and no Command key; these elements pollute headers and mobile action bars.
- **Fix:** wrap in `hidden sm:inline-flex` or gate with `useIsMobile()`.

### 3. [UX-003] · WARNING · Drag gesture colliding with a scroll container
- **Signature:** `<Reorder.Group>` or `drag="y"` inside an `overflow-y-auto` container without compensating scroll.
- **Impact:** The browser interprets vertical movement as native scroll and fires `pointercancel`, freezing the drag halfway. Previous scrolling also desynchronizes coordinates, so the items jump.
- **Fix:** native Pointer Events with `setPointerCapture`, GPU transforms, parent-scroll detection, and edge auto-scroll. Always keep accessible up/down controls.
- **Gating:** requires `framer-motion` / `motion`.

### 4. [UX-004] · WARNING · Temporal localisation leak (month/day names without locale)
- **Signature:** `format(date, "MMMM yyyy")` or `format(date, "EEEE")` with no locale argument.
- **Impact:** Mixed UI ("January 2026", "Monday") inside an otherwise localised product.
- **Fix:** import the locale and pass it: `format(date, 'MMMM yyyy', { locale: activeLocale })`.
- **Gating:** requires `date-fns`.

### 5. [UX-005] · ERROR · Autocapitalise / autocorrect trap on identity inputs
- **Signature:** `<input type="email">` without `autoCapitalize="none"` or value normalisation.
- **Impact:** iOS/Android keyboards force an initial capital or append a trailing space after autofill, causing the recurring invalid-credentials error.
- **Fix:** `inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}` plus normalising with `.trim().toLowerCase()`.

### 6. [UX-006] · WARNING · Fixed bottom UI occluding scrollable content
- **Signature:** scrolling views with `pb-16` / `pb-20` / `pb-24` while a fixed bottom bar or FAB is present, instead of `pb-32` + `safe-area-inset-bottom`.
- **Impact:** The last rows of the list are physically covered and unreachable.
- **Fix:** `pb-32` (or a CSS variable derived from the bar height) plus `env(safe-area-inset-bottom)` on the scroll container.

### 7. [UX-007] · INFO · Horizontal crowding on mobile cards (< 640px)
- **Signature:** a `flex ... justify-between` row packing 3 or more complex nodes (icon + label + status + badge + value) with no `truncate` and no wrap.
- **Impact:** Long titles overlap or push the value outside a 375px viewport.
- **Fix:** two-level invariant - row 1 identity and value, row 2 context/chips. `min-w-0` on child columns and secondary actions collapsed into a menu.

### 8. [UX-008] · WARNING · Micro-Jank: synchronous I/O or heavy compute per frame
- **Signature:** writes to `localStorage`/`sessionStorage`, `JSON.stringify`, or `fetch()` inside `onScroll`, `onPointerMove`, `onTouchMove`, `onDrag`, `onWheel`, or `requestAnimationFrame` handlers.
- **Impact:** Frame rate drops from 60 to under 15 FPS, with perceptible lag during touch interaction.
- **Fix:** keep gesture state in memory and persist with debounce on release.
- **Note:** heuristic detection; review every finding manually.

### 9. [UX-009] · WARNING · Sub-44px touch target
- **Signature:** an interactive element with an explicit size under 36px (`h-5..h-8`, `w-5..w-8`, `size-6..size-8`) with no padding, `hitSlop`, or compensating `min-*`.
- **Impact:** Below ~36px the target falls short of the 44×44px accessibility minimum and causes mis-taps.
- **Fix:** `min-h-[44px] min-w-[44px]`, padding, or `hitSlop` of at least 8px per axis.

### 10. [UX-010] · WARNING · Icon-only button without an accessible name
- **Signature:** a button rendering only an icon, with no `aria-label`, `title`, or visually hidden text.
- **Impact:** The screen reader announces an unnamed button; the control is unusable.
- **Fix:** `aria-label` (preferred) or an `sr-only` span.

### 11. [UX-011] · INFO · Arbitrary font size outside the canonical type scale
- **Signature:** `text-[Npx]` with a value outside the design system scale.
- **Impact:** Typographic drift - two components render the same semantic size at different values.
- **Fix:** use the canonical scale (`text-xs`, `text-sm`, `text-base`, `text-lg`) or promote the value to a documented token.

### 12. [UX-012] · INFO · Clickable element without tactile feedback
- **Signature:** an element with `onClick` and `cursor-pointer` but no `active`/`hover` state transition.
- **Impact:** Touch has no hover, so the user gets no confirmation that the tap registered.
- **Fix:** add an active state (`active:scale-[0.98]`, `active:bg-secondary`), ideally with `transition`.

### 13. [UX-013] · INFO · Numeric value without tabular numerals
- **Signature:** figures or metrics rendered by a formatter (`toLocaleString`, `Intl.NumberFormat`, numeric formatter) without `tabular-nums` or a data monospaced face.
- **Impact:** Proportional-width digits cause horizontal micro-jumps when the value changes.
- **Fix:** apply `tabular-nums` (or the project's monospaced token) to every numeric column.

### 14. [UX-014] · WARNING · Anti-em-dash / anti-AI cliché in UI or metadata
- **Signature:** An em-dash (`—`) or en-dash (`–`) in UI text, titles, options, or user-facing metadata instead of the standard hyphen (` - `).
- **Impact:** An artificial AI cliché that degrades product craftsmanship, creates typographic inconsistency, and violates the global standard-hyphen directive in AGENTS.md.
- **Fix:** Replace the em-dash (`—`) or en-dash (`–`) with a standard hyphen surrounded by spaces (` - `).

### 15. [UX-015] · WARNING · Viewport touch zoom lock
- **Signature:** `<meta name="viewport">` or viewport configuration with `maximum-scale=1`, `user-scalable=no`, or `user-scalable=0`.
- **Impact:** Blocks the pinch-to-zoom gesture on mobile devices, degrading accessibility for users with low vision and violating WCAG 1.4.4.
- **Fix:** Remove `maximum-scale=1` and `user-scalable=no` (or `user-scalable=0`) from the viewport meta to allow touch scaling.

---

## ✅ Pre-merge acceptance checklist

- [ ] Do text/email inputs have `autoCapitalize` and sanitisation?
- [ ] Do numeric inputs use `inputMode="decimal"` and locale-aware parsing?
- [ ] Does the scrollable container have enough clearance against fixed bottom UI (`pb-32` + safe area)?
- [ ] Do interactive elements have an effective 44×44px target?
- [ ] If there is drag, does it run with `setPointerCapture` and GPU acceleration?
- [ ] Do dates with month/day names carry an explicit locale?
- [ ] Do figures and numeric columns use `tabular-nums`?
- [ ] Does every icon-only button have an accessible name?
- [ ] Do UI text, titles, and metadata use the standard hyphen (` - `) and avoid em-dash (`—`) or en-dash (`–`)?
- [ ] Does the mobile viewport allow pinch zoom without locking it (no `maximum-scale=1` nor `user-scalable=no`)?
- [ ] Does the manual review catch decorative overload (background gradients and orbs, stacked `backdrop-blur` across several surfaces, uniformly large shadows) that degrades text contrast or flattens visual hierarchy? Look for the cumulative effect on text and surface edges, not the isolated technique: the vice appears through repetition, and a technique justified on one plane becomes noise across three.
- [ ] Does `node scripts/audit-ux-code.cjs --strict` exit green?

> [!NOTE]
> Decorative overload **has no mechanical signature**: the same `backdrop-blur` is correct in one sheet and slop in five. It is a manual-review item, not a runner finding. If it ever becomes declarable, its signature must be added to `scripts/ux-rules.json` first and only then documented here.
