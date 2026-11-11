---
id: PLAY-059
title: "Descomposicion modular de scripts/audit-ux-code.cjs bajo el techo de 1000 LOC"
status: done
created_date: '2026-11-02'
updated_date: '2026-11-10'
labels:
  - "refactor"
  - "modularity"
  - "clean-code"
  - "ux-auditor"
dependencies: []
priority: high
type: refactor
estimate: 3
claimed_by: "antigravity:subagent-play-059"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
El repositorio `@gripm/playbook` establece como regla innegociable que ningún archivo de código fuente debe alcanzar o superar las 1000 líneas de código (`check-loc.mjs`). Sin embargo, `scripts/audit-ux-code.cjs` cuenta actualmente con **1.441 líneas**, concentrando en un único archivo monolítico el CLI parser, el cargador de catálogos y baselines, el motor heurístico de unidades JSX/AST y el formateador de reportes.

Para predicar con el ejemplo y mantener un Health Score de **100/100** con `check:loc:strict` en verde, es obligatorio descomponer `scripts/audit-ux-code.cjs` en módulos cohesivos.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  1. Extraer la lógica de parseo de unidades JSX, expresiones e internacionalización (`collectUnits`, `stripExpressions`, `findTagEnd`, jerarquía de componentes) a `scripts/lib/ux-jsx-parser.cjs`.
  2. Extraer la carga de configuración, catálogos de reglas (canónicas y locales), compilación de globs `exclude` y gestión de snapshots `audit-ux-baseline.json` a `scripts/lib/ux-catalog.cjs`.
  3. Mantener intacta la interfaz pública programática (`const { auditProject } = require('./audit-ux-code.cjs')`) y todos los flags de CLI.
  4. Actualizar `.playbook-manifest.json` y `FALLBACK_CORE_FILES` si corresponde para empaquetar los submódulos en el tarball de npm.
- **Out-of-Scope:**
  - Alterar la semántica de detección de las reglas `UX-001` a `UX-015`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `scripts/audit-ux-code.cjs` y cada uno de sus submódulos extraídos (`scripts/lib/ux-*.cjs`) se mantienen estrictamente por debajo de las 650 líneas de código (cumpliendo con creces el techo de < 1000 LOC).
- [x] #2 `node scripts/check-loc.mjs --strict` y `node scripts/audit-engine.mjs --strict` sobre el repositorio `@gripm/playbook` reportan **0 violaciones de LOC** y un **Health Score de 100/100**.
- [x] #3 La API exportada (`auditProject`, `loadRules`, etc.) y el comportamiento CLI de `scripts/audit-ux-code.cjs` conservan 100% de retrocompatibilidad.
- [x] #4 `npm test` (incluyendo los 13 archivos de test y todas las fixtures de `audit-ux.test.mjs`) y `npm run validate` pasan con código 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Crear `scripts/lib/ux-jsx-parser.cjs` con las funciones de análisis de tags, atributos, hijos y expresiones JSX.
2. Crear `scripts/lib/ux-catalog.cjs` con la carga de reglas, baselines y exclusiones.
3. Reducir `scripts/audit-ux-code.cjs` al motor de evaluación de reglas, API pública y CLI runner (< 600 LOC).
4. Actualizar `scripts/validate-repo.mjs` / `.playbook-manifest.json` si es necesario y verificar con `npm run check:all` y `npm run check:loc:strict`.
<!-- SECTION:PLAN:END -->
