---
id: PLAY-068
title: "Guia de adopcion anti-bloat y arquitectura de progressive disclosure en 4 capas"
status: done
claimed_by: "antigravity:47712f98-dbb2-45cf-8f50-02a1d15f0cf9"
created_date: '2026-11-09'
updated_date: '2026-11-10'
labels: ["docs", "playbook", "governance"]
dependencies: []
priority: medium
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Los proyectos que adoptan el Playbook tienden a engordar progresivamente su archivo raíz de instrucciones (`CLAUDE.md` / `AGENTS.md`) con decenas de micro-guardarraíles cada vez que surge un bug o post-mortem. Esto provoca context window bloat, degrada la atención de los modelos y diluye los invariantes principales.
Es necesario documentar formalmente la **Arquitectura en 4 Capas de Conocimiento Agéntico** (Progressive Disclosure) en el README y la guía de adopción, brindando lineamientos claros para mantener el archivo raíz en ~100-150 líneas.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Agregar sección en `README.md` explicando la Arquitectura en 4 Capas y la gobernanza anti-bloat de prompts.
  - Actualizar `.agents/TEAM_PLAYBOOK.md` detallando dónde debe residir cada tipo de conocimiento (router raíz, validaciones mecánicas, reglas de negocio en `.agents/rules/`, y protocolos en skills).
  - Preservar las pruebas de coherencia documental `manifest ⇄ documentation` en verde.
- **Out-of-Scope:**
  - Modificar scripts CLI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `README.md` incorpora la sección de Gobernanza Anti-Bloat y la pirámide de 4 capas de conocimiento (router, verificaciones mecánicas, reglas de dominio, skills de rol).
- [x] #2 `.agents/TEAM_PLAYBOOK.md` formaliza los lineamientos de tamaño y responsabilidades para `AGENTS.md` / `CLAUDE.md` (< 150 LOC).
- [x] #3 `npm run validate` valida la coherencia documental sin errores.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Actualizar `README.md`.
2. Actualizar `.agents/TEAM_PLAYBOOK.md`.
3. Ejecutar `npm run validate`.
<!-- SECTION:PLAN:END -->
