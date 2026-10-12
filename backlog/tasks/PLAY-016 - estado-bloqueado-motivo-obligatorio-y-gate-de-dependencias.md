---
id: PLAY-016
title: "Estado 'blocked' con motivo obligatorio y gate de resolución de dependencias"
status: review
created_date: '2026-10-12'
updated_date: '2026-10-12'
labels:
  - "state-machine"
  - "governance"
  - "backlog"
  - "gate"
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
En el flujo actual de entrega (`STATE_MACHINE.md`), cuando una tarea en desarrollo (`doing`) o planificada (`draft`) no puede avanzar debido a un impedimento externo (definición de producto pendiente, bloqueo de infraestructura, API de terceros rota o dependencia de otra tarea no liberada), no existe una forma normalizada de registrar el bloqueo:

1. **Falseo de métricas y WIP:** Las tareas frenadas quedan artificialmente en `doing`, distorsionando el Work In Progress real del sprint o tablero.
2. **Falta de trazabilidad del impedimento:** Si una tarea se bloquea, suele registrarse en comentarios dispersos o mensajes de chat sin un motivo estructurado y obligatorio, provocando que se olvide por qué se frenó.
3. **Elusión de dependencias por agentes de IA:** Los agentes frecuentemente intentan marcar tareas como terminadas (`ready`) o moverlas a desarrollo sin verificar si las tareas declaradas en `dependencies: [PLAY-XXX]` ya fueron completadas y desplegadas (`done`).

### Solución
1. **Estado canónico `blocked`:**
   - Incorporar `blocked` en la taxonomía de `STATE_MACHINE.md`.
   - Transiciones admitidas:
     - `doing` ➔ `blocked` (bloqueo durante la implementación).
     - `draft` ➔ `blocked` (bloqueo previo al inicio).
     - `blocked` ➔ `doing` / `draft` (desbloqueo).
2. **Invariante de `blocked_reason` obligatorio:**
   - Toda tarea con `status: blocked` **debe** incluir obligatoriamente el campo `blocked_reason: "<motivo detallado>"` en su frontmatter.
   - Dejar el motivo vacío o ausente invalida el estado y falla la validación.
3. **Gate de Desbloqueo y Dependencias:**
   - **Desbloqueo seguro:** Una tarea no puede volver a `doing` si el motivo de bloqueo está vinculado a dependencias que siguen sin resolverse.
   - **Gate de Dependencias para `ready`:** Ninguna tarea puede transicionar a `review` ni certificarse en `ready` si alguna de sus tareas en `dependencies:` no está en estado `done` (o fue formalmente desvinculada/eliminada del array).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Incorporar el status canónico blocked en .agents/STATE_MACHINE.md y documentar sus transiciones y guards
- [x] #2 Definir el invariante estricto de blocked_reason obligatorio en el frontmatter de toda tarea con status: blocked
- [x] #3 Implementar regla de validación en el gate runner / tooling que rechace la transición a ready si alguna tarea en dependencies no está en done
- [x] #4 Implementar regla que impida el desbloqueo (blocked ➔ doing/draft) si sus dependencias bloqueantes no fueron resueltas o eliminadas
- [x] #5 Actualizar docs/BACKLOG.md y .agents/TEAM_PLAYBOOK.md para formalizar el ciclo de vida y gestión de impedimentos
- [x] #6 Agregar tests automatizados en tests/ que verifiquen el bloqueo sin motivo y la validación del árbol de dependencias
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Actualizar `.agents/STATE_MACHINE.md` incorporando `blocked` a la tabla de estados, transiciones (T_block, T_unblock) e invariantes.
2. Actualizar `docs/BACKLOG.md` con el estándar de frontmatter (`blocked_reason`).
3. Extender el validador o gate runner para chequear `dependencies` contra los archivos reales en `backlog/tasks/`.
4. Añadir tests unitarios en `tests/` cubriendo tareas con dependencias no resueltas y tareas bloqueadas sin motivo.
5. Ejecutar `npm run validate` y `npm test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:END -->
