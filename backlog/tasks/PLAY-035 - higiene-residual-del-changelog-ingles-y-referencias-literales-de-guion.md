---
id: PLAY-035
title: "Higiene residual del CHANGELOG: entradas en espanol y referencia literal de em-dash"
status: draft
created_date: '2026-10-21'
updated_date: '2026-10-21'
labels:
  - "docs"
  - "changelog"
priority: low
type: improvement
estimate: 1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La revision de `dev` tras el commit `2b56029` ("eradicate em-dash from live files, english 2.6.0 entries") dejo dos residuos verificables en `CHANGELOG.md`, ambos fuera del alcance de ese commit pero inconsistentes con el estandar que el propio repo declara:

1. **Dos entradas en espanol sin traducir** en la seccion `2.0.1`:
   - L186: "- **Saneamiento P0 de skills de stacks**: Eliminadas todas las referencias residuales..."
   - L187: "- **Formato regional estandar**: Reemplazado el valor invalido `'regional-locale'`..."
   El commit tradujo las entradas espanolas de `2.6.0` pero no hizo un barrido completo del archivo.

2. **Una referencia literal a em-dash/en-dash** en L58 (entrada `PLAY-022`): "`Replaced artificial AI em-dashes (—) and en-dashes (–) with standard hyphens`". Es una meta-referencia entre backticks a los caracteres que la regla combate, no prosa con guion prohibido. Es defendible, pero cualquier escaneo automatico futuro la cazaria.

El file es la fuente de la que salen las notas de release publicadas (ver PLAY-036), asi que lo que quede aqui termina en GitHub/npm.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Las lineas L186 y L187 de `CHANGELOG.md` quedan en ingles tecnico, fiel al sentido original (saneamiento P0 de skills de stacks; formato regional BCP-47 `es-ES`), sin tocar el resto de la seccion 2.0.1.
- [ ] #2 Decision del PO registrada sobre L58: (a) se reescribe para no incluir los caracteres literales (ej. "em-dash and en-dash characters"), o (b) se mantiene como meta-referencia y se documenta la exencion en la norma (AGENTS.md o git-workflow.md) para que un escaneo futuro no la marque.
- [ ] #3 Decidida la politica sobre L58, queda registrado si se anade (o no) un chequeo de guiones (`U+2014`/`U+2013`) a `scripts/validate-repo.mjs`: si se anade, debe respetar la exencion decidida en #2; si no, queda anotado que la norma sigue siendo solo prosa.
- [ ] #4 `npm run validate` y `npm test` en verde tras el cambio.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Traducir L186 y L187 al ingles, manteniendo los identificadores tecnicos (`People.tsx`, `recharts-reporting`, etc.) intactos.
2. Preguntar al PO por L58 (mantener meta-referencia con exencion vs reescribir) y por si se quiere el chequeo en `validate-repo.mjs`.
3. Aplicar la decision y correr `npm run validate` + `npm test`.

## Notas de alcance y riesgo

**Alcance deliberadamente chico.** No entra aqui un barrido de em-dashes en `backlog/tasks/` (los items viejos PLAY-005, 006, 010, 013-018 y 022 los conservan): son registros internos de entrega, no documentacion que recibe el consumidor, y el commit `2b56029` se scopo explicitamente a "live files". Si el PO quiere erradicarlos tambien, es un item aparte.

**Riesgo.** Documental unicamente. Ningun test ni gate fija el string de esas dos lineas (verificado en la revision: 0 coincidencias en `tests/` y `scripts/`).
<!-- SECTION:PLAN:END -->
