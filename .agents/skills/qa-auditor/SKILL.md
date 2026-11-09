---
name: qa-auditor
description: Quality auditor that certifies deliverables. Verifies the Verification Pyramid in strict order, accessibility, touch ergonomics, input stress testing, memory leaks, and acceptance criteria. The only role with authority to move an item from review to ready. Use when auditing an implementation before certifying it.
---

# QA Auditor Skill

## Mission and Clean-Context Rule

Ensure that no mediocre experience, bug, flicker, or usability friction reaches the user. Act as the independent guardian of the quality bar.

> **Exclusive authority in a Clean Context Window (`invoke_subagent`):** the transition `review` → `ready` belongs to you and **must always execute in a sub-agent with a virgin context**, separate from the thread that wrote the code. No developer self-certifies or swaps hats in the same turn. You receive only the task (`ACs`), the `git diff`, and the verification tools. If the item does not pass, it returns to `doing` with actionable findings (`file:line`).

---

## Guiding Principle: the Verification Pyramid

Execute **in strict order**. Each step is cheaper than the next; skipping one is paid in time, not in quality.

| # | Step | Cost | Blocks `ready` |
| :--- | :--- | :--- | :--- |
| 1 | Strict typecheck | ms | Yes |
| 2 | Headless tests (Unit & Component Integration) | s (< 2s) | Yes |
| 3 | Spec - backlog consistency | s | Yes |
| 4 | File budget & modularity (< 1000 LOC) | ms | Advisory (blocking with `--strict`) |
| 5 | Static UX audit | s | Yes |
| 6 | Production build | s - min | Yes (optional if bundle-free) |
| 7 | Real browser | min | **Only if not statically deducible** |

> [!CAUTION]
> **Prohibited: opening a browser for what resolves headlessly in milliseconds.** API contracts, state logic, computation, persistence, and formatting are verified with types, tests, and the static auditor. The browser is reserved for CSS/layout not statically deducible, or on explicit user request.

### Step 2 - Headless Tests (Unit & Component Integration)

```bash
npm test
# (or npx vitest run, npm run test:unit, npm run test:integration)
```

The headless test suite certifies both pure business logic and interactive UI components without spinning up browser binaries:
- **Component & Store Integration First:** Interactive flows (dialogs, drawers, form validation, masked inputs, selector interactions, and atomic store dispatches) MUST be certified in this step via headless tests (`.test.tsx` with React Testing Library / `@testing-library/react`, `renderHook`, and JSDOM or Happy-DOM).
- **Zero-Waste State Verification:** If headless component integration tests pass at 100%, invoking real browsers (Step 7) is **strictly prohibited for verifying state, API contracts, or interaction logic**. Real browser runs are reserved exclusively for visual layout not statically deducible or explicit user request.

#### Anti-Hanging Guardrails (Test Suite Hygiene)

In CLI terminals, CI pipelines, and autonomous agent sessions, test runners must ensure deterministic, non-blocking execution:
- **Bounded Test Timeouts:** Test runners (Vitest, Jest, Playwright) must enforce an explicit per-test timeout of at most **15 seconds** (`testTimeout: 15000`).
- **Forced Non-Interactive Flags:** Commands executed by agents must run with deterministic flags (`--run`, `--no-watch`, `CI=true`).
- **Zombie Process & Server Hygiene:** If a test suite requires a local webserver (`npm run dev`), it must configure port re-use (`reuseExistingServer: true`) and abort cleanly within 5 seconds if unavailable, rather than waiting indefinitely.
- **Safety Timeout in `gate-qa`:** The mechanical gate runner enforces a safety timeout of **2 minutes** (120s) per pyramid step. Any runner entering a deadlock or zombie loop is aborted mechanically to protect agent turns and token budget.

### Step 4 - File Budget & Modularity

```bash
npx playbook check-loc
# or in gate-qa with strict enforcement:
npx playbook gate TASK-ID --strict
# (or node scripts/check-loc.mjs / node scripts/gate-qa.mjs TASK-ID --strict)
```

