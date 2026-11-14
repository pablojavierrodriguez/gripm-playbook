---
id: PLAY-077
title: "Expansion de Stack Packs de alta demanda en el mercado"
status: draft
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["stacks", "skills", "discovery", "epic-2-universal-core"]
dependencies: ["PLAY-074"]
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
`.playbook-manifest.json` currently offers only 3 optional stack packs (`react` coupled specifically to RHF + Zod + Radix + Recharts, `mobile`, and `pwa`). Competing repositories like `vercel-labs/agent-skills` and `Gentleman-Skills` attract massive organic traffic because developers search for stack-specific skills such as Next.js App Router, TypeScript strict patterns, Node/Backend APIs, Testing (Vitest/Playwright), and Python/FastAPI.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Create modular, high-signal stack packs and skills under `.agents/stacks/` (and exposed in `skills/`):
    - `nextjs`: App Router, RSC boundaries, caching/waterfalls, bundle hygiene.
    - `typescript-strict`: schema boundaries, type narrowing, zero-evasion patterns.
    - `node-api`: Fastify/Express/NestJS boundary validation, idempotency, error contracts.
    - `testing`: headless RTL/Vitest + Playwright physical hit-testing and anti-hanging patterns.
    - `python-api`: FastAPI/Pydantic/pytest strict typing and async safety.
  - Register auto-detection signals in `scripts/lib/adapters.mjs` and `.playbook-manifest.json`.
- **Out-of-Scope:**
  - Installing runtime dependencies in consumer projects.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 `.playbook-manifest.json` and `scripts/sync-playbook.mjs` include the new stack packs (`nextjs`, `typescript-strict`, `node-api`, `testing`, `python-api`) with complete `STACK.md` and `SKILL.md` files.
- [ ] #2 `scripts/lib/adapters.mjs` auto-detects the new stacks from `package.json` or repository files (e.g. `pyproject.toml` / `requirements.txt` for `python-api`).
- [ ] #3 Every new `SKILL.md` complies with frontmatter and link checks in `scripts/validate-repo.mjs`.
- [ ] #4 Tests in `tests/` verify stack detection and sync installation for all new stack packs; `npm run check:all` passes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Author `STACK.md` and `SKILL.md` modules for `nextjs`, `typescript-strict`, `node-api`, `testing`, and `python-api`.
2. Register new stacks in `.playbook-manifest.json`, `scripts/sync-playbook.mjs`, and `scripts/lib/adapters.mjs`.
3. Update `scripts/lib/doc-checks.mjs` skill frontmatter scan paths to cover new stack packs.
4. Add unit tests for stack detection and sync, then run `npm run check:all`.
<!-- SECTION:PLAN:END -->
