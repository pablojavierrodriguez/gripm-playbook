---
id: PLAY-012
title: "Aislamiento de agentes concurrentes mediante git worktree para prevenir colisiones de rama y working tree"
status: review
created_date: '2026-10-12'
updated_date: '2026-10-12'
labels:
  - "git"
  - "governance"
  - "multi-agent"
  - "best-practices"
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cuando múltiples agentes de IA (o hilos paralelos) operan de forma concurrente sobre un mismo repositorio local en ramas distintas, el uso tradicional de `git checkout <branch>` dentro del mismo directorio de trabajo produce colisiones críticas:

1. **Estado global de HEAD:** `.git/HEAD` y el working tree son compartidos a nivel de sistema de archivos. Si el Agente B ejecuta `git checkout dev-feature` mientras el Agente A está trabajando sobre `dev`, el working tree del Agente A cambia silenciosamente de rama en tiempo real.
2. **Commits en ramas equivocadas:** Si el Agente A ejecuta `git commit` tras la conmutación involuntaria, los cambios se asientan sobre la rama del Agente B, contaminando el historial y generando confusión operativa.
3. **Riesgo para cambios no stageados:** Cambios no guardados o temporales de un agente pueden bloquear o corromper el checkout de otro agente.

### Solución Canónica: Aislamiento mediante `git worktree`
Incorporar al Playbook (`.agents/rules/git-workflow.md`, `AGENTS.md` y `TEAM_PLAYBOOK.md`) la directriz formal y receta operativa de aislamiento multi-agente:
- **Prohibición de conmutar ramas en repositorios compartidos activos:** Cuando dos o más agentes/hilos operan simultáneamente, ningún agente debe hacer `git checkout` para cambiar de rama en el working tree principal.
- **Creación de worktrees dedicados:** Cada agente o tarea paralela debe operar en su propio worktree aislado:
  ```bash
  git worktree add ../<repo>-<feature> <branch>
  ```
  y al concluir la tarea y consolidar los cambios:
  ```bash
  git worktree remove ../<repo>-<feature>
  ```
- **Integración con sub-agentes:** Guía para que herramientas y sub-agentes utilicen el modo de workspace aislado (`Workspace: 'share'` / `Workspace: 'branch'`) o creen worktrees efímeros.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 .agents/rules/git-workflow.md incorpora sección 'Multi-Agent Parallelism via git worktree' con reglas y recetas operativas
- [x] #2 AGENTS.md documenta la prohibición de checkout cruzado en entornos multi-agente concurrentes
- [x] #3 .agents/TEAM_PLAYBOOK.md actualiza la sección de Sub-Agent Autonomy con la pauta de aislamiento de workspaces
- [x] #4 Guía de comandos prácticos (worktree add, worktree list, worktree remove) documentada en docs/ o playbook de soporte
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Redactar sección de gobernanza en `.agents/rules/git-workflow.md`:
   - Regla anti-checkout en repositorios concurrentes compartidos.
   - Receta canónica `git worktree add ../<repo>-<task> <branch>`.
   - Limpieza tras finalización: `git worktree remove ../<repo>-<task>`.
2. Actualizar `AGENTS.md` referenciando la política de worktree en la disciplina de Git.
3. Actualizar `.agents/TEAM_PLAYBOOK.md` en la sección de paralelismo de sub-agentes.
4. Validar el repositorio con `npm run validate` y `npm test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:END -->
