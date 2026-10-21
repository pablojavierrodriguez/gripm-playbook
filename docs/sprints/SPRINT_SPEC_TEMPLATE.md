# Sprint Spec & Runbook - [ID / Feature Name]

<!--
  Status vocabulary is owned by .agents/STATE_MACHINE.md. Do not invent states.
  The backlog is NOT a status: every item starts in `draft` (or `ideas` for discovery); zero items exist without a status.
  Allowed values: ideas | draft | blocked | doing | review | ready | done | dismissed
-->

- **Status:** `[ ideas | draft | blocked | doing | review | ready | done | dismissed ]`
- **Blocked Reason:** `[ required and non-empty when status: blocked; omit in other states ]`
- **Dismissed Reason:** `[ required and non-empty when status: dismissed; omit in other states ]`
- **Last transition:** `[ from → to ]` by `[ actor ]` - `[ YYYY-MM-DD ]`
- **Refined:** `[ yes (YYYY-MM-DD) | no - missing: <what> ]`
- **Sprint:** `[ SPRINT-XXX ]`
- **Backlog Item:** `[ ID ]`
- **Date:** YYYY-MM-DD
- **PO Lead:** PM Orchestrator

**Acceptance Criteria**

| # | Criterion | Verification method | Status |
| :--- | :--- | :--- | :--- |
| AC-1 | [measurable criterion] | [test / manual check] | `- [ ]` |
| AC-2 | [measurable criterion] | [test / manual check] | `- [ ]` |

> No item moves to `review` with unchecked ACs. QA certification (`review` → `ready`) requires the full table in green.

**Refinement Gate (R1)** - an item only enters `doing` with an approved refinement:

- [ ] Problem statement from the user's perspective
- [ ] Bounded scope **and** explicit out-of-scope
- [ ] Measurable ACs
- [ ] Priority assigned by the PO
- [ ] Ambiguities resolved and recorded (Structured Refinement Gate completed)
- [ ] Architecture and module boundaries validated (< 1000 LOC per file)

---

## 1. 🔍 [RESEARCH] Benchmarks & Edge Cases - Market Researcher
> Analysis of reference products and proven interaction patterns.

- **References Analyzed:**
- **Prominent Interaction Patterns:**
- **Domain Edge Cases & Risks:**
- **Recommendations for Design & Engineering:**

---

## 2. 🎨 [DESIGN SPEC] Experience & Micro-Interactions - Product Designer
> Visual anatomy, states, motion, and touch ergonomics.

- **Tokens & Visual Hierarchy:**
- **Touch Targets (≥ 44px) & Mobile Ergonomics:**
- **Micro-Interactions & Sensory Feedback:**
- **Interactive States:**
  - *Default:*
  - *Hover:*
  - *Active / Focus:*
  - *Disabled:*
  - *Loading / Skeleton:*
  - *Empty State:*
  - *Error State:*

---

## 3. ⚙️ [TECH ARCHITECTURE] Implementation & Robustness - Principal Engineer
> Modularity, hooks, strict typing, and schema integrity.

- **Architecture & Boundaries (Architecture-First, < 1000 LOC):**
- **Files Created / Modified:**
- **Typing & Validation:**
- **Performance (frame budget, memory leaks):**
- **Verification Pyramid (local, pre-handoff):**
  - [ ] `typecheck` - 0 errors
  - [ ] tests - 0 failures

> When this section is complete the item moves to `status: doing` → `review` (T1).

---

## 4. 🛡️ [QA MATRIX] Certification - QA Auditor
> Audit of the item before certifying it.

**Verification Pyramid - strict order. No step is skipped.**

1. [ ] **Strict typecheck** - 0 errors
2. [ ] **Headless tests** - 0 failures
3. [ ] **Spec ↔ backlog consistency** - ACs, scope, and commit state are coherent
4. [ ] **Production build** - clean

**Static UX audit (headless, no browser):**

- [ ] `node scripts/audit-ux-code.cjs --strict` exits green

**In-browser visual audit - only for what is not statically deducible:**

- [ ] Responsive layout / CSS not deducible by static analysis (target viewport)
- [ ] Browser console free of errors

> [!IMPORTANT]
> `browser_subagent` and DevTools are **prohibited** for logic, state, API contracts, or persistence: that is resolved headlessly in steps 1 - 4. Open them only for CSS/layout issues that static analysis cannot deduce, or on an explicit user request.

**Executable gate - gate runner:**

- [ ] `node scripts/gate-qa.mjs <ID>` exits green (exit code 0 required to certify)

**Findings & Resolved Friction:**

- **Verdict:** `[ APPROVED → ready | REJECTED → doing ]`

> **T2 (`review` → `ready`) belongs exclusively to the QA Auditor.** The developer does not self-certify. Certification requires exit code 0 from the runner. On rejection, record the actionable findings and move the item to `doing` (T3).

---

## 5. 🚀 [RELEASE] Packaging & Deployment - Release Management
> Fill in at release time, not during the sprint.

- **Release Version:** `[ vX.Y.Z ]`
- **Items included (`ready` only):** `[ BACKLOG-ID, ... ]`
- **Value Delivered:**
- **Deploy Target:**
- **Changelog Entry:**

> Releases are assembled **by delivered value**, grouping `ready` items, with or without an active sprint, historical or from the current one. Sprints and releases have no 1:1 coupling.

- [ ] Package deployed to production
- [ ] Items transitioned `ready` → `done` (T4)

> **Fundamental invariant:** no item can be in production without being in `done`.

---

## 6. 🧠 [KNOWLEDGE FEED] System Memory
> Fill in when the sprint or the release closes. Requires an explicit PO command.

- **Rule Added / Updated:** `[ AGENTS.md or .agents/rules/* ]`
- **Skill Updated:** `[ .agents/skills/* ]`
- **ADR Recorded:** `[ path ]`
- **Backlog Items Created from Tech Debt:**