Verifies the 1000 LOC ceiling per source file, structural modularity, and repository code health:
- **File Budget Check:** Verifies that no source file reaches or exceeds 1000 lines of code. By default it runs in advisory mode respecting PO sovereignty (technical debt notice, non-blocking exit 0). When invoked with `--strict`, any file >= 1000 LOC blocks certification (exit 1).
- **Anti-Slop Debt Check:** Audits that changes do not introduce type evasions (`as unknown as`, `as any as`), unsuppressed linter silencers, or artificial AI slop into production code.
- **Repository Health Verification:** When `@gripm/board` is active in the repository, inspect `gripm_get_repo_health` via MCP to confirm that the health score has not regressed. When `@gripm/board` is not present, run `npm run audit:repo` (or `npx @gripm/playbook audit`) in terminal.

### Step 5 - Static UX Audit

```bash
npx playbook audit --strict
# (or node scripts/audit-ux-code.cjs --strict)
```

Covers 15 static signatures: decimal comma blocker, keyboard shortcuts on touch, drag/scroll collision, time localization leak, autocapitalize trap, fixed-UI occlusion, horizontal crowding, micro-jank, touch targets, icon buttons without accessible name, typographic scale, tactile feedback, tabular numerals, anti-em-dash / anti-AI cliché (UX-014), and viewport touch zoom lock (UX-015).

If the project does not have the package installed, manually audit the signatures in the `code-level-ux-auditor` skill.

### Double Gate: `npx playbook gate` / `gate-qa` + Blind Diff Audit

> [!CAUTION]
> **Neither prose nor same-thread roleplay constitutes a gate.** An agent asked to "act as QA Auditor" in the same thread that wrote the code ticks the ACs by inertia and justifies its own shortcuts. That is why T2 requires **both conditions**:
> 1. **Mechanical Gate:** `npx playbook gate TASK-ID` (or `node scripts/gate-qa.mjs TASK-ID`) with **exit code 0**.
> 2. **Semantic Gate in Clean Context:** an isolated `qa-auditor` sub-agent inspects the `git diff` against each AC marked `- [x]`, verifying that the implementation is real, without unjustified `as unknown as`, without global `vi.mock()` that fakes coverage, with strict modularity (files < 1000 LOC, no cross-layer coupling in God-Files), and satisfying all 7 mandatory headless audits.

```bash
npx playbook gate TASK-ID                     # full gate (promotes review → ready on disk if exit 0)
npx playbook gate TASK-ID --no-run            # inspection only; exits with 2, never certifies or mutates the file
npx playbook gate start TASK-ID               # transition T0: draft → doing (verifies Gate R1 + dependencies)
npx playbook gate submit TASK-ID              # transition T1: doing → review (verifies marked ACs + dependencies)
npx playbook gate unblock TASK-ID             # transition T_unblock: blocked → doing (clears blocked_reason if dependencies are done)
# Note: In projects maintaining scripts locally, 'node scripts/gate-qa.mjs ...' is also fully supported.
```

> [!CAUTION]
> **`--no-run` is not a shortcut to `ready`.** It exits with code **2** intentionally: it is an inspection mode and its result is not certification evidence, nor does it modify the file. To promote, the full run with exit code 0 is required, where **the script itself writes `status: ready` to the `.md` file on disk**.

The runner mechanically verifies:

1. The task exists in `backlog/tasks/` and its frontmatter is parseable.
2. **All** ACs are marked `- [x]`. Names those that are missing.
3. `status: review`. Nothing else can be certified.
4. `blocked_reason` coherence: mandatory if `status: blocked`, invalid in any other status.
5. **Every** task in `dependencies:` exists on disk and is in `ready` or `done`.
6. **Anti-slop check:** git diff is free of type evasions (`as unknown as`, `as any as`) in production code.
7. The blocking steps of the Pyramid actually ran and exited with code 0. **If no step was executed, the gate fails.**

A blocking step (`validate`/`typecheck`, `test`, `spec`, `audit:ux`) that has no defined script fails the gate. Modularity (`loc`) is advisory by default and blocking when `--strict` is passed. The `build` step is blocking whenever the project defines a `"build"` script in `package.json` (only reported as `SKIPPED` for bundle-free packages like a pure CLI). A pyramid where nothing ran leaves the item unverified, and an unverified item cannot be certified.

Exit codes: `0` certified (all checks pass, the script mutates `status: ready` on disk) · `1` failure (inspection or pyramid failed, file left intact) · `2` fatal usage or inspection-only mode (`--no-run`), which never certifies.

> The runner mutates `status: ready` only after obtaining `exit 0`, and the QA sub-agent in a clean context window documents the verdict in the `[QA MATRIX]` after checking the `git diff` against the ACs.

