---
id: PLAY-076
title: "Purga de sesgos de dogfooding personal y modularizacion de audit-ux en perfiles"
status: draft
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["ux", "audit", "modularity", "epic-2-universal-core"]
dependencies: []
priority: high
type: refactor
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
`code-level-ux-auditor` and `scripts/ux-rules.json` bundle 20 rules into a single flat catalog where universal web/accessibility bugs (like `UX-010` unnamed icon buttons or `UX-015` viewport zoom locks) are mixed with rules specific to mobile bottom-nav shell architectures (`UX-006` `pb-32`, `UX-018`, `UX-019` `BottomNav`, `UX-020`) and editorial preferences (`UX-014` anti-em-dash). External teams adopting the auditor on desktop web apps, design systems, or non-BottomNav layouts face opinionated rules that feel tailored only to the author's personal apps.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Categorize `scripts/ux-rules.json` signatures into explicit profiles (`web-core`, `mobile-shell`, `editorial-hygiene`) while keeping every `UX-001`..`UX-020` ID intact.
  - Allow `.uxaudit.json` and `npx playbook audit --profile <name>` to select profiles (defaulting to `web-core` when mobile stack is not active, or `all` in strict full mode).
  - Review all core `SKILL.md` files to replace project-specific idioms (e.g. LATAM-only defaults, BottomNav assumptions, `gripm` internal conventions) with universal engineering standards.
- **Out-of-Scope:**
  - Deleting or renumbering any existing `UX-001`..`UX-020` rule.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Each rule in `scripts/ux-rules.json` declares a profile category (`web-core`, `mobile-shell`, or `editorial-hygiene`) while preserving all `UX-001`..`UX-020` IDs and severities.
- [ ] #2 `scripts/audit-ux-code.cjs` and `.uxaudit.json` support filtering by profile (`--profile web-core | mobile-shell | editorial-hygiene | all`) without breaking existing consumers.
- [ ] #3 Core `SKILL.md` files are audited and cleaned of personal project biases so examples and rules apply universally across web, backend, CLI, and mobile projects.
- [ ] #4 Unit tests in `tests/audit-ux.test.mjs` verify profile filtering and backward compatibility; `npm run check:all` exits 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `profile` metadata to every signature in `scripts/ux-rules.json` and update `scripts/lib/catalog-validator.mjs`.
2. Add `--profile` CLI flag and `.uxaudit.json` `profiles` config support in `scripts/audit-ux-code.cjs`.
3. Clean personal project biases across core `SKILL.md` files while keeping `validate-repo.mjs` parity intact.
4. Add unit tests in `tests/audit-ux.test.mjs` and run `npm run check:all`.
<!-- SECTION:PLAN:END -->
