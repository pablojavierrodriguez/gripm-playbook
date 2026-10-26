---
id: PLAY-050
title: "Reestructuracion del README bajo piramide invertida y progressive disclosure"
status: ready
created_date: '2026-10-26'
updated_date: '2026-10-26'
labels: ["docs", "ux", "onboarding", "craftsmanship"]
dependencies: []
priority: high
type: chore
claimed_by: "antigravity:dev"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
El README.md actual supera las 500 lineas y acumula cinco responsabilidades incompatibles en un unico archivo: pagina de aterrizaje, tutorial de inicio, especificacion profunda de arquitectura, catalogo de referencia de CLI/APIs y guia de contribucion interna del repositorio.

Esta sobrecarga oculta el comando principal de inicio (`npx @gripm/playbook init`) hasta la linea 213, triplica la explicacion de los estados y roles del loop de entrega, e incluye detalles de bajo nivel (como selectores AST JSX del auditor UX o garantias de hash del sync) en el flujo de lectura inicial.

Alcance:
1. Reestructurar README.md bajo la regla de la piramide invertida y progressive disclosure, reduciendo su longitud total a menos de 250 lineas (~180-220 lineas).
2. Ubicar el pitch y el Quickstart ("One Golden Path" con `npx @gripm/playbook init`) en el primer fold (primeras ~35 lineas).
3. Consolidar la explicacion del Hub Orchestrator, la disciplina de subagentes limpios de QA y los 3 modos operativos en un unico bloque visual coherente, eliminando repeticiones y el bloque redundante "Framework Summary".
4. Encapsular la configuracion avanzada del CLI/auditor UX y el puente poliglota para otros ecosistemas en bloques `<details>` colapsables o enlaces directos a su documentacion canonica.
5. Preservar enlaces markdown relativos validos, badges, e invariante de guion simple anti-em-dash (` - `).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 README.md reestructurado con Quickstart (`npx @gripm/playbook init`) visible en las primeras 40 lineas.
- [x] #2 Extension total de README.md reducida a menos de 250 lineas (~180-220 lineas), eliminando duplicaciones de estados y el bloque final "Framework Summary".
- [x] #3 Configuraciones avanzadas del auditor UX (JSON AST, programmatic API) y puente poliglota agrupadas en bloques colapsables `<details>` o enlaces a especificacion.
- [x] #4 Enlaces relativos a documentacion interna (.agents/STATE_MACHINE.md, .agents/TEAM_PLAYBOOK.md, CONTRIBUTING.md) completamente funcionales y validados.
- [x] #5 Invariante anti-em-dash respetada al 100% (cero em-dash ni en-dash, solo guion simple ` - `).
- [x] #6 `npm run check:all` (`npm run validate`, `npm run check:loc`, `npm test`) pasa con 0 errores.
<!-- AC:END -->
