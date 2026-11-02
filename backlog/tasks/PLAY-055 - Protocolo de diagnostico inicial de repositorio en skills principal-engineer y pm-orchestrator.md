---
id: PLAY-055
title: "Protocolo de diagnostico inicial de repositorio en skills principal-engineer y pm-orchestrator"
status: ready
created_date: '2026-11-01'
updated_date: '2026-11-01'
labels: []
dependencies: []
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Actualizar las directivas de las skills de agentes en @gripm/playbook (.agents/skills/) para incorporar la cultura de diagnóstico estático preventivo.

Cualquier agente que adopte los roles del Playbook debe:
1. Al ingresar a un repositorio existente, ejecutar o consultar la auditoría estática para conocer la baseline (LOC, suppressions, TODOs, stack).
2. Si @gripm/board está activo, interactuar vía MCP con gripm_get_repo_health.
3. Si el proyecto no tiene @gripm/board, correr npx @gripm/playbook audit (o npm run audit:repo) para operar con la misma disciplina de Staff Engineer mecánico.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 #1 .agents/skills/principal-engineer/SKILL.md incorpora el protocolo de diagnóstico inicial estático antes de modificar código en proyectos existentes.
- [x] #2 #2 .agents/skills/pm-orchestrator/SKILL.md añade la evaluación de salud del repositorio como paso previo al refinamiento de iniciativas grandes o sprints.
- [x] #3 #3 .agents/skills/qa-auditor/SKILL.md documenta la auditoría de salud de código en el paso de verificación estructural.
- [x] #4 #4 Se instruye a los agentes a consultar gripm_get_repo_health vía MCP si detectan que @gripm/board está presente, o ejecutar audit:repo en terminal si no lo está.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add section 15 to `.agents/skills/principal-engineer/SKILL.md` detailing the static code diagnostic protocol using MCP `gripm_get_repo_health` or CLI `audit:repo`.
2. Add point 7 to Gate R1 and update the Structured Refinement Interview table in `.agents/skills/pm-orchestrator/SKILL.md` to evaluate repo health score (< 80) and file budget violations before refinement or sprint planning.
3. Update Step 4 and Item 7 in `.agents/skills/qa-auditor/SKILL.md` documenting structural health and anti-slop debt verification during the QA gate.
4. Verify complete anti-em-dash compliance and run repository validator and full test suite (`npm test`).
<!-- SECTION:PLAN:END -->
