---
id: PLAY-079
title: "Abstraccion agnostica de sub-agentes y adaptadores nativos multi-harness"
status: draft
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["harnesses", "subagents", "claude-code", "cursor", "copilot", "opencode", "epic-4-multi-harness"]
dependencies: ["PLAY-062", "PLAY-075"]
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
`TEAM_PLAYBOOK.md` and `pm-orchestrator/SKILL.md` hardcode Antigravity-specific tool calls (`invoke_subagent(TypeName: "self", Workspace: "share")`, `send_message(Recipient: claimed_by)`), while `scripts/lib/adapters.mjs` only generates a minimal `CLAUDE.md` pointer and `.cursor/rules/*.mdc` without generating native Claude Code sub-agents (`.claude/agents/*.md`), Windsurf rules, GitHub Copilot instructions (`.github/copilot-instructions.md`), or OpenCode configs.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Replace Antigravity-only tool syntax in core skills and `TEAM_PLAYBOOK.md` with a harness-agnostic **Context Isolation Contract** accompanied by a per-harness mapping table (Claude Code `Task` / `.claude/agents/`, Antigravity `invoke_subagent`, Cursor subagents/rules, OpenCode agents, fallback clean-session protocol).
  - Expand `scripts/lib/adapters.mjs` to generate native sub-agent definitions in `.claude/agents/` (`principal-engineer.md`, `qa-auditor.md`, `product-designer.md`, `market-researcher.md`) and native adapters for `claude`, `cursor`, `copilot`, `windsurf`, `opencode`, `antigravity`, and `none`.
- **Out-of-Scope:**
  - Modifying `@gripm/board` CLI flags (covered in `DEV-374`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 `TEAM_PLAYBOOK.md` and core `SKILL.md` files express sub-agent dispatch through a harness-agnostic contract with explicit mappings for Claude Code, Cursor, Antigravity, OpenCode, and Copilot.
- [ ] #2 Selecting the `claude` harness in `init` generates native sub-agent files under `.claude/agents/` with proper YAML frontmatter (`name`, `description`, `tools`).
- [ ] #3 `scripts/lib/adapters.mjs` supports `antigravity`, `claude`, `cursor`, `copilot`, `windsurf`, `opencode`, and explicit `none`.
- [ ] #4 Automated tests verify generated adapter files for every supported harness; `npm run check:all` exits 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define the harness-agnostic Context Isolation Contract in `.agents/TEAM_PLAYBOOK.md` and update core skills.
2. Implement native adapter renderers in `scripts/lib/adapters.mjs` for Claude Code sub-agents (`.claude/agents/`), Copilot, Windsurf, OpenCode, Cursor, Antigravity, and `none`.
3. Update `scripts/init.mjs` harness auto-detection and multi-select prompts.
4. Add unit and integration tests for all adapters and run `npm run check:all`.
<!-- SECTION:PLAN:END -->
