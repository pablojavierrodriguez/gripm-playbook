---
id: PLAY-021
title: "Purificacion del core agnostico a dominio y erradicacion de prefijos hardcodeados"
status: done
created_date: '2026-10-17'
updated_date: '2026-10-17'
labels:
  - "architecture"
  - "governance"
  - "agnostic"
  - "clean-code"
dependencies: []
priority: high
type: tech_debt
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Auditar y sanear exhaustivamente el framework `@gripm/playbook` para garantizar que sea 100% agnostico al producto, dominio de negocio y stack tecnologico del consumidor:
1. Erradicar sesgos de dominio especificos (terminologia bancaria/financiera como balance negativo, pasivo, patrimonio, API de pagos o importes en ejemplos de invariantes y contratos).
2. Reemplazar esos ejemplos con invariantes universales de ingenieria de software: capacidades de inventario, limites de tasa (rate limiting), consistencia de unidades y normalizacion temporal/bytes.
3. Erradicar prefijos fijos de repositorios especificos (`DEV-XXX`, `PLAY-042`) en la documentacion maestra, plantillas y skills, estandarizandolos hacia `TASK-ID` o `[TASK-ID]`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 El core de skills y reglas no contiene terminos de dominio bancario o financiero especificos
- [x] #2 Los ejemplos de invariantes en `principal-engineer` utilizan abstracciones universales de software (capacidades, conteos, normalizacion de magnitudes)
- [x] #3 Se reemplazan referencias fijas a tareas (`DEV-XXX`) por placeholders canonicos (`TASK-ID` o `[TASK-ID]`)
- [x] #4 El comando de verificacion `npm run validate` ejecuta y aprueba la pureza del core
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspeccionar y reemplazar terminologia no agnostica en `.agents/skills/principal-engineer/SKILL.md`, `.agents/skills/pm-orchestrator/SKILL.md` y `docs/DOMAIN_TEMPLATE.md`.
2. Normalizar referencias fijas a IDs de tareas en `AGENTS.md` y plantillas de sprint.
3. Ejecutar `npm run check:all` para certificar la consistencia del repositorio.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Identificado durante la revision del playbook para uso multiplataforma agnostico sin sesgos de repositorios base.
<!-- SECTION:NOTES:END -->
