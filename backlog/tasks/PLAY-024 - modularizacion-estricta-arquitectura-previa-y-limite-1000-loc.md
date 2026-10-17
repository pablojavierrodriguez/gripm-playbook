---
id: PLAY-024
title: "Modularizacion estricta, arquitectura previa y limite de 1000 lineas por archivo"
status: ready
created_date: '2026-10-17'
updated_date: '2026-10-17'
labels:
  - "architecture"
  - "modularity"
  - "craftsmanship"
  - "code-quality"
dependencies: []
priority: high
type: feature
claimed_by: "antigravity:00f48d8b-e20f-479c-822a-9bf6e0feaddc"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establecer en el core agnóstico de `@gripm/playbook` las reglas universales de modularización y arquitectura previa para garantizar soluciones robustas, escalables y mantenibles, eliminando de raíz los archivos monolíticos gigantes (God Files / God Objects) que concentran múltiples responsabilidades y actúan como punto único de falla (SPoF) en las aplicaciones:

1. **Principio Architecture-First (Diseño Previo Obligatorio):** Si el proyecto o subsistema no cuenta con una arquitectura definida, o si una tarea introduce un nuevo dominio o flujo, es obligatorio definir y documentar la arquitectura (capas, límites de módulo, contratos e interfaces públicas) antes de comenzar la codificación.
2. **Presupuesto Estricto de Tamaño de Archivo (Hard Ceiling < 1000 LOC):** Ningún archivo de código fuente (módulo, componente, servicio, script o controlador) puede alcanzar o superar las 1000 líneas de código. Si un archivo supera este umbral, constituye un defecto arquitectónico bloqueante que debe descomponerse en submódulos, subcomponentes o adaptadores antes de certificar la entrega.
3. **Anti-God-File & Desacoplamiento de Capas:** Queda prohibido agrupar en una única unidad monolítica la capa de presentación (UI/CLI/handlers), la lógica de dominio pura (invariantes/cálculos), la infraestructura/persistencia (APIs/BD/IO) y la gestión de estado.
4. **Gobierno Transversal en el Playbook:** Integración en las directivas de `AGENTS.md`, el flujo del equipo en `TEAM_PLAYBOOK.md`, la ejecución técnica en `principal-engineer`, el gate R1 en `pm-orchestrator`, y la auditoría de diffs en `rigorous-qa-auditor`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Formalizar en `AGENTS.md` el principio no negociable de Arquitectura Previa y Modularidad Estricta con limite inviolable de 1000 LOC por archivo
- [x] #2 Incorporar en `.agents/TEAM_PLAYBOOK.md` el requisito de diseño arquitectonico previo en Phase 1 y 3, y la auditoria modular en Phase 4
- [x] #3 Actualizar la skill `principal-engineer` con la directiva tecnica de Architecture-First, limite de 1000 LOC y separacion estricta de capas
- [x] #4 Actualizar la skill `pm-orchestrator` en el Refinement Gate R1 y Grilling Session incorporando la evaluacion arquitectonica previa
- [x] #5 Actualizar la skill `rigorous-qa-auditor` incorporando como causal de rechazo automatico en diff audit archivos > 1000 LOC o God-Files
- [x] #6 Verificar que la suite completa `npm run check:all` pase al 100% manteniendo el core puramente agnostico y sin enlaces rotos
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Crear el ítem formal en el backlog (`PLAY-024`) en status `draft`.
2. Transicionar el ítem a `doing` mediante `node scripts/gate-qa.mjs start PLAY-024 --by "antigravity:00f48d8b-e20f-479c-822a-9bf6e0feaddc"`.
3. Actualizar `AGENTS.md` incorporando la regla de arquitectura previa y modularización estricta.
4. Actualizar `.agents/TEAM_PLAYBOOK.md` en las secciones correspondientes del ciclo de delivery.
5. Actualizar `.agents/skills/principal-engineer/SKILL.md` formalizando las directivas técnicas de modularidad, capas y límite de líneas.
6. Actualizar `.agents/skills/pm-orchestrator/SKILL.md` integrando el cuestionario arquitectónico en R1 / Grilling.
7. Actualizar `.agents/skills/rigorous-qa-auditor/SKILL.md` añadiendo el chequeo de límite de líneas y cohesión modular.
8. Tildar los criterios de aceptación (`- [x]`) y transicionar a `review` mediante `node scripts/gate-qa.mjs submit PLAY-024`.
9. Ejecutar la certificación mecánica del gate vía `npm run gate:qa PLAY-024` para promover el ítem a `status: ready`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementado e integrado transversalmente en el core de `@gripm/playbook`:
- `AGENTS.md`: regla no negociable de Arquitectura Previa y Modularidad Estricta (< 1000 LOC).
- `.agents/TEAM_PLAYBOOK.md`: reflejado en la matriz de handoff de Principal Engineer y en las Fases 1, 3 y 4 del Delivery Flow.
- `.agents/skills/principal-engineer/SKILL.md`: sección 2 enriquecida con directiva técnica Architecture-First, techo de 1000 LOC, rango óptimo 150-500 LOC y desacoplamiento en 4 capas (Presentación/IO, Dominio/Negocio, Infraestructura/Persistencia, Estado/Coordinación).
- `.agents/skills/pm-orchestrator/SKILL.md`: R1 Gate, tabla de Grilling Session y DoD actualizados con el chequeo de arquitectura y presupuesto de archivo.
- `.agents/skills/rigorous-qa-auditor/SKILL.md`: Doble compuerta y Auditoría Headless #7 agregada con rechazo automático a archivos >= 1000 LOC o God-Files.
- `docs/sprints/SPRINT_SPEC_TEMPLATE.md`: plantilla actualizada con chequeos arquitectónicos y de límites modulares.
- Verificación: `npm run check:all` en verde al 100% (136 tests unitarios y suite de validación libre de errores).
<!-- SECTION:NOTES:END -->
