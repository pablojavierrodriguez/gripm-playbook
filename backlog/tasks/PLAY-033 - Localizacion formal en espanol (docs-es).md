---
id: PLAY-033
title: "Localizacion formal en espanol (docs/es/)"
status: ideas
created_date: '2026-10-21'
updated_date: '2026-10-21'
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
- [ ] #1 Decision de producto registrada: el playbook ofrece localizacion en `docs/es/` o declara explicitamente que es solo-ingles (en el README y en la guia de adopcion).
- [ ] #2 Si se localiza, `docs/es/` contiene copias traducidas de la capa que si consume el usuario, con una politica de frescura documentada (que pasa cuando el original en ingles cambia).
- [ ] #3 Ningun archivo mezcla dos idiomas en el mismo documento, y el sync al consumidor no puede instalar una mezcla por accidente.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Resolver la decision de producto con el PO.
2. Si es "solo-ingles", cerrar este item y dejar la declaracion escrita.
3. Si es "localizar", refinar alcance y politica de frescura antes de moverlo a `draft`.
<!-- SECTION:PLAN:END -->
