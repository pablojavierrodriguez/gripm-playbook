---
id: PLAY-023
title: "Protocolo de Peer Discovery dinamico y Handshake sincronico inter-agente"
status: done
created_date: '2026-10-17'
updated_date: '2026-10-17'
labels:
  - "multi-agent"
  - "coordination"
  - "state-machine"
  - "iacp"
dependencies: []
priority: urgent
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Institucionalizar el Protocolo Autonomo de Coordinacion Inter-Agente (IACP) en `@gripm/playbook` para eliminar el riesgo de colisiones en el working tree compartido y evitar que el usuario deba actuar como intermediario o pasamanos de IDs de conversacion:
1. **Single Source of Truth en Backlog:** El ítem de tarea es el unico lease del sistema. Al transicionar a `status: doing`, el agente estampa atómicamente en el frontmatter YAML `claimed_by: "<provider>:<session_or_agent_id>"` (ej. `antigravity:<id>`, `cursor:<id>`, `claude-code:<id>`, `human:<id>`) y `worktree: "main"` (o la ruta a su worktree).
2. **Pre-Flight Concurrency Probe Sincrónico:** Antes de modificar codigo o ejecutar comandos destructivos de Git (`git checkout .`, `git restore .`), todo agente realiza un probe sincrónico del backlog buscando tareas activas en `doing` y revisando `git status --porcelain`.
3. **Salvaguarda de Arbol Compartido:** Prohibicion estricta e inviolable de revertir o limpiar el working tree si hay tareas activas en `doing` con un `claimed_by` ajeno.
4. **Handshake Proactivo y Auto-Bifurcacion:** Si se detecta un par activo del mismo harness (`antigravity:`), emite un mensaje directo (`send_message` a `Recipient: claimed_by`). Si es cross-harness (`cursor:`, `claude-code:`, etc.), reconoce la frontera RPC y se auto-aísla mecánicamente en un `git worktree` independiente (`git worktree add -b <branch> ../<repo>-<task>`), permitiendo trabajo 100% paralelo sin interferencias ni fallas.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Se formaliza la transicion T0 en `.agents/STATE_MACHINE.md` incorporando `claimed_by` como guard obligatorio
- [x] #2 Se incorpora el Invariante 9 en `STATE_MACHINE.md` prohibiendo revertir el arbol compartido con tareas en curso ajenas
- [x] #3 Se documenta en `.agents/TEAM_PLAYBOOK.md` el flujo completo de Dynamic Peer Discovery & Handshake Protocol
- [x] #4 Se actualiza `.agents/rules/git-workflow.md` y `AGENTS.md` con el Pre-Flight Concurrency Probe previo a comandos Git
- [x] #5 Se actualiza la skill `principal-engineer` con el protocolo de probe y claiming atomico al entrar a `doing`
- [x] #6 Se estandariza el formato namespaced de `claimed_by` (`<provider>:<id>`) con ruteo intra y cross-harness
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Actualizar `STATE_MACHINE.md` con T0 y el Invariante 9.
2. Incorporar el protocolo IACP en `TEAM_PLAYBOOK.md` y `git-workflow.md`.
3. Actualizar `AGENTS.md`, `principal-engineer/SKILL.md` y `pm-orchestrator/SKILL.md`.
4. Ejecutar la suite de pruebas completa `npm run check:all`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Disenado y validado en caliente tras la coordinacion exitosa inter-agente entre las conversaciones 054b6c1e y 7e5f1a7d.
<!-- SECTION:NOTES:END -->
