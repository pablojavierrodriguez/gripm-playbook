---
id: PLAY-058
title: "Modularidad total en init y sync: gobernanza opcional, presets de rigor y modo manual"
status: ready
created_date: '2026-11-02'
updated_date: '2026-11-03'
labels:
  - "cli"
  - "onboarding"
  - "modular"
  - "governance"
  - "dx"
dependencies:
  - PLAY-057
priority: high
type: feature
estimate: 5
claimed_by: "antigravity:pm-orchestrator"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
El flujo actual de `playbook init` y `playbook sync` (`PLAY-051`) permite elegir skills de `.agents/skills/` y plantillas de `docs/`, pero sigue imponiendo de forma rígida:
1. La instalación obligatoria de `.agents/TEAM_PLAYBOOK.md`, `.agents/STATE_MACHINE.md` y `.agents/rules/git-workflow.md` incluso si el usuario solo desea instalar una skill puntual (ej. `code-level-ux-auditor` o `principal-engineer`).
2. Un único nivel de rigor en la auditoría estática (`ux-rules.json` y `gate-qa.mjs`) donde preferencias estilísticas y editoriales (`UX-011` escala tipográfica, `UX-014` anti-em-dash) bloquean al mismo nivel que defectos críticos de accesibilidad o roturas de teclados móviles.
3. Falta de una opción explícita en la personalización para usuarios avanzados que deseen operar las transiciones de forma manual versus el modo automatizado por defecto.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  1. Extender `scripts/lib/selection.mjs`, `scripts/lib/sync-classifier.mjs` (`planFiles`), `scripts/init.mjs` y `scripts/sync-playbook.mjs` con la dimensión `rules` (`team-playbook`, `state-machine`, `git-workflow`) seleccionable en modo `custom` y mediante flag `--rules <list|all|none>`, con auto-poda si se desmarca.
  2. Incorporar soporte de **Presets de Rigor** (`preset: "pragmatic" | "strict" | "dogmatic"`) y **Modo de Automatización** (`automation: "automated" | "manual-override"`) en `.gripm/config.json` y `.gripm/.uxaudit.json`:
     - `pragmatic`: Activa por defecto solo reglas deterministas críticas de ingeniería y accesibilidad (excluyendo bloqueos estilísticos como `UX-011`, `UX-012`, `UX-013`, `UX-014`).
     - `strict`: Activa el catálogo completo de ergonomía, LOC (< 1000) y anti-slop.
  3. Soportar flags CLI no interactivas (`--preset <pragmatic|strict>`, `--rules <list>`) para integración directa desde `@gripm/board` sin doble interrogatorio.
- **Out-of-Scope:**
  - Crear reglas nuevas en `ux-rules.json`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `scripts/lib/selection.mjs` y `planFiles` en `scripts/lib/sync-classifier.mjs` soportan la selección granular de artefactos de gobernanza (`team-playbook`, `state-machine`, `git-workflow`) vía modo interactivo `custom` y flag `--rules <lista|all|none>`, persistiendo la elección en `.gripm/playbook-lock.json` y podando archivos desmarcados.
- [x] #2 `scripts/audit-ux-code.cjs` y `scripts/gate-qa.mjs` respetan el preset configurado en `.gripm/config.json` o `.gripm/.uxaudit.json` (`pragmatic` vs `strict`), evitando bloqueos por reglas estilísticas (`UX-011`, `UX-014`) cuando el proyecto opera en perfil `pragmatic`.
- [x] #3 `scripts/init.mjs` permite configurar el nivel de rigor (`pragmatic` vs `strict`) y el modo de operación (100% automatizado con excepciones humanas vs manual), exponiendo flags no interactivas (`--preset`, `--rules`) para consumo programático desde `gripm --init`.
- [x] #4 Suite de pruebas en `tests/selection.test.mjs` y `tests/audit-ux.test.mjs` validando el filtrado de `rules`, la auto-poda y el comportamiento de los presets `pragmatic` y `strict`.
- [x] #5 `npm run check:all` pasa con código 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ampliar `VALID_RULES` y `resolveSelection` en `scripts/lib/selection.mjs` y filtrar en `planFiles` (`scripts/lib/sync-classifier.mjs`).
2. Añadir soporte de `preset` (`pragmatic` | `strict`) en `scripts/audit-ux-code.cjs` y `scripts/gate-qa.mjs`.
3. Integrar prompts en modo `custom` y flags CLI (`--rules`, `--preset`) en `scripts/init.mjs` y `scripts/sync-playbook.mjs`.
4. Añadir pruebas unitarias e integración en `tests/` y ejecutar `npm run check:all`.
<!-- SECTION:PLAN:END -->
