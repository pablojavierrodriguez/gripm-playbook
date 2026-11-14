---
id: PLAY-078
title: "Niveles de adopcion progresiva en init y AGENTS-md lite standard y strict"
status: draft
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["onboarding", "dx", "governance", "epic-3-progressive-governance"]
dependencies: ["PLAY-075"]
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
First-time users running `npx @gripm/playbook init` get an `AGENTS.md` and harness rules (`scripts/lib/adapters.mjs`) that immediately enforce maximum ceremony: mandatory `backlog/tasks/` creation for every code change, mandatory 8-question refinement interviews, mandatory English commits regardless of user preference, and strict `dev -> main` branching. This high initial friction causes developers to abandon the tool in favor of lighter alternatives like `gentle-ai`.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Introduce 3 governance tiers in `scripts/init.mjs`, `scripts/lib/selection.mjs`, and `scripts/lib/adapters.mjs`:
    1. `lite` (Default for standalone installs without `@gripm/board`): Installs skills, slash commands, and headless verification gates (`audit-ux`, `check-loc`, `audit-repo`, blind QA on diff) with zero mandatory `backlog/tasks/` paperwork and configurable commit language.
    2. `standard` (Default when `@gripm/board` or `backlog/tasks/` is active): Connects tasks in `backlog/tasks/` with pragmatic gates.
    3. `strict`: Full enterprise governance (`--strict` LOC/UX gates, worktree lease enforcement, `dev -> main` release ceremony).
  - Ensure `scripts/validate-commit-msg.mjs` respects the configured project language in `lite` and `standard` tiers.
- **Out-of-Scope:**
  - Removing strict capabilities for teams that opt into `strict`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 `scripts/init.mjs` and `scripts/lib/adapters.mjs` support governance tiers (`lite`, `standard`, `strict`) via interactive prompt and `--tier` / `--preset` flag.
- [ ] #2 Generated `AGENTS.md`, `CLAUDE.md`, and harness rules in `lite` mode do not mandate creating files in `backlog/tasks/` for every code change.
- [ ] #3 Commit language rule in adapters and `validate-commit-msg.mjs` respects the project language configured during `init` (allowing Spanish or English when configured in `lite`/`standard` mode).
- [ ] #4 Onboarding and adapter tests verify rendered files for `lite`, `standard`, and `strict` tiers; `npm run check:all` exits 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Design tier templates (`lite`, `standard`, `strict`) in `scripts/lib/adapters.mjs` and `scripts/lib/selection.mjs`.
2. Update `scripts/init.mjs` to default standalone installs to `lite` and tracked installs (`@gripm/board` / `backlog/tasks/`) to `standard`.
3. Update `scripts/validate-commit-msg.mjs` to support configurable language policy (`--lang` or `.gripm/config.json`).
4. Add comprehensive tests in `tests/` and run `npm run check:all`.
<!-- SECTION:PLAN:END -->
