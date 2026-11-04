---
id: PLAY-062
title: "Add VS Code Copilot, OpenCode, and no-harness support to init"
status: ideas
created_date: '2026-11-04'
updated_date: '2026-11-04'
labels: []
dependencies: []
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Playbook init currently offers adapters only for Antigravity, Cursor, and Claude Code. Users of VS Code Copilot and OpenCode cannot select native harness support, and an empty harness selection cannot be represented distinctly from the Antigravity default.

### Discovery Scope
- Identify the canonical instruction and adapter surfaces for VS Code Copilot and OpenCode while keeping AGENTS.md and .agents/ as the canonical source of governance.
- Define how explicit no-harness mode differs from the current implicit Antigravity default.
- Keep this capability in Playbook so all consumers, including Gripm, receive the same support.

### Out of Scope
- Changing Gripm's `--init` flow; Gripm integration is tracked separately in DEV-361.
- Duplicating the canonical agent rules into harness-specific files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Research and document the supported native instruction surfaces for VS Code Copilot and OpenCode and how they point to the canonical Playbook instructions.
- [ ] #2 The product decision explicitly distinguishes an omitted harness selection (default behavior) from an explicit no-harness selection.
- [ ] #3 After refinement, `playbook init` can list and select VS Code Copilot and OpenCode using native adapters without duplicating governance content.
- [ ] #4 After refinement, `playbook init` can explicitly install no harness adapters without silently falling back to Antigravity.
- [ ] #5 Tests cover each new adapter and the explicit no-harness behavior; `npm run check:all` passes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research canonical VS Code Copilot and OpenCode instruction formats and decide adapter boundaries.
2. Define CLI semantics for omitted harnesses versus explicit none.
3. Implement and test adapters, CLI parsing, documentation, and backwards-compatible defaults.
<!-- SECTION:PLAN:END -->
