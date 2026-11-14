---
id: PLAY-083
title: "Publicacion de llms-txt y optimizacion de metadatos para skills-sh y LinklyAI"
status: draft
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["llms-txt", "seo", "marketplace", "docs", "epic-5-marketplace-growth"]
dependencies: ["PLAY-074", "PLAY-080", "PLAY-082"]
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
AI agent directories and ranking engines (`LinklyAI/best-skills` Worth-Installing Score, `skills.sh`, `mcpmarket.com`, `awesomeskill.ai`) evaluate repositories based on `llms.txt` availability, YAML frontmatter trigger clarity (`name` and `description`), one-line install instructions (`npx skills add`), and clear value propositions.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Create a machine-readable `llms.txt` at the root of `gripm-playbook` cataloging all skills, slash commands, deterministic CLI gates, and installation commands.
  - Optimize the YAML `description` frontmatter of every `SKILL.md` with high-intent trigger keywords.
  - Update `README.md` to showcase both `npx skills add pablojavierrodriguez/gripm-playbook` (granular skill install) and `npx @gripm/playbook init` (full governance).
- **Out-of-Scope:**
  - Paid external marketing campaigns.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Root `llms.txt` file is present, included in `package.json` `files`, and documents all skills, slash commands, CLI gates, and installation methods.
- [ ] #2 Every `SKILL.md` frontmatter `description` is optimized for semantic trigger matching and marketplace discovery without exceeding 300 characters.
- [ ] #3 `README.md` features clear installation paths for `npx skills add`, Claude Code Plugin Marketplace, and `npx @gripm/playbook init`.
- [ ] #4 `scripts/validate-repo.mjs` verifies `llms.txt` existence and link validity; `npm run check:all` exits 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Author root `llms.txt` following the standard machine-readable agent index format and add it to `package.json` `files`.
2. Tune YAML frontmatter `description` fields across all `SKILL.md` files for crisp trigger matching (<= 300 chars).
3. Rewrite `README.md` hero and installation sections to spotlight `npx skills add`, Claude Plugin, and `npx @gripm/playbook init` with progressive tiers.
4. Add `llms.txt` and frontmatter length checks to `scripts/validate-repo.mjs` and run `npm run check:all`.
<!-- SECTION:PLAN:END -->
