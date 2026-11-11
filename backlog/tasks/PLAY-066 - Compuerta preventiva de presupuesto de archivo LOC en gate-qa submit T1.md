---
id: PLAY-066
title: "Compuerta preventiva de presupuesto de archivo LOC en gate-qa submit T1"
status: done
claimed_by: "antigravity:47712f98-dbb2-45cf-8f50-02a1d15f0cf9"
created_date: '2026-11-09'
updated_date: '2026-11-10'
labels: ["gate", "modularity", "loc"]
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Actualmente, `scripts/gate-qa.mjs` en la transición T1 (`submit`, `doing` ➔ `review`) solo verifica frontmatter básico y ACs completos. Los archivos fuente monolíticos (>= 1.000 LOC) o que superan la zona de advertencia de modularidad solo se evalúan en la certificación final T2 (`gate-qa` review ➔ ready). Esto permite que el desarrollador o agente promueva código con deuda modular crítica a `review`, obligando a rechazarlo tardíamente en QA en lugar de frenarlo preventivamente en el submit.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Integrar la verificación de presupuesto de archivos en `scripts/gate-qa.mjs submitMain` sobre los archivos modificados o creados en el diff actual (`git diff HEAD`).
  - Advertir preventivamente si algún archivo modificado se encuentra en la zona de advertencia (>= 800 LOC).
  - Rechazar mecánicamente la transición a `review` (exit 1) si algún archivo de código fuente modificado o creado alcanza o supera el techo duro de 1.000 LOC, obligando a modularizar antes de someter a QA.
  - Soportar bypass explícito vía `--force` reservado para la autoridad del PO.
  - Tests unitarios en `tests/gate-qa.test.mjs`.
- **Out-of-Scope:**
  - Modificar el comportamiento de `check-loc.mjs` standalone o alterar `DEFAULT_MAX_LINES`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `scripts/gate-qa.mjs submit` evalúa los archivos modificados/creados respecto a HEAD mediante el motor de salud estructural / `check-loc`.
- [x] #2 Si un archivo modificado o creado supera las 1.000 LOC, `gate-qa submit` aborta con código 1 y mensaje explicativo de modularidad requerida.
- [x] #3 Si un archivo modificado o creado supera 800 LOC pero está bajo 1.000 LOC, emite una advertencia de proximidad al límite sin bloquear la transición.
- [x] #4 `--force` permite omitir el bloqueo de LOC bajo responsabilidad del PO emitiendo una advertencia formal.
- [x] #5 Tests en `tests/gate-qa.test.mjs` validan el bloqueo en >= 1.000 LOC y la advertencia en >= 800 LOC.
- [x] #6 `npm test` pasa sin regresiones.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Escribir tests en `tests/gate-qa.test.mjs` simulando `gate-qa submit` sobre archivos monolíticos.
2. Actualizar `submitMain` en `scripts/gate-qa.mjs` para invocar la comprobación estructural del diff antes de mutar frontmatter.
3. Verificar con tests y suite completa.
<!-- SECTION:PLAN:END -->
