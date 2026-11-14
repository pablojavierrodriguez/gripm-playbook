---
id: PLAY-073
title: "Unificacion de integridad de backlog y manejo acotado de IDs duplicados historicos en gate-qa"
status: done
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels:
  - "backlog"
  - "gate-qa"
  - "integrity"
  - "sprint-scope"
dependencies: []
priority: high
type: feature
milestone: "v2.11.0"
claimed_by: "antigravity:dev-00a9c7bd"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
En auditorias reales de entrega se detecto una desalineacion critica entre los validadores de backlog:
- `scripts/lib/task-inspection.mjs` + `scripts/gate-qa.mjs` cargan el 100% de `backlog/tasks/` y abortan toda certificacion si existe cualquier ID duplicado historico en tareas `done`/`dismissed`, bloqueando la certificacion de tareas nuevas validas en el sprint activo.
- Mientras tanto, `verify-backlog-sync.js` en repositorios consumidores no validaba unicidad de IDs ni diferenciaba colisiones activas de deuda historica, generando falsos verdes frente a colisiones activas y bloqueos totales por deuda archivada.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Enriquecer `loadTasks(tasksDir)` en `scripts/lib/task-inspection.mjs` registrando el estado (`statuses`) de cada copia involucrada en una colision y agregar `classifyCollisions(collisions, tasks, options)` junto con carga de sprints activos desde `backlog/sprints.json`.
  - Regla unificada de bloqueo vs advertencia:
    - **Bloquea** si la colision toca el ID objetivo, sus dependencias directas o transitivas, cualquier tarea perteneciente a un sprint con `status === 'active'` en `backlog/sprints.json`, cualquier copia no historica (`status` fuera de `['done', 'dismissed']`), archivos `(unreadable)`, o cuando se pasa `--strict`.
    - **Advierte (`▲`) sin bloquear** cuando todas las copias colisionantes son puramente historicas (`done` / `dismissed`) fuera del alcance activo y sin `--strict`.
  - Actualizar `scripts/gate-qa.mjs` (`start`, `unblock`, `submit`, `main` respetando estrictamente el techo `< 500 LOC` y el bucle de mutacion en `main`) y `scripts/gate-review-items.mjs`.
  - Agregar tests unitarios y CLI en `tests/gate-qa.test.mjs` cubriendo colision historica (`done`/`dismissed` -> warn sin bloqueo), colision activa (`doing`/`sprint active` -> bloqueo), colision en dependencia transitiva (-> bloqueo) y `--strict` (-> bloqueo incluso sobre historicas).
- **Out-of-Scope:**
  - Edicion automatica ni borrado destructivo de archivos historicos duplicados en `backlog/tasks/`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `scripts/lib/task-inspection.mjs` expone `classifyCollisions` distinguiendo colisiones bloqueantes (objetivo, dependencias transitivas, sprint activo en `backlog/sprints.json`, estados no historicos, `(unreadable)`, o modo `strict`) de colisiones historicas (`done` / `dismissed`) emitidas como warnings.
- [x] #2 `scripts/gate-qa.mjs` (`start`, `unblock`, `submit`, `main`) y `scripts/gate-review-items.mjs` aplican la clasificacion acotada e imprimen warnings `▲` cuando existen duplicados puramente historicos sin bloquear tareas validas.
- [x] #3 `scripts/gate-qa.mjs` acepta `--strict` para forzar bloqueo tambien ante duplicados historicos y conserva intacto su presupuesto `< 500 LOC`.
- [x] #4 `tests/gate-qa.test.mjs` cubre clasificacion historica vs activa, dependencias transitivas, sprints activos y `--strict`, pasando junto a toda la suite `npm run check:all` con codigo 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Crear e iniciar `PLAY-073` (`draft` -> `doing`).
2. Implementar seguimiento de estados en `loadTasks` y helper `classifyCollisions` en `scripts/lib/task-inspection.mjs`.
3. Integrar `classifyCollisions` y soporte `--strict` en `scripts/gate-qa.mjs` (< 500 LOC) y `scripts/gate-review-items.mjs`.
4. Agregar tests en `tests/gate-qa.test.mjs` y ejecutar `npm run check:all`.
<!-- SECTION:PLAN:END -->
