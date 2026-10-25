---
id: PLAY-045
title: "Enforcement mecanico de presupuesto de archivo y reglas anti-slop en gate-qa"
status: draft
created_date: '2026-10-25'
updated_date: '2026-10-25'
labels: ["gate", "principal-engineer", "qa-gate"]
dependencies: []
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Las skills `principal-engineer` y `qa-auditor` declaran reglas estrictas que hoy descansan unicamente en la inspeccion humana o semantica del subagente, sin respaldo mecanico en `scripts/gate-qa.mjs`:
1. `PYRAMID_STEPS` en `gate-qa.mjs` no incluye la ejecucion de `check-loc.mjs` ni define formalmente si el exceso de lineas (>= 1000 LOC) bloquea la certificacion o emite un aviso segun la soberania del PO.
2. No existe un chequeo mecanico rapido en el runner para detectar evasiones de tipado en el diff (`as unknown as`, `as any as`) o mocks globales de modulo (`vi.mock(` / `jest.mock(`) que simulan cobertura sin ejercitar la integracion.

Integrar estas verificaciones mecanicas en el ciclo de promocion robustece la garantia de calidad eliminando atajos inadvertidos.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] Incorporar el paso de chequeo de modularidad (`check-loc.mjs`) o inspeccion de presupuesto dentro de `scripts/gate-qa.mjs` o la piramide de verificacion, con comportamiento configurable o claramente documentado.
- [ ] Incorporar chequeo estatico o regex en `scripts/gate-qa.mjs` / `inspectTask` para advertir o bloquear la presencia de `as unknown as` y `as any as` en archivos modificados.
- [ ] Actualizar la documentacion de `qa-auditor/SKILL.md` para reflejar con precision los pasos y exit codes reales del runner mecanico.
- [ ] `npm test` y `npm run validate` pasan en verde.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Estudiar integracion de `check-loc` en la piramide de `scripts/gate-qa.mjs`.
2. Implementar analisis rapido del diff en `gate-qa.mjs` para patrones de evasion de tipos.
3. Actualizar tests unitarios del gate en `tests/`.
4. Ejecutar suite completa de tests.
<!-- SECTION:PLAN:END -->
