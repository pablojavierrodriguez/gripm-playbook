---
id: PLAY-026
title: "Refactorizacion modular de scripts del core bajo umbral preventivo de 500 LOC (scripts/lib)"
status: ready
created_date: '2026-10-17'
updated_date: '2026-10-18'
claimed_by: "antigravity:0bf9c7fc-c9b7-49a2-8842-d45ec85d64b0"
labels:
  - "architecture"
  - "modularity"
  - "tooling"
dependencies: []
priority: high
type: refactor
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Descomponer los tres scripts principales del repositorio (`scripts/gate-qa.mjs`, `scripts/sync-playbook.mjs` y `scripts/validate-repo.mjs`) que superaban el umbral de aviso preventivo (500 LOC) extrayendo submodulos de alta cohesion en `scripts/lib/` y garantizando 100% de compatibilidad hacia atras en el CLI y API programatica:

1. **Extraccion de submodulos en `scripts/lib/`:**
   - `frontmatter.mjs`: parser de YAML plano, extraccion de ACs y mutacion determinista de frontmatter.
   - `terminal.mjs`: formateo ANSI y cabeceras de terminal.
   - `pyramid.mjs`: resolucion y ejecucion de la Piramide de Verificacion.
   - `task-inspection.mjs`: carga de tareas, resolucion de rutas e inspeccion pura de invariantes.
   - `provenance.mjs`: fetch con reintentos/backoff y verificacion de historial upstream en GitHub.
   - `sync-classifier.mjs`: hashing SHA-256, clasificacion de archivos locales y deteccion de huerfanos.
   - `catalog-validator.mjs`: validacion de catalogos locales `.uxaudit.json`.
   - `doc-checks.mjs`: validacion de links Markdown, frontmatter de skills y vocabulario de estados.
2. **Paridad de instalacion:** Registro de los submodulos runtime requeridos por `gate-qa.mjs` en `.playbook-manifest.json` y `FALLBACK_CORE_FILES`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Extraer submodulos cohesivos en `scripts/lib/` (`frontmatter.mjs`, `terminal.mjs`, `pyramid.mjs`, `task-inspection.mjs`, `provenance.mjs`, `sync-classifier.mjs`, `catalog-validator.mjs`, `doc-checks.mjs`)
- [x] #2 Reducir `scripts/gate-qa.mjs`, `scripts/sync-playbook.mjs` y `scripts/validate-repo.mjs` por debajo de las 500 LOC eliminando el 100% de los warnings en `node scripts/check-loc.mjs`
- [x] #3 Registrar los submodulos requeridos por el gate en `.playbook-manifest.json` (`core`) y `FALLBACK_CORE_FILES` manteniendo paridad total
- [x] #4 Preservar el 100% de compatibilidad de exports y comportamiento CLI validado por `npm run check:all`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extraer logica compartida e independiente en 8 modulos dentro de `scripts/lib/`.
2. Refactorizar `gate-qa.mjs`, `sync-playbook.mjs` y `validate-repo.mjs` delegando en `scripts/lib/` y conservando las constantes literales requeridas por `validate-repo.mjs`.
3. Actualizar `.playbook-manifest.json` y `FALLBACK_CORE_FILES`.
4. Verificar `node scripts/check-loc.mjs --strict` con 0 warnings y 0 violaciones.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Refactorizacion completada:
- `scripts/gate-qa.mjs`: 705 -> 301 LOC.
- `scripts/sync-playbook.mjs`: 700 -> 433 LOC.
- `scripts/validate-repo.mjs`: 573 -> 300 LOC.
- Todos los 13 archivos fuente en `scripts/` y `scripts/lib/` se mantienen por debajo de 500 LOC (0 warnings en `check-loc`).
<!-- SECTION:NOTES:END -->
