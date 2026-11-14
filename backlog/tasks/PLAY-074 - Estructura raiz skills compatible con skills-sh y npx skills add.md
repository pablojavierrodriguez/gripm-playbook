---
id: PLAY-074
title: "Estructura raiz skills compatible con skills-sh y npx skills add"
status: draft
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["distribution", "skills-sh", "packaging", "epic-1-open-skills"]
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Marketplaces and CLI package managers like `skills.sh` (`vercel-labs/skills`), `LinklyAI/best-skills`, and `awesomeskill.ai` discover and install individual skills from a root `skills/<skill-name>/SKILL.md` directory convention (`npx skills add <owner>/<repo> --skill <name>`). Because `gripm-playbook` stores skills inside `.agents/skills/` and `.agents/stacks/<stack>/skills/`, external users cannot install individual Playbook skills with `npx skills add` without running the full `npx @gripm/playbook init` wizard.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Expose a canonical root `skills/<skill-name>/` layout (or automated build/sync mirror validated by `scripts/validate-repo.mjs`) covering all core and stack skills so `npx skills add pablojavierrodriguez/gripm-playbook` discovers every skill natively.
  - Update `package.json` `files` and `.playbook-manifest.json` if needed.
  - Preserve backward compatibility with `.agents/skills/` for `npx @gripm/playbook init` and `sync`.
- **Out-of-Scope:**
  - Rewriting the internal prose of each skill (covered in `PLAY-075`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Root directory `skills/<skill-name>/SKILL.md` exposes all core and stack skills for direct discovery by `npx skills add` and `skills.sh` indexers.
- [ ] #2 `scripts/validate-repo.mjs` enforces parity between `skills/` and `.agents/skills/` (or single-source resolution) so definitions never drift.
- [ ] #3 Running `npx @gripm/playbook init` and `sync` continues to install `.agents/skills/` without regressions.
- [ ] #4 Automated tests in `tests/` verify skill discovery layout and `npm run check:all` exits with code 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Design single-source or synchronized parity mechanism between `.agents/` skill definitions and root `skills/<skill-name>/`.
2. Generate or expose `skills/<skill-name>/SKILL.md` (and bundled `references/` or `scripts/` where applicable) for all core and stack skills.
3. Add parity validation to `scripts/validate-repo.mjs` and tests in `tests/`.
4. Run `npm run check:all` and verify `npx skills` directory discovery structure.
<!-- SECTION:PLAN:END -->
