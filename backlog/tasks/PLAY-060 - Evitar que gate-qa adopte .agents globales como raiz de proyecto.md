---
id: PLAY-060
title: "Evitar que gate-qa adopte .agents globales como raiz de proyecto"
status: done
created_date: '2026-11-03'
updated_date: '2026-11-10'
labels:
  - "cli"
  - "qa"
  - "root-resolution"
dependencies: []
priority: high
type: bug
estimate: 2
claimed_by: "copilot:db2bad02-4e8a-4cc5-a4e1-208400ba01ff"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Al ejecutar `gate-qa` con una ruta de tarea temporal, la resolucion de raiz puede ascender hasta el perfil del usuario e interpretar su `.agents/` global como raiz del proyecto. `checkStructuralHealth` entonces inspecciona archivos ajenos al repositorio, supera el limite de salida de `spawnSync` (`ENOBUFS`) y hace fallar pruebas e2e.

### Alcance
- Tratar `.agents/` solo como marcador de proyecto cuando contiene artefactos canónicos de gobernanza; reconocer también marcadores inequívocos como `.git`, `package.json`, `.playbook-manifest.json`, `AGENTS.md` o `backlog/tasks/`.
- Si una ruta explícita de tarea no tiene una raíz de proyecto reconocible en sus ancestros, usar el directorio de esa tarea como raíz de fallback.
- Añadir una regresión CLI que demuestre que artefactos en un ancestro con `.agents/` no contaminan la inspección de la tarea aislada.

### Fuera de alcance
- Cambiar reglas del auditor, la pirámide de verificación o el gate de certificación.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 La resolución de una ruta explícita reconoce raíces con marcadores de proyecto verificables y no considera suficiente un `.agents/` genérico de un ancestro.
- [x] #2 Si no existe un marcador de proyecto, `gate-qa` usa el directorio de la tarea como raíz y no inspecciona artefactos de sus directorios padre.
- [x] #3 Una prueba CLI con un ancestro que contiene `.agents/` y una supresión fuera del directorio de la tarea devuelve el resultado esperado para la tarea aislada, sin `ENOBUFS`.
- [x] #4 Los casos existentes de resolución por ID, paquetes consumidores y `--root` conservan su comportamiento.
- [x] #5 `npm run check:all` termina con código 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- [x] 1. Ajustar los marcadores de raíz y el fallback para rutas explícitas en `scripts/gate-qa.mjs`.
- [x] 2. Añadir una regresión e2e determinista en `tests/e2e-delivery.test.mjs`.
- [x] 3. Ejecutar el caso aislado y `npm run check:all`.
<!-- SECTION:PLAN:END -->
