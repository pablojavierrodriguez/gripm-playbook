---
id: PLAY-061
title: "Alinear el gate estructural con strict y los cambios de la tarea"
status: done
created_date: '2026-11-04'
updated_date: '2026-11-04'
labels:
  - "qa"
  - "gate"
  - "regression"
dependencies: []
priority: high
type: bug
estimate: 3
claimed_by: "copilot:urgent-playbook-gate-fix"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
El gate de QA bloquea la certificación de tareas por violaciones de LOC y supresiones preexistentes en cualquier parte del repositorio, incluso en modo normal y cuando esos hallazgos no guardan relación con el diff de la tarea. Esto contradice la pirámide, que define LOC como advertencia fuera de `--strict`, y hace que cambios sin regresiones queden atrapados por deuda heredada.

### Alcance y decisiones
- **In-Scope:**
  1. En modo normal, mantener los hallazgos estructurales globales como advertencias y bloquear únicamente nuevas violaciones duras de LOC o supresiones introducidas por los cambios sin commit.
  2. En `--strict`, conservar el bloqueo por todas las violaciones estructurales del repositorio.
  3. Conservar `--force` como bypass explícito de autoridad PO, con advertencia.
  4. Agregar pruebas de regresión para deuda previa no bloqueante, regresiones nuevas bloqueantes y modo estricto global.
- **Out-of-Scope:**
  - Remediar LOC o supresiones preexistentes del repositorio consumidor.
  - Cambiar los criterios de auditoría UX o la detección de supresiones del auditor.
- **Decisiones:**
  - Una violación de LOC preexistente bloquea en modo normal solo si el archivo vuelve a crecer; una violación nueva también bloquea.
  - Una supresión bloquea en modo normal solo si la línea que la contiene fue añadida en el diff actual.
  - Si no puede determinarse el baseline Git, el gate informa la limitación como advertencia y no atribuye deuda histórica al cambio.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Con hallazgos de LOC y supresiones que ya existen en `HEAD`, el gate normal los reporta como advertencias y no bloquea la tarea.
- [x] #2 En modo normal, una nueva violación de LOC o una supresión añadida por el diff bloquea la certificación.
- [x] #3 `--strict` bloquea por hallazgos estructurales preexistentes en cualquier parte del repositorio.
- [x] #4 `--force` conserva el bypass explícito y reporta que los hallazgos se omitieron.
- [x] #5 Las pruebas enfocadas de gate y `npm run check:all` terminan con código 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Distinguir deuda estructural preexistente de hallazgos atribuibles al diff en el modo normal.
2. Mantener el bloqueo estructural global exclusivamente en modo estricto y respetar `--force`.
3. Añadir pruebas de regresión para los modos normal, estricto y force.
4. Ejecutar las pruebas enfocadas y `npm run check:all`.
<!-- SECTION:PLAN:END -->
