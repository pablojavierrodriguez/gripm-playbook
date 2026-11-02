---
id: PLAY-053
title: "Motor estatico canonico audit-engine.mjs, tests de unidad e inclusion en manifiesto"
status: done
created_date: '2026-11-01'
updated_date: '2026-11-02'
labels: []
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establecer scripts/audit-engine.mjs en @gripm/playbook como la fuente canónica de análisis estático del framework.

El motor inspecciona el árbol de código sin dependencias externas (usando node:fs y node:path nativos):
- Detecta el stack tecnológico (React, Vue, Node, TypeScript, Python, etc.) y frameworks de testing.
- Computa presupuesto de modularidad (archivos con más de 1000 LOC y warning a partir de 500 LOC).
- Detecta patrones de código degradado / anti-slop (@ts-ignore, @ts-nocheck, eslint-disable, console.log residuales).
- Extrae deudas técnicas comentadas en código (TODO, FIXME, HACK, XXX) con número de línea y contexto.
- Calcula el índice de salud determinista de 0 a 100 puntos y soporta flags CLI (--strict, --format json, --quiet).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 #1 audit-engine.mjs copiado canónicamente a scripts/audit-engine.mjs en @gripm/playbook con cero dependencias externas.
- [x] #2 #2 .playbook-manifest.json incluye scripts/audit-engine.mjs en la lista core para distribución universal.
- [x] #3 #3 tests/audit-engine.test.mjs implementa cobertura unitaria completa de detección de stack, conteo LOC, regexes anti-slop y TODOs.
- [x] #4 #4 package.json de playbook expone los scripts audit:repo y audit:repo:strict.
- [x] #5 #5 node --test tests/audit-engine.test.mjs ejecuta y pasa con código 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Canonical engine creation: scripts/audit-engine.mjs ported with 0 external dependencies (native Node.js only), strict Anti-Em-Dash compliance, and modular size under 500 LOC (415 LOC) to preserve zero-warning check-loc guarantees.
2. Manifest and distribution integration: scripts/audit-engine.mjs registered in .playbook-manifest.json (core) and FALLBACK_CORE_FILES in scripts/sync-playbook.mjs.
3. Package.json updates: exposed scripts audit:repo and audit:repo:strict, and added ./audit-engine to the exports map.
4. Comprehensive test suite: created tests/audit-engine.test.mjs with 36 unit tests covering stack detection (Node, React, Vue, TypeScript, Python, Rust, Go), test detection, LOC counting, anti-slop patterns, TODO/FIXME/HACK/XXX extraction, deterministic health scoring, and CLI runner flags (--help, --format json, --quiet, --strict).
5. Quality verification: verified node --test tests/audit-engine.test.mjs and full npm run check:all with 437/437 passing tests.
<!-- SECTION:PLAN:END -->
