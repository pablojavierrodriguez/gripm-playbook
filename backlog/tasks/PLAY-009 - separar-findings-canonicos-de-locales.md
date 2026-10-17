---
id: PLAY-009
title: "La puerta de salida del motor debe separar findings canonicos de locales"
status: done
created_date: '2026-10-06'
updated_date: '2026-10-17'
labels:
  - "baseline"
  - "observability"
  - "tooling"
dependencies:
  - PLAY-003
priority: medium
type: improvement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`--strict` decide el codigo de salida sobre **todos** los hallazgos reportados. Con un catalogo local activo, un consumidor tiene tres clases de observacion mezcladas en un solo contador:

- firmas canonicas del playbook
- firmas locales del proyecto
- observaciones absorbidas por el baseline

Un `--strict` que falla por una regla local no dice cual de las dos familias es responsable, y un `--strict` en CI que falla por un invariante propio no es comparable con uno que falla por el catalogo compartido. Dos proyectos con el mismo resultado pueden tener causas distintas y ningun signal para distinguirlas.

El baseline tiene el mismo problema, que es mas caro: la fingerprint es `regla|archivo|digest`. Un snapshot tomado antes de agregar una regla local contiene entradas que despues se reinterpretan, y no hay forma de regenerar el snapshot **solo** para las firmas locales sin perder el trabajo de revision de las canonicas.
<!-- SECTION:DESCRIPTION:END -->

## Out of scope

- Cambiar la semantica de `ERROR` como no absorbible.
- Reglas configurables por severidad.

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 El reporte distingue findings canonicos de locales (tanto en salida humana como en el resumen)
- [x] #2 `--strict` puede limitarse a las firmas canonicas mediante `--canonical-only`
- [x] #3 `--update-baseline` puede regenerar solo un subconjunto de firmas (`--only canonical|local` o `--rule <ID>`)
- [x] #4 Un snapshot parcial no pierde la revision de las firmas que no se regeneran
- [x] #5 La salida JSON declara el origen (`origin: "canonical" | "local"`) de cada hallazgo
- [x] #6 `npm run check:all` en verde
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Transicionar tarea a doing (`gate-qa.mjs start PLAY-009`).
2. Asegurar que `loadRules()` y `loadCatalog()` etiqueten `origin: 'canonical' | 'local'` en todas las reglas y que `auditFile()` propague `origin` a cada finding.
3. Actualizar `printHuman()` y `summary` para distinguir findings canonicos y locales.
4. Agregar soporte para `--canonical-only` y `--only canonical|local` en `parseArgs()` y `main()`.
5. Implementar actualizacion parcial de baseline en `writeBaseline()` preservando entradas de firmas fuera del subconjunto regenerado.
6. Agregar tests unitarios e integrados en `tests/audit-ux.test.mjs`.
7. Verificar y tildar ACs, transicionar a review y certificar con subagente QA en contexto limpio.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Cambios implementados

1. **Etiquetado de origen (`origin: "canonical" | "local"`):**
   - En `scripts/audit-ux-code.cjs`, `loadRules()` y `loadCatalog()` etiquetan todas las reglas canonicas con `origin: 'canonical'` y las locales con `origin: 'local'`.
   - `auditFile()` propaga `origin: rule.origin || 'canonical'` a cada finding en la salida JSON y programatica.
   - `summary` incluye `canonical` y `local` con el desglose de hallazgos por familia.
   - `printHuman()` muestra `[canonical]` o `[local]` junto al ID de la regla y el resumen `(X canonical, Y local)`.

2. **Compuerta selectiva `--canonical-only`:**
   - Se agrego el flag `--canonical-only` a `parseArgs()`. Cuando se combina con `--strict`, la evaluacion del codigo de salida por warnings o findings se restringe exclusivamente a hallazgos con `origin === 'canonical'`.

3. **Actualizacion parcial de baseline (`--update-baseline` con `--only canonical|local` o `--rule <ID>`):**
   - Se agrego el flag `--only canonical|local` a `parseArgs()`.
   - `writeBaseline(findings, root, partialRuleIds)` preserva las entradas existentes en `audit-ux-baseline.json` para todas las firmas cuyos IDs no pertenecen al subconjunto regenerado (`partialRuleIds`), actualizando unicamente las firmas objetivo.

4. **Tests:**
   - Se agregaron 3 tests integrados en `tests/audit-ux.test.mjs` bajo `canonical vs local findings & partial baseline (PLAY-009)`.

### Disciplina Ponytail (Cierre Honesto)
- **Que se verifico:** `node --test tests/audit-ux.test.mjs` (40/40 tests en verde) y `npm run check:all` completo.
- **Que se salteo a proposito:** No se altero la semantica de `ERROR` como no absorbible ni se introdujeron severidades configurables, respetando el Out of Scope.
<!-- SECTION:NOTES:END -->