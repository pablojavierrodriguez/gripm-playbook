---
id: PLAY-044
title: "Unificacion de formato de tareas y reduccion de duplicacion DRY en documentacion troncal"
status: draft
created_date: '2026-10-25'
updated_date: '2026-10-25'
labels: ["documentation", "dry", "state-machine"]
dependencies: []
priority: medium
type: refactor
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Existen dos problemas de coherencia y sobrecarga de contexto en la documentacion troncal del framework:
1. En `pm-orchestrator/SKILL.md` (lineas 33-37) y `STATE_MACHINE.md` (lineas 46-50), los ejemplos de refinamiento muestran un formato plano markdown (`### [BACKLOG-001] ... - **Status:** draft`), mientras que `gate-qa.mjs` y `BACKLOG.md` operan obligatoriamente con archivos individuales en `backlog/tasks/*.md` que llevan YAML frontmatter (`id`, `status`, `dependencies`, etc.) y bloques `<!-- AC:BEGIN -->`. Esto confunde a los modelos cuando generan nuevas tareas.
2. La maquina de estados, el protocolo `claimed_by` con `git worktree`, y las politicas de `< 1000 LOC` estan duplicadas palabra por palabra a lo largo de `AGENTS.md`, `TEAM_PLAYBOOK.md`, `STATE_MACHINE.md` y las skills principales. Esto consume miles de tokens innecesarios por sesion de agente.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] Actualizar los ejemplos de definicion de tareas en `pm-orchestrator/SKILL.md` y `STATE_MACHINE.md` para reflejar fielmente la estructura real de archivo `backlog/tasks/*.md` con YAML frontmatter y bloques de criterios de aceptacion.
- [ ] Aplicar DRY en `AGENTS.md`, `TEAM_PLAYBOOK.md` y `pm-orchestrator/SKILL.md`, consolidando `STATE_MACHINE.md` y `git-workflow.md` como unicas fuentes de verdad referenciadas por vinculos.
- [ ] Reducir la sobrecarga de tokens de contexto sin debilitar las directivas no negociables del framework.
- [ ] `npm run validate` valida con exito enlaces y vocabulario de estados.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Corregir ejemplos de tareas en `pm-orchestrator/SKILL.md` y `STATE_MACHINE.md`.
2. Refactorizar y aligerar secciones duplicadas en `TEAM_PLAYBOOK.md` y `AGENTS.md`.
3. Validar consistencia global con `npm run validate`.
<!-- SECTION:PLAN:END -->
