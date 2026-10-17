---
id: PLAY-022
title: "Erradicacion de remanentes anti-em-dash y estandarizacion de guion simple"
status: done
created_date: '2026-10-17'
updated_date: '2026-10-17'
labels:
  - "typography"
  - "clean-code"
  - "anti-ai"
  - "governance"
dependencies: []
priority: medium
type: tech_debt
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Erradicacion integral de caracteres em-dash (—, U+2014) y en-dash (–, U+2013) en toda la documentacion, encabezados, plantillas, tablas y ejemplos de `@gripm/playbook`.
El uso de guiones largos artificiales es un cliche de IA que degrada la artesanía del producto y rompe convenciones tipograficas sobrias en herramientas de ingenieria. Esta tarea estandariza el uso exclusivo del guion simple estandar `-` con espacios (` - `).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Escanear todos los archivos `.md`, `.json` y `.mjs` del repositorio eliminando em-dashes y en-dashes
- [x] #2 Reemplazar los hallazgos por el guion estandar simple con espacios (` - `) o guion de flag (`-`)
- [x] #3 Consolidar la regla anti-em-dash en `AGENTS.md` como estandar canónico obligatorio
- [x] #4 Verificar que los 128 tests de la suite del repositorio pasen limpiamente
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rastrear apariciones de U+2014 y U+2013 en `.agents/`, `docs/`, `scripts/` y raíz del repositorio.
2. Sustituir por el guion estándar `-`.
3. Validar con `npm test` y `npm run validate`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Regla canónica: "Never use em-dash or en-dash. Always use standard hyphen with spaces."
<!-- SECTION:NOTES:END -->
