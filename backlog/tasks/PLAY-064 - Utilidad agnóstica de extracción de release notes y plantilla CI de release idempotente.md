---
id: PLAY-064
title: "Utilidad agnóstica de extracción de release notes y plantilla CI de release idempotente"
status: done
created_date: '2026-11-08'
updated_date: '2026-11-10'
labels: []
dependencies: []
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Los workflows de CI/CD de proyectos que usan Playbook suelen sufrir de fragilidad en la fase de release: scripts inline de bash/node para extraer notas, acoplamiento donde un fallo en GitHub Release impide reintentos, y falta de marcadores `--latest`.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  1. Crear el script utilitario agnóstico `scripts/extract-release-notes.mjs` distribuible vía Playbook:
     - Capaz de extraer notas y título tanto desde `backlog/releases.json` (formato Gripm Board) como desde `docs/RELEASE_NOTES.md` (formato Markdown plano).
     - Genera `release-title.txt` y `release-notes.txt` de forma limpia y testeable localmente.
     - Aplica validación Anti-Em-Dash (reemplazando o alertando ante caracteres unicode em-dash o en-dash).
  2. Proveer una receta o plantilla canónica de GitHub Actions (`templates/ci-release-job.yml` o en documentación) que demuestre:
     - Desacople idempotente de estados (`tag_exists` y `release_exists` evaluados independientemente).
     - Flag `--latest` en `gh release create`.
     - Concurrency seguro (`cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`).
  3. Tests unitarios en `tests/` para `extract-release-notes.mjs`.
- **Out-of-Scope:**
  - Modificar la infraestructura de CI de proyectos externos de forma automática.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 scripts/extract-release-notes.mjs extrae título y cuerpo correctamente desde backlog/releases.json y docs/RELEASE_NOTES.md.
- [x] #2 El script genera release-title.txt y release-notes.txt normalizando CRLF y respetando la regla Anti-Em-Dash.
- [x] #3 Tests unitarios en tests/ cubren ambos formatos de extracción y fallbacks.
- [x] #4 La plantilla de CI con los guardrails de idempotencia y --latest queda documentada en el Playbook.
- [x] #5 npm run check:all pasa con código 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implementar `scripts/extract-release-notes.mjs`:
   - Funciones modulares: `extractFromReleasesJson`, `extractFromMarkdown`, `sanitizeAntiEmDash`, `normalizeLineEndings`, `normalizeVersion`.
   - Generación de `release-title.txt` y `release-notes.txt` en el directorio de salida.
   - Normalización de CRLF a LF y conversión de caracteres unicode em-dash / en-dash a guión estándar ` - `.
2. Crear `templates/ci-release-template.yml` con pasos desacoplados (`tag_exists`, `release_exists`), `--latest`, y concurrencia segura.
3. Crear suite unitaria completa en `tests/extract-release-notes.test.mjs` con 20 pruebas cubriendo helpers, json, markdown, sandbox CLI y fallbacks.
4. Validar suite completa con `npm run check:all`.
<!-- SECTION:PLAN:END -->
