---
id: PLAY-075
title: "Desacople de skills core para ejecucion Standalone sin requerir backlog-tasks ni gripm-board"
status: draft
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["skills", "standalone", "architecture", "epic-1-open-skills"]
dependencies: ["PLAY-074"]
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Currently, `pm-orchestrator`, `principal-engineer`, `qa-auditor`, `product-designer`, `market-researcher`, and `release-management` assume that the host repository uses `backlog/tasks/<ID>.md`, `.agents/STATE_MACHINE.md`, `npx playbook gate <ID>`, and `@gripm/board` MCP tools. When a developer installs a single skill (e.g. `principal-engineer` or `qa-auditor`) into a standard repository that uses GitHub Issues, Linear, Jira, or no tracker at all, the instructions fail or force unwanted file creation.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Refactor all 7 core `SKILL.md` files to operate in two conditional modes:
    1. **Standalone Mode (Default):** Delivers full engineering, UX, research, or blind-QA value on any repository and git diff without requiring `backlog/tasks/` or state machine transitions.
    2. **Tracked Mode (Opt-in when `backlog/tasks/` or `.gripm/` is present):** Activates `draft -> doing -> review -> ready -> done` transitions and `npx playbook gate <ID>`.
  - Update `scripts/gate-qa.mjs` to support a taskless diff/pyramid verification flag (e.g. `npx playbook gate --diff` or `npx playbook verify`) for repositories without `backlog/tasks/`.
- **Out-of-Scope:**
  - Removing `gate-qa.mjs` or `STATE_MACHINE.md` for tracked projects.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 All 7 core `SKILL.md` files explicitly separate Standalone Mode rules (zero dependency on `backlog/tasks/` or `STATE_MACHINE.md`) from Tracked Mode rules.
- [ ] #2 In Standalone Mode, `qa-auditor` and `principal-engineer` can execute the Verification Pyramid and blind git diff audit without requiring a `TASK-ID` argument.
- [ ] #3 `scripts/gate-qa.mjs` supports a taskless diff/pyramid verification flag (e.g. `npx playbook gate --diff` or `npx playbook verify`) for repositories without `backlog/tasks/`.
- [ ] #4 Tests cover taskless verification and standalone skill validation; `npm run check:all` passes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit all 7 core `SKILL.md` files for hard dependencies on `backlog/tasks/`, `STATE_MACHINE.md`, and `gripm-board` MCP.
2. Refactor each `SKILL.md` to declare Standalone Mode as default behavior and Tracked Mode when `backlog/tasks/` exists.
3. Add taskless verification mode (`--diff` / `verify`) to `scripts/gate-qa.mjs` and `scripts/lib/cli-router.mjs`.
4. Add tests in `tests/gate-qa.test.mjs` and run `npm run check:all`.
<!-- SECTION:PLAN:END -->
