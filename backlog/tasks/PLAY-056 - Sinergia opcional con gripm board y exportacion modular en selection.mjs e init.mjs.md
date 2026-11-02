---
id: PLAY-056
title: "Sinergia opcional con gripm board y exportacion modular en selection.mjs e init.mjs"
status: ready
created_date: '2026-11-01'
updated_date: '2026-11-01'
labels: []
dependencies:
  - PLAY-053
  - PLAY-054
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrar el nuevo script audit:repo en el sistema modular de selección de scripts de @gripm/playbook (PLAY-051).

Garantizar:
1. 100% ofrecido, 0% impuesto: el usuario puede elegir si desea incorporar audit:repo a sus scripts en package.json tanto en modo Quick como en modo Componente por Componente.
2. Detección no invasiva de @gripm/board: si Board está presente, enlazar la configuración sin forzar dependencias.
3. Actualización de tests de selección y sincronización.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 #1 scripts/lib/selection.mjs incluye audit:repo y audit:repo:strict dentro de VALID_SCRIPTS y SCRIPT_DEFINITIONS.
- [x] #2 #2 init.mjs y sync-playbook.mjs soportan la instalación opcional de audit:repo sin imponerlo.
- [x] #3 #3 Si se detecta @gripm/board o directorio backlog/tasks/, init.mjs sincroniza umbrales de auditoría en .gripm/config.json.
- [x] #4 #4 tests unitarios de selection.test.mjs y sync.test.mjs actualizados y pasando con código 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update `scripts/lib/selection.mjs`:
   - Add `audit:repo` and `audit:repo:strict` to `VALID_SCRIPTS`.
   - Add script definitions for `audit:repo` ('playbook audit-repo') and `audit:repo:strict` ('playbook audit-repo --strict') to `SCRIPT_DEFINITIONS`.
   - Add labels for terminal selection prompts to `SCRIPT_LABELS`.
2. Update `scripts/init.mjs`:
   - Support optional installation of `audit:repo` and `audit:repo:strict` through standard selection mechanisms.
   - Detect `@gripm/board` (in package.json dependencies/devDependencies) or existence of `backlog/tasks/` directory.
   - When detected, ensure audit thresholds (`maxLines: 1000`, `warnLines: 500`, `strict: false`) are synchronized into `.gripm/config.json`.
3. Update and extend unit and integration tests in `tests/selection.test.mjs` and `tests/sync.test.mjs`.
4. Validate zero LOC violations (< 500 LOC per script, < 1000 LOC hard ceiling) and anti-em-dash rule.
<!-- SECTION:PLAN:END -->

## QA Certification (T2) - APPROVED

Audited and certified by QA Auditor (Clean Context Sub-Agent) on 2026-11-01.

- **Executable QA Gate**: `node scripts/gate-qa.mjs PLAY-056` -> Exit Code 0.
- **Verification Pyramid**:
  - Step 1: Repo consistency / typecheck: PASSED (`npm run validate` -> exit 0)
  - Step 2: Headless tests: PASSED (`npm test` -> 411/411 tests passing, 0 failures, exit 0)
    - Granular tests: `node --test tests/selection.test.mjs tests/sync.test.mjs` (35/35 passing, exit 0)
  - Step 3: Spec - backlog consistency: PASSED (`gate-review-items` -> exit 0)
  - Step 4: File budget & modularity: PASSED (`node scripts/check-loc.mjs --strict` -> 0 violations, ceiling < 1000 LOC, all scripts < 500 LOC: init.mjs 474 LOC, sync-playbook.mjs 493 LOC, selection.mjs 232 LOC)
  - Step 5: Static UX audit: PASSED (`node scripts/audit-ux-code.cjs --strict` -> exit 0)
  - Step 6: Codebase Health Audit: PASSED (`node scripts/audit-engine.mjs --strict` -> 100/100, 0 suppressions, 0 TODOs)
- **Anti-Em-Dash & Craftsmanship Rule**: Zero em-dash (`\u2014`) or en-dash (`\u2013`) violations.
- **Acceptance Criteria Verification**:
  - [x] #1 scripts/lib/selection.mjs incluye audit:repo y audit:repo:strict dentro de VALID_SCRIPTS y SCRIPT_DEFINITIONS.
  - [x] #2 init.mjs y sync-playbook.mjs soportan la instalación opcional de audit:repo sin imponerlo.
  - [x] #3 Si se detecta @gripm/board o directorio backlog/tasks/, init.mjs sincroniza umbrales de auditoría en .gripm/config.json.
  - [x] #4 tests unitarios de selection.test.mjs y sync.test.mjs actualizados y pasando con código 0.
- **Verdict**: APPROVED -> ready (Formal development handover complete. Item ready for release assembly).

