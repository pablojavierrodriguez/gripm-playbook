---
id: PLAY-028
title: "Compuerta mecanica anti-auto-certificacion y resolucion de actor en gate-qa"
status: ready
created_date: '2026-10-17'
updated_date: '2026-10-18'
claimed_by: "antigravity:0bf9c7fc-c9b7-49a2-8842-d45ec85d64b0"
labels:
  - "qa-gate"
  - "multi-agent"
  - "governance"
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Blindar mecanicamente la separacion de contextos entre desarrollo (`doing` -> `review`) y certificacion QA (`review` -> `ready`) en `scripts/gate-qa.mjs`:

1. **Resolucion jerarquica de identidad (`resolveActor`):** Soporta flags CLI (`--by`, `--as`), variables de entorno (`GRIPM_ACTOR`, `QA_ACTOR`, `CLAIMED_BY`), variables de sesion de harness (`ANTIGRAVITY_CONVERSATION_ID`, `CURSOR_SESSION_ID`, `CLAUDE_SESSION_ID`) y fallback `human:<user>`.
2. **Comparacion normalizada (`isSameActor`):** Compara identidades de forma case-insensitive e ignorando espacios marginales.
3. **Bloqueo mecanico en T2 (`inspectTask` & `gate-qa.mjs`):** Si el actor que ejecuta la certificacion coincide con el `claimed_by` registrado en la tarea, `gate-qa.mjs` rechaza la promocion con `exit code 1`, emite el diagnostico `anti-self-certification` y preserva el estado `review` en disco.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Implementar `resolveActor` e `isSameActor` en `scripts/lib/task-inspection.mjs` y re-exportarlos desde `scripts/gate-qa.mjs`
- [x] #2 Bloquear con `exit code 1` en `gate-qa.mjs` e `inspectTask` cualquier intento de certificar una tarea cuando el certificador coincide con `claimed_by`
- [x] #3 Permitir la certificacion (`exit code 0` y promocion a `ready`) cuando el certificador es un subagente QA con contexto limpio o par distinto
- [x] #4 Añadir cobertura de tests unitarios y E2E en `tests/gate-qa.test.mjs` y `tests/e2e-delivery.test.mjs` validando el bloqueo y la aprobacion por pares
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implementar `resolveActor` e `isSameActor` en `scripts/lib/task-inspection.mjs`.
2. Extender `inspectTask(task, tasks, { certifier })` para verificar que `certifier` no coincida con `frontmatter.claimed_by`.
3. Integrar `resolveActor` en `startMain` y `main` de `scripts/gate-qa.mjs`.
4. Añadir tests en `tests/gate-qa.test.mjs` y `tests/e2e-delivery.test.mjs`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementada la compuerta mecanica anti-auto-certificacion en `gate-qa.mjs` y `task-inspection.mjs`, verificada con suites unitarias y E2E.
<!-- SECTION:NOTES:END -->
