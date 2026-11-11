---
id: PLAY-063
title: "Skill canónica release-management y protocolo formal de entrega en Playbook"
status: done
created_date: '2026-11-08'
updated_date: '2026-11-10'
labels: []
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
El flujo ágil de entrega en Playbook define formalmente: `draft` ➔ `doing` ➔ `review` ➔ `ready` ➔ `Release Management` ➔ `done`. Sin embargo, Playbook cuenta con skills para PM, UX, Dev y QA, pero carecía de una skill canónica para `release-management`. Esto provocó que proyectos consumidores (como DOM) crearan skills ad-hoc o que Gripm dispersara sus reglas en AGENTS.md.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  1. Crear la skill canónica `.agents/skills/release-management/SKILL.md` en `@gripm/playbook`.
  2. Definir el protocolo universal de release en 6 fases:
     - Fase 0: Auditoría pre-corte (`git log main..dev`, diff stat, cero ramas sucias).
     - Fase 1: Quality Gate previo (Pirámide de Verificación completa pasando en verde).
     - Fase 2: Determinación objetiva SemVer 2.0 (Major, Minor, Patch).
     - Fase 3: Consolidación de notas 100% User-Facing (cero IDs internos `DEV-XXX`/`SPEC-XXX`, regla Anti-Em-Dash `-`).
     - Fase 4: Protocolo Git canónico (`dev` ➔ `main` ➔ `dev`) con confirmación verbal explícita para commit y push.
     - Fase 5: Invocación del Deploy Hook del proyecto (npm publish, script de hosting, o deploy cloud) que justifica la transición de estado.
     - Fase 6: Reconciliación post-deploy en Backlog (`ready` ➔ `done` con `releasedAt: vX.Y.Z`).
  3. Actualizar `TEAM_PLAYBOOK.md` y `STATE_MACHINE.md` para referenciar formalmente a `release-management` como el rol/skill ejecutor de la transición `ready` ➔ `done`.
  4. Incluir `release-management` en el manifiesto de sincronización (`.playbook-manifest.json`, `selection.mjs`) para que se distribuya a los proyectos consumidores vía `playbook sync` / `playbook init`.
- **Out-of-Scope:**
  - Comandos de despliegue específicos de proyectos individuales (cada consumidor define su propio hook).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 .agents/skills/release-management/SKILL.md existe en @gripm/playbook con las 6 fases universales y guardrails de calidad documentados.
- [x] #2 TEAM_PLAYBOOK.md y STATE_MACHINE.md documentan formalmente la skill release-management como dueña de la transición ready -> done.
- [x] #3 .playbook-manifest.json y los scripts de distribución (selection.mjs, init.mjs) incluyen la skill release-management.
- [x] #4 Los checks de calidad del playbook (npm run check:all) pasan en verde (0 errores de lint, tests y LOC).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Crear `.agents/skills/release-management/SKILL.md` con frontmatter canónico y el protocolo de 6 fases:
   - Fase 0: Auditoría pre-corte (`git log main..dev`, diff stat, ramas limpias).
   - Fase 1: Quality Gate previo (Pirámide de Verificación completa).
   - Fase 2: Determinación objetiva SemVer 2.0 (Major, Minor, Patch).
   - Fase 3: Consolidación de notas 100% User-Facing (cero IDs internos, regla Anti-Em-Dash `-`).
   - Fase 4: Protocolo Git canónico (`dev` -> `main` -> `dev`) con confirmación verbal humana explícita.
   - Fase 5: Invocación del Deploy Hook del proyecto.
   - Fase 6: Reconciliación post-deploy en Backlog (`ready` -> `done` con `releasedAt: vX.Y.Z`).
2. Actualizar `.agents/TEAM_PLAYBOOK.md` y `.agents/STATE_MACHINE.md` documentando la skill `release-management` como dueña de `ready` -> `done`.
3. Actualizar `.playbook-manifest.json`, `scripts/lib/selection.mjs`, y `scripts/sync-playbook.mjs` registrando `release-management`.
4. Ejecutar validaciones y tests (`npm run check:all`).
<!-- SECTION:PLAN:END -->
