---
id: PLAY-048
title: "Invariante Anti-Dev-Production-Deploy y protocolo de Release Deployment"
status: done
created_date: '2026-10-26'
updated_date: '2026-10-26'
labels: ["governance", "git-workflow", "release-management"]
dependencies: []
priority: high
type: feature
claimed_by: "antigravity:dev"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Al auditar los deployments de Vercel en Gripm Board (dogfooding), se detectó que los despliegues históricos de Producción figuraban con `branch: dev`.
La causa raíz es una contradicción metodológica no resuelta en el Playbook:
1. `git-workflow.md` estipulaba que *"The primary worktree stays on dev"*.
2. `STATE_MACHINE.md` exige despliegue real a producción para cerrar la transición T4 (`ready` ➔ `done`).
3. Al no existir una regla ni excepción explícita para la ejecución del deploy, las herramientas de despliegue (`vercel --prod`, CLIs cloud, etc.) se ejecutaban situados en `dev`, estampando en la infraestructura que producción corre desde la rama de integración y abriendo riesgo de State Lies.

Alcance:
1. Declarar la invariante **Anti-Dev-Production-Deploy** en `.agents/STATE_MACHINE.md`.
2. Documentar el protocolo canónico de Release Deployment en `.agents/rules/git-workflow.md` como la excepción controlada para la promoción a `main`.
3. Actualizar `.agents/skills/pm-orchestrator/SKILL.md` para verificar el origen en `main` antes de transicionar `ready` ➔ `done`.
4. Incorporar verificación en `tests/validate-repo.test.mjs` para garantizar la presencia y paridad de la regla en el framework.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] Declarar la invariante Anti-Dev-Production-Deploy en `.agents/STATE_MACHINE.md` estableciendo la prohibición de ejecutar herramientas de producción desde `dev`.
- [x] Documentar el protocolo canónico de Release Deployment en `.agents/rules/git-workflow.md` (integración `dev` ➔ `main` vía fast-forward y origen físico de despliegue en `main`).
- [x] Actualizar `.agents/skills/pm-orchestrator/SKILL.md` en el checklist de Release Delivery exigiendo la verificación de trunk `main` antes de mover a `done`.
- [x] Añadir prueba automatizada en `tests/validate-repo.test.mjs` que verifique la presencia y consistencia de la invariante Anti-Dev-Production-Deploy.
- [x] `npm test` y `npm run validate` pasan en verde con 0 errores.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Iniciar tarea con `gate-qa start PLAY-048`.
2. Editar `.agents/STATE_MACHINE.md` agregando la invariante Anti-Dev-Production-Deploy.
3. Editar `.agents/rules/git-workflow.md` documentando el protocolo canónico de Release Deployment y la excepción de checkout temporal a `main`.
4. Editar `.agents/skills/pm-orchestrator/SKILL.md` en la sección de Release Management.
5. Añadir test de validación en `tests/validate-repo.test.mjs`.
6. Ejecutar suite de pruebas y certificar con subagente auditor de QA en contexto limpio.
<!-- SECTION:PLAN:END -->
