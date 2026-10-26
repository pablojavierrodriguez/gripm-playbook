---
id: PLAY-033
title: "Localizacion formal en espanol (docs/es/)"
status: dismissed
dismissed_reason: "Decision de PO registrada: el core del framework y la capa instalable se mantienen en ingles tecnico unico como standard universal para evitar deriva y desfase de traducciones; el soporte de idioma local para conversaciones y documentacion del proyecto consumidor se parametriza de forma personalizada en su propio AGENTS.md mediante el asistente npx playbook init."
created_date: '2026-10-21'
updated_date: '2026-10-24'
labels:
  - "localization"
  - "decision"
dependencies: []
priority: low
type: feature
estimate: 8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAY-029 dejo todo el core en ingles tecnico, y el plan original de "golden repo" lo dejo explicito: si se quiere soporte en espanol, debe existir como localizacion formal en `docs/es/`, nunca mezclado en el mismo archivo. Eso no se hizo y tampoco se registro. Queda como item exploratorio porque es una decision de producto, no una tarea de implementacion.

Contexto que la vuelve real: el backlog de este repo y `docs/BACKLOG.md` se escriben en espanol porque son del repo propio y no llegan a los consumidores. La pregunta es si esa preferencia se extiende a la capa que si se instala.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Decision de producto registrada: el playbook declara explicitamente que su capa instalable es solo-ingles en documentacion y notas de release, permitiendo la parametrizacion de idioma del consumidor en su propio AGENTS.md.
- [x] #2 La politica queda establecida: no se mantiene docs/es/ duplicado en el core para evitar desincronizacion y deuda de traduccion.
- [x] #3 Ningun archivo mezcla dos idiomas en el mismo documento, y el sync al consumidor instala estrictamente archivos en ingles tecnico.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Resolver la decision de producto con el PO: adoptada la postura de mantener el core en ingles tecnico unico.
2. Registrar la declaracion en README.md en la seccion de Ecosystem Scope.
3. Marcar el item como dismissed con dismissed_reason explicitando la decision.
<!-- SECTION:PLAN:END -->
