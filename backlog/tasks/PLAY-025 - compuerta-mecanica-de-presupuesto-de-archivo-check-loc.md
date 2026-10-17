---
id: PLAY-025
title: "Compuerta mecanica de presupuesto de archivo y visibilidad de limites modulares (check-loc)"
status: done
created_date: '2026-10-17'
updated_date: '2026-10-17'
labels:
  - "tooling"
  - "modularity"
  - "architecture"
  - "ci"
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Materializar de forma ejecutable y automatizada la regla de modularidad introducida en PLAY-024 mediante un script de inspeccion de presupuesto de lineas de codigo (`scripts/check-loc.mjs`):

1. **Inspeccion determinista y agnostica:** Escanea archivos de codigo fuente en el proyecto ignorando rutas en `.gitignore`, `.locignore`, `node_modules`, `dist`, `.git` y binarios. Auto-detecta carpetas de codigo fuente (`src/`, `app/`, etc.).
2. **Visibilidad de deuda tecnica y Soberania del PO:** Por defecto opera en modo informativo y de alerta temprana (exit code 0), dando visibilidad clara de archivos que superan las 1000 LOC sin bloquear unilateralmente la entrega de valor urgente. La decision final de refactorizar de inmediato o priorizar en el backlog pertenece soberanamente al PO.
3. **Modo estricto opt-in (`--strict`):** Permite configurar una compuerta bloqueante estricta (exit code 1) para pipelines que requieran rechazo forzoso.
4. **Soft Warning (500 - 999 LOC):** Todo archivo en zona de crecimiento modular emite una advertencia preventiva para impulsar refactorizacion oportuna.
5. **API programatica y CLI:** Expone `checkFileBudget(options)` y CLI ejecutable `node scripts/check-loc.mjs` con flags `--max-lines`, `--warning-lines`, `--path`, `--src`, `--exclude`, `--strict` y `--json`.
6. **Integracion en el Playbook:** Empaquetado en `.playbook-manifest.json` y `FALLBACK_CORE_FILES`, y agregado a los scripts de `package.json` (`npm run check:loc`, `npm run check:loc:strict` y parte de `npm run check:all`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Script `scripts/check-loc.mjs` implementado con analisis agnostico de lineas, filtrado de .gitignore y .locignore
- [x] #2 Salida diferenciada de aviso de deuda tecnica (>= 1000 LOC) y advertencias preventivas (500-999 LOC). Modo informativo por defecto (exit code 0 para preservar soberania del PO) y modo `--strict` (exit code 1)
- [x] #3 `package.json` incluye script `check:loc`, `check:loc:strict` y lo integra en la suite `check:all`
- [x] #4 El script se incluye en el core del `.playbook-manifest.json` y en `FALLBACK_CORE_FILES` de `sync-playbook.mjs`
- [x] #5 Suite de tests unitarios en `tests/check-loc.test.mjs` validando CLI y API programatica
- [x] #6 `npm run check:all` en verde
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Crear tarea PLAY-025 y transicionar a doing (`gate-qa.mjs start PLAY-025`).
2. Implementar `scripts/check-loc.mjs` con modo informativo por defecto (exit code 0) y `--strict` opt-in.
3. Actualizar `package.json`, `.playbook-manifest.json` y `sync-playbook.mjs`.
4. Crear suite de tests `tests/check-loc.test.mjs`.
5. Verificar y tildar ACs.
6. Transicionar a review (`gate-qa.mjs submit PLAY-025`).
7. Certificar con subagente QA virgen (`gate-qa.mjs PLAY-025`) a status ready.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementada compuerta agnostica `scripts/check-loc.mjs`:
- Analisis de lineas de codigo respetando .gitignore, .locignore y auto-deteccion de directorios de codigo fuente.
- Enfoque centrado en la soberania del PO: salida informativa y advertencia de deuda tecnica por defecto con exit code 0 para no obstaculizar entregas prioritarias. Modo `--strict` disponible para bloqueos forzosos.
- Suite de tests con 18 casos cubriendo API y CLI.
- Validado con `npm run check:all` en verde.
<!-- SECTION:NOTES:END -->
