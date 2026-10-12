---
id: PLAY-018
title: "Gate de refinamiento R1 interactivo (grill-me) y glosario ubicuo de dominio (DOMAIN.md) para especificaciones sin asunciones"
status: review
created_date: '2026-10-12'
updated_date: '2026-10-12'
labels:
  - "pm-orchestrator"
  - "refinement"
  - "domain-driven-design"
  - "state-machine"
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
El modo de fallo más crítico y destructivo al desarrollar con agentes de IA es la desalineación inicial: cuando el usuario plantea una necesidad, el agente con frecuencia asume silenciosamente requerimientos no especificados, proyecta soluciones sobre premisas falsas y comienza a programar código desconectado de la intención real del producto. Adicionalmente, la ausencia de un vocabulario formal compartido provoca que el agente responda con párrafos inflados y confusos donde un término preciso del negocio bastaría.

### Solución
Inspirado en las skills de ingeniería de `mattpocock/skills` (Total TypeScript):
1. **Gate R1 Interactivo ("Grilling Session"):**
   - Prohibir que una tarea se promueva a `Refined: yes` o ingrese a desarrollo (`doing`) mediante asunción o deducción pasiva del agente.
   - El PM Orchestrator debe someter la propuesta a un interrogatorio estructurado: formular preguntas directas sobre casos de borde, fallbacks ante errores, comportamiento en estados vacíos y tradeoffs de producto antes de dar por cerrado el alcance.
2. **Glosario de Dominio Ubicuo (`DOMAIN.md` / `CONTEXT.md`):**
   - Establecer una convención estándar y liviana para proyectos consumidores del playbook que defina los conceptos clave del dominio (Domain-Driven Design).
   - El agente debe consultar este archivo en cada sesión para utilizar la terminología canónica del proyecto, erradicando la verbosidad excesiva y las alucinaciones conceptuales.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Actualizar .agents/skills/pm-orchestrator/SKILL.md incorporando el protocolo de 'Grilling Session' interactiva para el Gate R1
- [x] #2 Actualizar .agents/STATE_MACHINE.md (Sección 2: Refinement Gate R1) exigiendo resolución explícita de ambigüedades documentada antes de habilitar T0 (draft ➔ doing)
- [x] #3 Documentar en docs/ y en el playbook la convención y plantilla canónica de DOMAIN.md (Glosario Ubicuo y arquitectura de términos)
- [x] #4 Actualizar AGENTS.md instruyendo a los agentes a consultar el glosario de dominio para garantizar concisión y evitar explicaciones redundantes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Diseñar la plantilla estándar `DOMAIN_TEMPLATE.md` en `docs/`.
2. Actualizar las pautas de refinamiento en `.agents/skills/pm-orchestrator/SKILL.md`.
3. Ajustar las condiciones de entrada del Gate R1 en `.agents/STATE_MACHINE.md`.
4. Integrar la regla en `AGENTS.md`.
5. Validar el repositorio con `npm run validate` y `npm test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:END -->