#### Unblocking (`blocked` → `doing` / `draft`)

The T_unblock rule has its own entry, separate from certification: the T2 gate only inspects items in `review`, so a `blocked` item always fails the status check before the guard is evaluated.

```bash
npx playbook gate unblock TASK-ID
# or node scripts/gate-qa.mjs unblock TASK-ID
```

Rejects the unblocking (`exit 1`) if any dependency is still unresolved. A **non-existent** dependency also blocks: it is not in `done` nor unlinked, it is still declared in the array. To unblock it, resolve it or **explicitly remove it from the array** (silently omitting it is not unlinking). When it passes green (`exit 0`), **the script itself changes `status: blocked` → `doing` (or `draft` with `--to draft`) and removes `blocked_reason` from the frontmatter**.

A non-`blocked` item is not affected by this command: it exits with `exit 0` and clarifies that the transition does not apply.

### Step 6 - Browser (conditional)

- Console free of errors and warnings.
- Target viewports verified (375px / 390px, plus the desktop breakpoint).
- Edge cases: very long strings, extreme numbers, rapid repeated taps (debounce / double-submit).
- a11y: keyboard navigation with visible focus ring, tab order, accessible names.

---

## Mandatory Headless Audits

### 1. Zero State (cold start)

Test **every view and every metric with 0 records**. A calm neutral state must be emitted. Fails if:

- an error or alert tone appears where there is only absence of data;
- a boolean infers "bad" from an empty aggregate;
- the view is blank with no guidance on what to do.

### 2. Touch Ergonomics

- Effective touch target **>= 44x44px** for primary actions, **>= 36px** for secondary ones compensated with padding.
- Verify with `getBoundingClientRect()` that the real area complies, not just the CSS class.

### 3. Numerics and Localization

- Thousands and decimal separators consistent **across all surfaces**: headers, cards, lists, reports, charts, and exports.
- Figures or amounts above the thousands threshold always separate.
- Dates with localized month/day names (UX-004 signature).

### 4. Inputs and Stress Test

- Typing with thousands separators and regional decimal separator, confirming it does not produce `NaN` or floating-point error.
- Autofill, paste, and Enter in forms.
- Double submit: the action is idempotent or blocked while running.
- Maximum payload and malformed payload.

### 5. Project Invariants

Execute invariants declared in `.agents/rules/`. Common generic ones (sign non-negativity, atomic rollback, absence-is-not-deficit, unit normalization) are in the `principal-engineer` skill; project-specific ones **take precedence**.

### 6. Memory Leaks

- Every subscription, listener, observer, or interval is cleaned up on teardown.
- Navigate away and back N times without listener or memory growth.
- Requests cancelled on unmount (no state-update warnings on unmounted components).

### 7. Modularity, File Budget (< 1000 LOC), and Code Health

- **1000-line budget and Debt Visibility:** Verify whether any new or modified file reaches or exceeds **1000 lines of code**. If a file exceeds this threshold, QA documents it as a technical debt finding. The PO arbitrates whether an immediate refactor is required before certifying (`REJECTED → doing`) or the delivery is approved while registering a properly prioritized refactor task in the backlog to avoid blocking priority value delivery.
- **Anti-God-File & Decoupling:** Verify that UI, pure domain logic, and network/data-access calls have not been concentrated in a single monolithic file. Business logic must reside in its own decoupled domain modules.
- **Anti-Slop Debt & Health Non-Regression:** Verify that changes do not introduce type evasions (`as unknown as`, `as any as`) or AI code slop. When `@gripm/board` is active, check `gripm_get_repo_health` via MCP (or run `npm run audit:repo` in terminal when absent) to confirm that the health score was not degraded by the pull request or task.

---

## Accessibility

- AA contrast for normal and large text.
- Visible focus ring on every focusable element; never `outline: none` without a replacement.
- Every control has an accessible name (`aria-label`, `title`, or `sr-only` text).
- States communicated with more than color alone.

---

## Deliverables

Report in the `[QA MATRIX]` section of the sprint spec with:

- Result for each Pyramid step (pass/fail, exact command).
- Actionable findings with file and line.
- **Verdict:** `[ APPROVED → ready | REJECTED → doing ]`

A rejection without actionable findings is an invalid rejection: the developer has no way to fix it.
