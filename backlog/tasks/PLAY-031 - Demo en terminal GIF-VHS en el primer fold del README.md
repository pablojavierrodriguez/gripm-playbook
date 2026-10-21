---
id: PLAY-031
title: "Diagrama del loop de entrega en el primer fold del README (sin vhs)"
status: done
created_date: '2026-10-21'
updated_date: '2026-10-21'
labels:
  - "adoption"
  - "docs"
  - "show-dont-tell"
dependencies: []
priority: medium
type: improvement
estimate: 3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
El valor central del framework (dev tilda ACs -> QA ciego certifica -> item en `ready`) no es visible en un solo vistazo en el README: un lector tiene que leer varios documentos para entender el loop de entrega. Este item agrega un diagrama ASCII estático en el primer fold que muestra el ciclo de vida de un backlog item desde `draft` hasta `done`, destacando el gate ciego de QA como paso crítico entre `review` y `ready`. No depende de herramienta alguna (vhs/ffmpeg/gif no están disponibles en la máquina), solo diagramado ASCII.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Diagrama ASCII de 5 estados (draft → doing → review → ready → done) ubicado en el primer fold del README, justo después del diagrama de arquitectura "Hub Orchestrator + Sub-Agentes".
- [x] #2 El diagrama usa solo caracteres box-drawing y flechas ASCII, sin binarios, sin GIF/VHS, sin herramientas externas.
- [x] #3 El diagrama resalta el gate ciego de QA (revisión en contexto aislado por sub-agente) como la flecha crítica que separa `review` de `ready`.
- [x] #4 PLAY-030 está desvinculado (removed de `dependencies:`), pues el gate exige dependencias en `done` y PLAY-030 está en `ready`.
- [x] #5 `npm run check:all` pasa (332/332 tests, 72 suites) sin errores de Lint ni LOC.
- [x] #6 `node scripts/gate-qa.mjs submit PLAY-031` completa y pasa a `review`.
- [x] #7 QA ciego en sub-agente limpio certifica a `ready` con 7 ACs mínimas (loop visible, gate destacado, sin vhs, PLAY-030 desvinculado).
<!-- AC:END -->