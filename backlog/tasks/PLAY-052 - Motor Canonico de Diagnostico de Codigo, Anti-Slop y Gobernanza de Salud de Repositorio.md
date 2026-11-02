---
id: PLAY-052
title: "Motor Canonico de Diagnostico de Codigo, Anti-Slop y Gobernanza de Salud de Repositorio"
status: ready
created_date: '2026-11-01'
updated_date: '2026-11-01'
labels: []
dependencies:
  - PLAY-053
  - PLAY-054
  - PLAY-055
  - PLAY-056
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Épica paraguas para establecer en @gripm/playbook el motor canónico de diagnóstico estático, anti-slop y gobernanza de salud de repositorios para desarrollo con agentes de IA.

Históricamente, Playbook distribuía reglas individuales como check-loc.mjs y audit-ux-code.cjs. Esta iniciativa incorpora el motor integral audit-engine.mjs como la fuente única de la verdad (SSOT) para métricas de calidad de código, límites modulares (<1000 LOC), supresiones de tipos y detección de deuda oculta, manteniendo 0 dependencias externas y sincronización criptográfica hacia proyectos consumidores (incluido @gripm/board).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 #1 audit-engine.mjs canónico instalado en scripts/ e incluido en .playbook-manifest.json bajo core.
- [x] #2 #2 Suite de pruebas exhaustiva en tests/audit-engine.test.mjs pasando con 0 fallas (detección de stack, LOC, anti-slop, TODOs).
- [x] #3 #3 gate-qa.mjs integra la compuerta mecánica de salud de código antes de certificar tareas a ready.
- [x] #4 #4 Skills pm-orchestrator y principal-engineer actualizadas con el protocolo de diagnóstico inicial al abordar codebases.
- [x] #5 #5 selection.mjs e init.mjs ofrecen audit:repo como script modular opt-in respetando el principio 100% ofrecido, 0% impuesto.
- [x] #6 #6 npm run check:all pasa con código de salida 0 en gripm-playbook sin regresiones ni violaciones anti-em-dash.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Canonical implementation of `scripts/audit-engine.mjs` with zero external dependencies and inclusion in `.playbook-manifest.json` and fallback lists (PLAY-053).
2. Comprehensive unit test suite with 36 tests in `tests/audit-engine.test.mjs` (PLAY-053).
3. Integration of codebase health mechanical gate into `scripts/gate-qa.mjs` with `--force` override and package.json bin export for `audit-repo` (PLAY-054).
4. Update skills `principal-engineer`, `pm-orchestrator`, and `qa-auditor` with initial repo diagnostic protocols and health audit standards (PLAY-055).
5. Modular selection support for `audit:repo` and `audit:repo:strict` in `selection.mjs` and non-invasive sync with `@gripm/board` in `init.mjs` (PLAY-056).
6. End-to-end certification across all child stories under the Verification Pyramid (PLAY-052).
<!-- SECTION:PLAN:END -->
