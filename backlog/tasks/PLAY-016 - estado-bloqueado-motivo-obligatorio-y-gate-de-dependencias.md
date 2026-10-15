---
id: PLAY-016
title: "Estado 'blocked' con motivo obligatorio y gate de resolución de dependencias"
status: done
created_date: '2026-10-12'
updated_date: '2026-10-15'
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

## QA Round 1 - REJECTED

Mismos tres blockers compartidos con PLAY-015 (D1 piramide vacia, D2 gate de dependencias anulable, D3 `--no-run` certificando). Los tres afectaban directamente a este item: D2 era el mecanismo que hacia exigible el gate de dependencias del AC #3.

- AC #2 reforzado: `blocked_reason` en whitespace ahora se rechaza.
- AC #3 verificado adversarialmente por el QA con fixtures reales (dependencia en `review` y en `ideas`: ambas rechazadas; control con dependencia en `done`: aceptado).
- AC #5 half-false: nombraba `TEAM_PLAYBOOK.md`, que no documentaba el estado blocked. Corregido.

Co-autorizacion: `gate:qa PLAY-016` sale con 0 tras las correcciones.


## QA Round 2 - REJECTED, luego corregido

Defectos compartidos con PLAY-015. **N3 era directamente un AC de este item**: la falsificacion de identidad de tareas hacia que el gate de dependencias del AC #3 fuera evadible. **N4 era el AC #4 de este item, marcado `[x]` sin implementacion** — la regla T_unblock existia solo como prosa en STATE_MACHINE.md.

- AC #2: `blocked_reason` en whitespace rechazado.
- AC #3: gate de dependencias ya no evadible por duplicados, anidamiento, mayusculas/espacios, ni ids colisionados.
- AC #4: regla de desbloqueo implementada en `inspectTask` con tests propios.
- AC #5: la edicion de `TEAM_PLAYBOOK.md` que el AC nombraba ahora existe de verdad.

Co-autorizacion: `gate:qa PLAY-016` sale con 0.

## QA Round 3 - corregido

- **R3-3 (AC #4)**: el guard de T_unblock existia pero no podia impedir nada, porque el gate T2 solo inspecciona items en `review` y un item `blocked` siempre falla el chequeo de status antes. Ahora tiene entrada propia: `node scripts/gate-qa.mjs unblock <id>` evalua la transicion `blocked -> doing` y devuelve exit 1 si una dependencia sigue sin resolver. El guard deja de ser decorativo.
- **R3-1**: la falsificacion de identidad de tareas (N3) estaba detectada pero no aplicada; un item podia certificar contra una dependencia fabricada. Cerrado con enforcement probada.
- **R3-2**: un item sin id no puede certificarse.
- Typo en la nota de ronda 1 corregido (`AC #5Half-false`).

Co-autorizacion: `gate:qa PLAY-016` sale con 0.

## QA Round 4 - AC #4 cerrado

- **S2 (fail-open del unblock)**: una dependencia inexistente permitia desbloquear. Era una contradiccion directa del texto de este AC. Corregida: ahora se rechaza y se indica que hay que resolverla o sacarla del array explicitamente.
- **S1**: `unblockMain` -la entrada que da teeth a este AC- tenia cero cobertura. Siete tests CLI: rechazo por dependencia sin resolver, por dependencia inexistente, por colision de id; permitido cuando la dependencia esta `done`; no-aplica cuando el item no esta `blocked`; y los dos caminos de error (sin target, task inexistente).
- **S4**: `id: "   "` certificaba. Lleva el mismo `.trim()` que ya recibe `blocked_reason`.
- **S5**: el comando `unblock` no aparecia en ningun doc operable. Documentado en `SKILL.md`, `STATE_MACHINE.md` y `CONTRIBUTING.md`.

PLAY-015 quedo certificada en esta ronda. Este item quedo pendiente solo por los findings de `unblockMain`, ya corregidos y cubiertos.

## QA Round 5 - CERTIFIED (ready)

- **Auditor:** Rigorous QA Auditor (`.agents/skills/rigorous-qa-auditor/SKILL.md`)
- **Certification Date:** 2026-10-15
- **Verification Pyramid Execution:**
  - `npm run validate`: PASS (exit code 0)
  - `npm test`: PASS (128 tests across 30 suites, 0 failures, exit code 0)
  - `npm run gate:review`: PASS (exit code 0)
  - `npm run audit:ux:strict`: PASS (exit code 0)
  - Production build: SKIPPED (optional; not applicable to this documentation/CLI framework package)
  - Gate runner execution (`npm run gate:qa PLAY-016`): PASS (exit code 0)
- **AC Verification & Edge Cases:**
  - AC #1: Canonical `blocked` status in `.agents/STATE_MACHINE.md` with explicit transitions (`T_block`, `T_unblock`) and guards. VERIFIED.
  - AC #2: Invariant requiring non-empty `blocked_reason` in frontmatter of any `status: blocked` item (whitespace rejected). VERIFIED.
  - AC #3: Dependency gate in runner (`scripts/gate-qa.mjs`) rejecting certification to `ready` if dependencies are not `done` or missing from disk. VERIFIED.
  - AC #4: Rule and CLI command (`gate-qa.mjs unblock <id>`) preventing unblock (`blocked` ➔ `doing`/`draft`) when blocking dependencies are unresolved or missing from disk. VERIFIED.
  - AC #5: Lifecycle and impediment documentation in `docs/BACKLOG.md` (§ 4.b) and `.agents/TEAM_PLAYBOOK.md` (§ Phase 4 / `blocked`). VERIFIED.
  - AC #6: Automated test coverage in `tests/gate-qa.test.mjs` verifying blocked status invariants, unblock guards, CLI command, and dependency graph resolution. VERIFIED.
- **Verdict:** `[ APPROVED → ready ]`