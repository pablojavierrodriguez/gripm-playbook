---
id: PLAY-081
title: "Kits de Product Discovery y Arquitectura en pm-orchestrator y market-researcher"
status: draft
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["pm-skills", "discovery", "templates", "epic-4-multi-harness"]
dependencies: ["PLAY-075"]
priority: medium
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Compared to `phuryn/pm-skills`, our `pm-orchestrator` and `market-researcher` skills focus heavily on internal ticket state transitions (`draft -> doing -> review -> ready`) rather than providing actionable Product Management and Systems Architecture frameworks (such as Lean PRDs, Jobs-to-be-Done, Opportunity Solution Trees, Pre-Mortem risk matrices, and Architecture Decision Records).

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Enrich `pm-orchestrator` and `market-researcher` with reference guides and concise templates (`references/prd-lean-template.md`, `references/opportunity-tree-jtbd.md`, `references/adr-template.md`, `references/pre-mortem-matrix.md`) using Progressive Disclosure so they consume 0 extra tokens until invoked.
- **Out-of-Scope:**
  - Turning the playbook into a non-software marketing toolkit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 `pm-orchestrator` and `market-researcher` include on-demand reference templates for Lean PRD, JTBD / Opportunity Solution Tree, Pre-Mortem Analysis, and ADR.
- [ ] #2 `.playbook-manifest.json` and `FALLBACK_CORE_FILES` in `scripts/sync-playbook.mjs` include the new reference files.
- [ ] #3 Root `SKILL.md` files stay concise (< 220 lines) by referencing the deep templates on demand.
- [ ] #4 `npm run check:all` validates all links, manifest parity, and LOC budgets with code 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create reference templates under `.agents/skills/pm-orchestrator/references/` and `.agents/skills/market-researcher/references/`.
2. Link templates cleanly from `pm-orchestrator/SKILL.md` and `market-researcher/SKILL.md` without bloating root instructions.
3. Register new files in `.playbook-manifest.json` and `scripts/sync-playbook.mjs`.
4. Run `npm run check:all` to verify manifest parity and link validity.
<!-- SECTION:PLAN:END -->
