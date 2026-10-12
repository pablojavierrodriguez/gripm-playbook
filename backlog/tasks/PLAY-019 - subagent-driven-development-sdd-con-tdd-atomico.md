---
id: PLAY-019
title: "Subagent-Driven Development (SDD): orquestación de subagentes en contexto fresco con TDD atómico paso a paso"
status: blocked
blocked_reason: "Bloqueada: PLAY-012 (protocolo de worktree) aun no esta en done. El contenido de SDD esta escrito, pero la transicion review -> ready exige la dependencia resuelta."
created_date: '2026-10-12'
updated_date: '2026-10-12'
labels:
  - "multi-agent"
  - "tdd"
  - "subagents"
  - "architecture"
dependencies:
  - PLAY-012
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cuando un único hilo de conversación de IA intenta ejecutar un plan de implementación extenso, sufre inevitablemente de fatiga de contexto: olvida instrucciones tempranas, confunde estados, introduce regresiones silenciosas en tests que previamente pasaban y comienza a aplicar parches improvisados.

### Solución
Inspirado en el modelo de *Subagent-Driven Development (SDD)* de `obra/superpowers`:
1. **Planes de implementación a prueba de fallos:**
   - La planificación de una tarea de envergadura debe desglosarse en pasos hiper-atómicos e independientes.
   - Cada paso se redacta bajo la disciplina Red-Green TDD con instrucciones tan explícitas y autocontenidas que un subagente sin contexto histórico pueda ejecutarlo sin desvíos.
2. **Ejecución delegada en contexto limpio:**
   - El agente orquestador (Principal Engineer / Team Lead) no pica todo el código en el hilo principal.
   - Despacha un subagente fresco para resolver el paso atómico N, operando en un espacio de trabajo aislado (articulado con `PLAY-012` mediante `git worktree`).
3. **Supervisión y consolidación continua:**
   - El orquestador revisa el diff producido por el subagente, corre la verificación headless, y únicamente cuando pasa en verde consolida el cambio antes de disparar el paso N+1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Documentar en .agents/TEAM_PLAYBOOK.md el protocolo de Subagent-Driven Development (SDD) para tareas de alta complejidad
- [x] #2 Definir el estándar de Planes de Implementación atómicos basados en ciclos TDD paso a paso (test fallando ➔ código mínimo ➔ test verde ➔ verificación)
- [x] #3 Articular el flujo de SDD con la directriz de aislamiento por git worktree (PLAY-012)
- [x] #4 Actualizar .agents/skills/principal-engineer/SKILL.md con las directrices de supervisión, revisión de diffs y consolidación secuencial de subagentes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Redactar el flujo operativo de SDD en `.agents/TEAM_PLAYBOOK.md` en la sección de paralelismo y autonomía de subagentes.
2. Integrar las directrices de supervisión en `.agents/skills/principal-engineer/SKILL.md`.
3. Validar consistencia del repositorio con `npm run validate` y `npm test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:END -->
