---
id: PLAY-031
title: "Demo en terminal (GIF/VHS) en el primer fold del README"
status: draft
created_date: '2026-10-21'
updated_date: '2026-10-21'
labels:
  - "adoption"
  - "docs"
  - "show-dont-tell"
dependencies:
  - PLAY-030
priority: medium
type: improvement
estimate: 5
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
El valor central del framework (dev tilda ACs -> QA ciego certifica -> item en `ready`) no es visible en el README: un lector tiene que leer tres documentos para entender el loop. El plan original de "golden repo" pedia un hook visual en el primer fold. Registro este item porque quedo fuera de PLAY-029 (alcance editorial) y fuera de PLAY-030 (alcance CLI/adaptadores).

Depende de PLAY-030 porque el demo debe grabar el CLI y el quickstart finales: grabarlo antes obligaria a re-grabar todo cuando cambie el onboarding, que es trabajo tirado.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Un tape de VHS reproducible, commiteado en `docs/demo/`, que graba el loop de entrega completo en 15 segundos o menos (reporte del usuario -> dev tilda ACs y corre tests headless -> QA en contexto limpio corre `gate:qa` -> item en `ready`).
- [ ] #2 El render (GIF o MP4) queda commiteado y embebido en el primer fold del README, debajo del titular, con ancho acotado para no romper el render en mobile.
- [ ] #3 El demo usa unicamente comandos que existen en este repo y salidas reales: sin terminal ficticia ni output maquetado.
- [ ] #4 Queda documentado el comando exacto para regenerar el render cuando cambie el CLI o la salida de los scripts.
- [ ] #5 `npm run check:all` pasa con 0 errores (el asset no debe romper link checks ni limits de LOC).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Escribir el tape en `docs/demo/` apuntando a scripts reales del repo en un directorio temporal descartable.
2. Renderizar con VHS y commitear el resultado.
3. Insertarlo en el README con ancho acotado y texto alternativo.
4. Documentar la regeneracion junto al tape, no en el README.
5. Correr `npm run check:all`.
<!-- SECTION:PLAN:END -->
