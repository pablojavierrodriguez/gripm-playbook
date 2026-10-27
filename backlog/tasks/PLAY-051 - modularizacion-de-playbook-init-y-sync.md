---
id: PLAY-051
title: "Modularizacion de playbook init y sync: seleccion granular de roles, scripts y plantillas con presets rapidos"
status: ready
created_date: '2026-10-26'
updated_date: '2026-10-26'
labels:
  - "cli"
  - "onboarding"
  - "sync"
  - "dx"
  - "modular"
priority: high
type: feature
dependencies:
  - PLAY-037
  - PLAY-041
claimed_by: "antigravity:e159a2ac-4db3-4e69-b2e1-bb098846ea5a"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Actualmente `playbook init` (`scripts/init.mjs`) y `playbook sync` (`scripts/sync-playbook.mjs`) operan bajo un modelo 'todo o nada':
1. Inyectan silenciosamente 5 scripts en `package.json` del proyecto consumidor sin preguntar al usuario si los desea ni cuales prefiere.
2. Instalan invariablemente los 6 roles de agentes (`pm-orchestrator`, `principal-engineer`, `qa-auditor`, `product-designer`, `market-researcher`, `code-level-ux-auditor`) en `.agents/skills/`.
3. Copian plantillas opcionales a `docs/` (`DOMAIN_TEMPLATE.md` y `SPRINT_SPEC_TEMPLATE.md`) sin consultar si el proyecto utilizara sprints o glosario de dominio.
4. Al configurar Gripm Board, clavan una configuracion rigida (`BOARD_DEFAULTS`) sin ofrecer modulos ni opciones del Cockpit.

Bajo la vision de Gripm Suite y el principio de '100% ofrecido, 0% impuesto', esta tarea modulariza el init y sync de Gripm Playbook:
- Soporte para **Modo Rapido** (defaults de confianza) vs **Componente por Componente** (control total mediante multi-select).
- Seleccion granular de **Roles de Agentes** a instalar en `.agents/skills/`.
- Seleccion granular y opt-in de **Scripts en package.json** (`gate:qa`, `gate:review`, `audit:ux`, `check:loc`, `validate:commit`).
- Seleccion granular de **Plantillas en docs/** (`DOMAIN_TEMPLATE.md`, `SPRINT_SPEC_TEMPLATE.md`).
- Persistencia de los componentes seleccionados en `.gripm/playbook-lock.json` (`selectedSkills`, `selectedScripts`, `selectedTemplates`) para que subsecuentes `playbook sync` respeten lo que el usuario eligio no instalar y no lo vuelvan a forzar.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 scripts/init.mjs ofrece selector de modo: 'Rapido (Baterias incluidas)' y 'Componente por componente (Control total)'.
- [x] #2 En modo Componente por componente, se presenta un multi-select con los roles de agentes (coreSkills), permitiendo elegir que roles instalar en .agents/skills/.
- [x] #3 La adicion de scripts a package.json es opt-in y permite seleccionar individualmente cuales incorporar (gate:qa, gate:review, audit:ux, check:loc, validate:commit).
- [x] #4 La copia de plantillas a docs/ (DOMAIN_TEMPLATE.md, SPRINT_SPEC_TEMPLATE.md) es opt-in y seleccionable.
- [x] #5 .gripm/playbook-lock.json registra los componentes seleccionados por el usuario, y scripts/sync-playbook.mjs sincroniza unicamente los componentes activos.
- [x] #6 Soporte para flags no interactivas en init y sync (--skills <lista>, --no-scripts, --no-docs, --yes).
- [x] #7 Tests en tests/ validando que la instalacion respete la seleccion granular sin inyecciones no autorizadas.
- [x] #8 npm run check:all (validate, check:loc, test) pasa con codigo 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extender `scripts/init.mjs` y `scripts/lib/adapters.mjs` para soportar la seleccion granular de roles, scripts y plantillas.
2. Modificar `scripts/sync-playbook.mjs` y `scripts/lib/sync-classifier.mjs` para leer y respetar la lista de skills y plantillas en el lockfile.
3. Asegurar que `addPlaybookScripts` solo agregue los scripts explicitamente autorizados por el usuario.
4. Agregar pruebas automatizadas en `tests/` cubriendo los modos rapido y componente por componente.
5. Validar con `npm run check:all`.
<!-- SECTION:PLAN:END -->
