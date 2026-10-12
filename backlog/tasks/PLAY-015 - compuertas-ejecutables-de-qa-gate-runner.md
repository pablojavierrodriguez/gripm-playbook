---
id: PLAY-015
title: "Compuertas de certificación de QA ejecutables (gate runner) para erradicar la auto-certificación por simulación"
status: review
created_date: '2026-10-12'
updated_date: '2026-10-12'
labels:
  - "qa"
  - "state-machine"
  - "governance"
  - "tooling"
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Uno de los mayores puntos de fricción y escepticismo en los marcos de trabajo para agentes de IA es la degradación de las reglas en "teatro cognitivo". Cuando un único agente asume la conversación:
- La instrucción *"un desarrollador nunca se auto-certifica"* suele ser esquivada por el LLM simulando ser el "QA Auditor" en el mismo mensaje o turno de chat.
- Las acceptance criteria se marcan como cumplidas por inercia sin haber corrido los comandos reales de verificación.
- El agente promueve tareas a `ready` de forma discursiva, violando los invariantes del delivery flow.

### Solución
Sustituir la simulación de roles por **compuertas mecánicas ejecutables**:
1. Implementar un runner de verificación unificado (ej. `node scripts/gate-qa.mjs` o `npm run gate:qa`) que ejecute de forma headless y secuencial toda la Pirámide de Verificación:
   - Typechecking estricto (`tsc --noEmit`, 0 errores).
   - Tests unitarios y de integración (`npm test`, 0 fallos).
   - Auditoría estática de UX (`node scripts/audit-ux-code.cjs --strict`).
   - Verificación del archivo de tarea en `backlog/tasks/`: validar que exista, que todos los ACs estén marcados con `- [x]`, que se encuentre en status `review`, y que todas sus dependencias declaradas en `dependencies:` se encuentren en estado `done`.
2. Actualizar la State Machine (`.agents/STATE_MACHINE.md` transición T2) y el Team Playbook (`.agents/TEAM_PLAYBOOK.md`):
   - La transición formal `review` ➔ `ready` **exige evidencia de exit code 0 del gate runner**.
   - Cualquier intento de mover a `ready` por mera declaración textual sin haber ejecutado el runner se considera una transición inválida y no surte efecto.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Implementar un script de compuerta headless (gate runner) que ejecute la Pirámide de Verificación e inspeccione la tarea en disco (ACs completos, status review y dependencias resueltas en done)
- [x] #2 Actualizar .agents/STATE_MACHINE.md (Transición T2) para exigir formalmente la salida exit code 0 del gate runner antes de promover a ready
- [x] #3 Actualizar .agents/TEAM_PLAYBOOK.md y .agents/skills/rigorous-qa-auditor/SKILL.md para consagrar la compuerta ejecutable frente a la auto-certificación en prosa
- [x] #4 Agregar tests automatizados en tests/ que verifiquen el comportamiento y los códigos de salida del gate runner ante fallos de pirámide o dependencias pendientes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Diseñar y programar el script `scripts/gate-qa.mjs` con soporte para validación de tarea y Pirámide de Verificación.
2. Añadir script npm (`npm run gate:qa` o similar) al `package.json`.
3. Actualizar la especificación en `.agents/STATE_MACHINE.md` y `.agents/TEAM_PLAYBOOK.md`.
4. Añadir tests de cobertura para el runner en `tests/`.
5. Ejecutar `npm run validate` y `npm test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:END -->
