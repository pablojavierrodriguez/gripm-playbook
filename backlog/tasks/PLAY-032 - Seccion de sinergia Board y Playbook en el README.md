---
id: PLAY-032
title: "Seccion de sinergia Board (Cockpit) y Playbook en el README"
status: draft
created_date: '2026-10-21'
updated_date: '2026-10-21'
labels:
  - "adoption"
  - "docs"
dependencies:
  - PLAY-030
priority: medium
type: improvement
estimate: 3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
El README del playbook no contiene la palabra "Board" ni "Cockpit" en ninguna linea: un lector nuevo no puede saber que `gripm` (el producto) y `@gripm/playbook` (el engine) son dos proyectos que conviven, ni como se relacionan. El plan original de "golden repo" tenia un paso entero dedicado a esto y quedo sin registrar.

Depende de PLAY-030 porque ambas tareas tocan el README y PLAY-030 reestructura su cabecera: secuencializar evita conflicto sobre el mismo archivo.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 El README contiene una seccion o tabla que define ambos proyectos por separado: `gripm` (Board / Cockpit: interfaz web y servidor MCP local para gestionar backlog y sprints en Markdown) y `@gripm/playbook` (Engine: metodologia, reglas de git, roles y gates mecanicos de calidad).
- [ ] #2 La seccion explica el camino de integracion (el board administra los items, el motor ejecuta los gates de entrega) y enlaza a ambos repos.
- [ ] #3 Ninguna afirmacion del texto es no verificable contra el codigo de ambos repos; la terminologia usada coincide con la que cada repo usa para si mismo.
- [ ] #4 `npm run check:all` pasa con 0 errores y todos los links relativos agregados resuelven.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verificar en el repo `gripm` la terminologia oficial de Board/Cockpit antes de escribir.
2. Escribir la seccion en el README en el punto donde hoy se presenta el proyecto.
3. Enlazar ambos repos con rutas oficiales.
4. Correr `npm run check:all`.
<!-- SECTION:PLAN:END -->
