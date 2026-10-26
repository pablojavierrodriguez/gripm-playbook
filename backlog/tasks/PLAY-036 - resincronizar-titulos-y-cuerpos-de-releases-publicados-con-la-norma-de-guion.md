---
id: PLAY-036
title: "Resincronizar titulos y cuerpos de releases de GitHub con la norma de guion y el CHANGELOG en ingles"
status: dismissed
created_date: '2026-10-21'
updated_date: '2026-10-24'
labels:
  - "release"
  - "docs"
  - "decision"
priority: low
type: decision
estimate: 2
dismissed_reason: "Decision de PO registrada: los releases historicos publicados en GitHub se conservan inmutables; la norma de guion estandar y revision tecnica aplica rigurosamente desde v2.3.0 en adelante, siendo CHANGELOG.md la fuente canonica de la verdad."
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La revision de `dev` tras la v2.6.0 verifico que lo publicado en GitHub diverge del CHANGELOG ya corregido:

1. **El cuerpo del release v2.6.0** todavia contiene las entradas originales en espanol de PLAY-031 ("ASCII diagrama estatico en el primer fold...") y PLAY-034 ("QA Ciega y Anti-Self-Certification..."), mientras que `CHANGELOG.md` ya las tiene en ingles tras `2b56029`. Verificado con `gh release view v2.6.0 --json body`.

2. **Cinco titulos de release usan em-dash como separador**, lo que la Standard Hyphen Rule de AGENTS.md cubre explicitamente ("release titles"): `v2.2.2 — Zero-network sync...`, `v2.2.1 — UX-010...`, `v2.2.0 — Punto de extension...`, `v2.1.0 — Anatomia de unidad...`, `v2.0.0 — Agentic Team Playbook`. Los releases desde v2.3.0 usan solo el numero, sin separador.

Los releases de GitHub son artefactos publicados e inmutables por convencion; corregirlos es decision del PO, no una consecuencia mecanica de arreglar el CHANGELOG local. Este item existe para que la decision quede registrada y no se pierda.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Decision del PO registrada sobre el cuerpo de v2.6.0: (b) se deja como quedo en el momento de publicacion y se anota que el CHANGELOG es la fuente canonica vigente.
- [x] #2 Decision del PO registrada sobre los 5 titulos con em-dash (v2.0.0, v2.1.0, v2.2.0, v2.2.1, v2.2.2): (b) se declaran exemptos como historico inmutable y la norma aplica desde v2.3.0 en adelante.
- [x] #3 La decision tomada queda reflejada en la documentacion que el consumidor ve: los releases historicos quedan como registro historico inmutable y CHANGELOG.md rige como fuente canonica.
- [x] #4 Los cambios, si los hay, no tocan tags ni el paquete npm publicado; solo metadatos del release en GitHub.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decision formal registrada del PO: declarar artefactos publicados en GitHub como historico inmutable.
2. Registrar formalmente en el backlog con `status: dismissed` y `dismissed_reason`.
<!-- SECTION:PLAN:END -->

## Notas de alcance y riesgo

**Por que es `ideas` y no `draft`.** Requiere una decision de producto previa (mutar o no artefactos publicados); sin esa decision no hay alcance implementable. Es el mismo patron que PLAY-033.

**Riesgo.** Solo metadatos de GitHub. `gh release edit` no mueve tags ni re-publica el paquete. El unico riesgo real es optico: un release re-titulado despues de su fecha de publicacion puede confundir a quien lo compare con un mirror o un fork.
<!-- SECTION:PLAN:END -->
