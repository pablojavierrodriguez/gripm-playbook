---
id: PLAY-082
title: "Empaquetado portable de audit-ux audit-repo y check-loc para ejecucion desde skills-sh"
status: draft
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["cli", "skills-sh", "static-analysis", "epic-5-marketplace-growth"]
dependencies: ["PLAY-074", "PLAY-076"]
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Gripm Playbook's strongest differentiator over pure-prompt repositories (`gentle-ai`, `pm-skills`, `agensi.io`) is its zero-dependency, zero-token deterministic static analysis suite (`audit-ux`, `audit-repo`, `check-loc`). However, when a user installs a single skill via `npx skills add` without adding `@gripm/playbook` to `package.json`, running `npx playbook audit` can fail if the package is not installed locally.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Update all `SKILL.md` command invocations and CLI entry points so agents can invoke `npx -y @gripm/playbook audit`, `npx -y @gripm/playbook audit-repo`, and `npx -y @gripm/playbook check-loc` (zero-install via npm registry) OR bundled skill scripts when installed via `npx skills add`, with fast JSON and human output modes.
- **Out-of-Scope:**
  - Requiring global npm installation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 `scripts/sync-playbook.mjs` and bin entry points support direct zero-install execution via `npx -y @gripm/playbook <subcommand>` (`audit`, `audit-repo`, `check-loc`, `gate`, `review`).
- [ ] #2 `code-level-ux-auditor`, `principal-engineer`, and `qa-auditor` `SKILL.md` document zero-install `npx -y @gripm/playbook` commands that work in any repository without prior `init`.
- [ ] #3 CLI router tests verify all subcommands (`audit`, `audit-repo`, `check-loc`, `gate`, `review`) invoked through the main entry point; `npm run check:all` passes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit `scripts/lib/cli-router.mjs` and `package.json` `bin` mappings for zero-install `npx -y @gripm/playbook <subcommand>` reliability.
2. Bundle or point lightweight runner wrappers in skill `scripts/` folders where needed for `npx skills add`.
3. Update `code-level-ux-auditor`, `principal-engineer`, and `qa-auditor` `SKILL.md` invocations.
4. Add CLI router and subprocess tests, then run `npm run check:all`.
<!-- SECTION:PLAN:END -->
