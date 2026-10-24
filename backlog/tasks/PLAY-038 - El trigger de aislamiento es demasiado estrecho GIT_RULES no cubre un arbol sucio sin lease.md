---
id: PLAY-038
title: "El trigger de aislamiento es demasiado estrecho: GIT_RULES no cubre un arbol sucio sin lease"
status: ready
created_date: '2026-10-22'
updated_date: '2026-10-24'
labels:
  - "git"
  - "multi-agent"
  - "rules"
priority: high
type: bug
estimate: 2
claimed_by: "antigravity:2212e80c-aa8b-42e7-a29b-3a1b82c2d913"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`scripts/lib/adapters.mjs:39-47` define `GIT_RULES`, el set de cinco reglas de git que el init inyecta en todo consumidor. Dos de ellas forman un par incompleto:

- Regla 4: *"A `doing` item carrying a foreign `claimed_by` owns the tree: never revert or clean it."* Es **prohibicion negativa**: no hagas nada destructivo.
- Regla 5: *"Parallel work runs in isolated worktrees: `git worktree add -b <branch> ../<repo>-<task>`."* Es **mecanismo**: aislate y trabaja igual.

Ninguna de las dos dice **cuando se pasa de modo normal a modo aislado**. El unico disparador explicito es la regla 4, y su condicion es estrecha: un item en `doing` con `claimed_by` ajeno.

Incidente medido (2026-10-22, repo gripm): otro agente dejo **seis** archivos stageados (`A `) en `backlog/tasks/` con `status: ideas` y **sin `claimed_by`**. Ninguna condicion existente disparo, asi que el agente en curso se quedo en el arbol principal y lucho contra el indice compartido durante toda la certificacion de DEV-326.

El costo no fue cosmético. `BACKLOG.md` es un agregado que referencia **todas** las tareas del arbol, y el Backlog Guard exige que no referencie tareas fantasma. Con seis tareas ajenas sin commitear, **todo** commit que incluyera el consolidado quedaba bloqueado. El agente tuvo que decidir entre incluir trabajo ajeno en su commit o romper la coherencia del consolidado, y pregunto al PO porque no habia regla que lo resolviera.

Un worktree lo habria resuelto limpiamente: la rama sale de HEAD, no ve las tareas sin trackear del otro agente, y su `BACKLOG.md` no las referencia. **La cura ya esta escrita en la regla 5; lo que falta es el disparador que active la regla 5.**

La condicion actual tampoco detecta la situacion real de colision. `claimed_by` es un lease declarado; los archivos stageados en el indice de git son **estado observable**. El segundo es una evidencia mas fuerte que el primero: no requiere que el otro agente haya sido disciplinoso, solo que exista.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `GIT_RULES` declara un disparador adicional: archivos `A ` o `M ` en `git status --porcelain` que el agente en curso no creo.
- [x] #2 Ese disparador **obliga al aislamiento en worktree** (regla 5), no solo a no revertir (regla 4). La prohibicion negativa no basta: deja al agente paralizado en el arbol principal, que es exactamente lo que ocurrio.
- [x] #3 La regla distingue explicitamente entre cambios propios del agente en curso y suciedad ajena. El disparador no puede exigir aislamiento ante los propios cambios.
- [x] #4 `AGENTS.md` y `.agents/TEAM_PLAYBOOK.md` reflejan el mismo disparador **solo si** reproducen esta seccion. Verificar antes de tocar: si la norma vive unicamente en `GIT_RULES`, no duplicarla.
- [x] #5 `npm run check:all` sale con 0 tras el cambio (validate + check:loc + test).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Releer `GIT_RULES` completo y redactar la regla 6 sin que colisione con la 4 (que sigue valiendo por su cuenta).
2. Verificar si `AGENTS.md` y `TEAM_PLAYBOOK.md` replican las reglas de git; si lo hacen, sincronizar el texto en los tres lugares.
3. Correr `check:all`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Por que no alcanza con reforzar la regla 4.** La regla 4 prohibe revertir. No dice que el agente deba dejar de trabajar en el arbol principal, y en el incidente el agente no reverteo nada: lucho con el indice. Ampliar la prohibicion no habria cambiado su conducta, porque el costo aparecia al commitear, no al editar.

**Por que el lease no es suficiente como senal.** `claimed_by` exige que el otro agente lo declare. Los archivos stageados son observables sin su cooperation. Confiar solo en el lease asume disciplina en el emisor; confiar en el indice asume solo que git funciona.

**Honest Scope & Residual Risk Declaration:**
No tests were skipped. The rule in `scripts/lib/adapters.mjs` was expanded with rule 5 mandating immediate worktree isolation whenever uncommitted changes (`A `, `M `) not created by the active session are observed in `git status --porcelain`. Parity was maintained across `AGENTS.md`, `.agents/TEAM_PLAYBOOK.md`, and `.agents/rules/git-workflow.md`. Residual risk: multi-agent isolation relies on peer adherence to the prompt rules when external agents (Cursor, Claude Code, Copilot) operate outside mechanical harness hooks.
<!-- SECTION:NOTES:END -->
