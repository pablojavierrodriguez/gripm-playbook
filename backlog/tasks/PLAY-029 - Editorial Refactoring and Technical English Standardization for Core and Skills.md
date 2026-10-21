---
id: PLAY-029
title: "Editorial Refactoring and Technical English Standardization for Core and Skills"
status: ready
created_date: '2026-10-20'
updated_date: '2026-10-20'
labels: []
dependencies: []
priority: high
type: refactor
estimate: 5
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete editorial refactoring of gripm-playbook core to eliminate language mixing (Spanglish), replace informal prompt-engineering buzzwords with industry-standard terminology, and clean unparametrized template leftovers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 All core framework files (AGENTS.md, TEAM_PLAYBOOK.md, STATE_MACHINE.md, core skills) are written strictly in idiomatic, professional technical English.
- [x] #2 Zero mixed-language paragraphs or residual Spanish sentences in core guidelines and skills.
- [x] #3 Role names and skills standardized (e.g. product-designer, qa-auditor) across manifest, scripts, and documentation.
- [x] #4 Esoteric slang removed and replaced with standard engineering practices (Honest Scope & Residual Risk, Refinement Gate).
- [x] #5 All template placeholders ([PROJECT_NAME], [e.g., ...]) cleaned and parametrized.
- [x] #6 npm run check:all passes with 0 errors in gripm-playbook.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit all core files in .agents/ and scripts/ for mixed language and placeholders.
2. Refactor AGENTS.md, TEAM_PLAYBOOK.md, and STATE_MACHINE.md into high-precision technical English.
3. Update role naming and documentation in .playbook-manifest.json and skills.
4. Replace slang (Disciplina Ponytail, Grilling Session) with professional software engineering concepts.
5. Verify test suite and lint checks with npm run check:all.
<!-- SECTION:PLAN:END -->
