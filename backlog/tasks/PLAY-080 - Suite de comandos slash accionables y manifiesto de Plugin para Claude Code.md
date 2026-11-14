---
id: PLAY-080
title: "Suite de comandos slash accionables y manifiesto de Plugin para Claude Code"
status: draft
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["commands", "plugins", "claude-code", "dx", "epic-4-multi-harness"]
dependencies: ["PLAY-075", "PLAY-079"]
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Leading repositories like `phuryn/pm-skills` and `obra/superpowers` drive daily engagement through explicit `/slash` commands (`/discover`, `/write-prd`, `/verify`, `/review`) and 1-command plugin installation (`/plugin marketplace add owner/repo`). `gripm-playbook` currently lacks invocable slash commands and a Claude Code plugin marketplace manifest.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Create 6 high-utility, standalone-ready slash commands installable into `.claude/commands/` (and `.agents/workflows/`):
    - `/discover`: Fast product discovery, benchmark lookup, and edge-case matrix.
    - `/refine`: Structured requirement refinement and measurable AC generation.
    - `/audit-ux`: Runs static UX audit (`npx @gripm/playbook audit`) and proposes targeted code fixes.
    - `/audit-health`: Runs repo health & anti-slop diagnostic (`npx @gripm/playbook audit-repo` + `check-loc`) and identifies God-files or type evasions.
    - `/qa-blind`: Spawns the isolated clean-context `qa-auditor` sub-agent on the current `git diff` and runs the Verification Pyramid.
    - `/ship`: Guides SemVer calculation, clean user-facing release notes extraction, and pre-release checks.
  - Include `.claude-plugin/marketplace.json` (and `plugin.json`) so users can install via `/plugin marketplace add pablojavierrodriguez/gripm-playbook`.
- **Out-of-Scope:**
  - Proprietary IDE extensions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Six slash command templates (`/discover`, `/refine`, `/audit-ux`, `/audit-health`, `/qa-blind`, `/ship`) are defined in the repository and installed by `init`/`sync` for supported harnesses.
- [ ] #2 Repository includes a valid Claude Code plugin manifest enabling installation via `/plugin marketplace add pablojavierrodriguez/gripm-playbook`.
- [ ] #3 Each command works both in Standalone Mode (without `backlog/tasks/`) and Tracked Mode (with `backlog/tasks/`).
- [ ] #4 Validation and unit tests verify command files and plugin manifest integrity; `npm run check:all` exits 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Author the 6 slash command Markdown definitions and place them in `.claude/commands/` and `.agents/workflows/` (plus manifest registration).
2. Create `.claude-plugin/marketplace.json` and plugin descriptor metadata.
3. Wire command installation into `scripts/lib/adapters.mjs` and `scripts/sync-playbook.mjs`.
4. Add validation checks in `scripts/validate-repo.mjs` and tests in `tests/`, then run `npm run check:all`.
<!-- SECTION:PLAN:END -->
