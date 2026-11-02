---
id: PLAY-054
title: "Integracion de compuerta mecanica de salud en gate-qa.mjs y binarios"
status: done
created_date: '2026-11-01'
updated_date: '2026-11-02'
labels: []
dependencies:
  - PLAY-053
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrar el motor de auditoría de código como guardrail mecánico dentro de scripts/gate-qa.mjs.

Actualmente gate-qa.mjs verifica tests, criterios de aceptación y frontmatter YAML. Esta tarea añade la verificación de salud estructural del repositorio:
- Impide que una tarea pase a ready si el agente introdujo archivos monolíticos (>1000 LOC).
- Valida que no se hayan introducido suppressions críticas de TypeScript/linter sin justificación.
- Expone el ejecutable global audit-repo en el mapa bin de package.json.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 #1 gate-qa.mjs ejecuta una comprobación de presupuesto y anti-slop invocando la lógica de audit-engine.mjs.
- [x] #2 #2 Si el código introduce archivos mayores a 1000 LOC o violaciones críticas no suprimidas, gate-qa.mjs emite fallo y aborta la promoción a ready (con bypass explícito --force si el PO lo autoriza).
- [x] #3 #3 bin en package.json de @gripm/playbook expone audit-repo apuntando a scripts/audit-engine.mjs.
- [x] #4 #4 tests de integración de gate-qa validan que la compuerta de salud detenga promociones con violaciones estructurales.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `"audit-repo": "scripts/audit-engine.mjs"` to `package.json` `"bin"` map.
2. Update `scripts/audit-engine.mjs` CLI entry trigger so running via `audit-repo` shim executes `runCli()`.
3. Add `checkStructuralHealth` helper to `scripts/lib/anti-slop.mjs` that dynamically inspects codebase health using `audit-engine.mjs`.
4. Update `scripts/gate-qa.mjs` to execute `checkStructuralHealth`, failing promotion on files >= 1000 LOC or critical quality suppressions unless bypassed by `--force`.
5. Maintain strict modularity invariant (< 500 LOC for `gate-qa.mjs`).
6. Add comprehensive unit and integration tests in `tests/gate-qa.test.mjs`.
<!-- SECTION:PLAN:END -->
