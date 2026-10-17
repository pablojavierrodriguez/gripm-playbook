---
id: PLAY-020
title: "El manifest y su fallback deben tener un unico origen de verdad"
status: done
created_date: '2026-10-12'
updated_date: '2026-10-17'
labels:
  - "packaging"
  - "tooling"
  - "correctness"
  - "validate-repo"
dependencies: []
priority: medium
type: improvement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Al publicar `gate:qa` en 2.3.0, el gate se desarrollo y se documento en tres skills del nucleo, pero **no se registro en `.playbook-manifest.json`**. Como `planFiles()` arma el plan de instalacion desde `manifest.core`, un consumidor que corria `npx @gripm/playbook sync` recibia skills que le ordenaban correr `npm run gate:qa` en un repo donde ese comando no existia.

El modo de falla es el que PLAY-015 vino a existenciaar, reintroducido por packaging: un agente obediente corre la compuerta, no encuentra nada, y reporta un pass de algo que nunca se ejecuto.

Lo que lo hacia invisible es que ningun check cruzaba las dos direcciones:

1. `validate-repo` verificaba que **lo que esta en el manifest exista en disco**, nunca que **lo que la documentacion menciona este en el manifest**.
2. `FALLBACK_CORE_FILES` en `sync-playbook.mjs` declara "Kept in sync with the manifest by scripts/validate-repo.mjs". Ese check no existia. Era una promesa en un comentario.

Corregido en 2.3.0 con dos checks nuevos (`checkDocsReferenceInstalledFiles` y `checkFallbackParity`). Queda el residuo: los dos siguen siendo **listas separadas que un humano tiene que mantener sincronizadas**, y el unico sintoma de la desalineacion es el check fallando.
<!-- SECTION:DESCRIPTION:END -->

## Out of scope

- Reemplazar el manifest por generacion automatica desde el filesystem. El manifest es declarativo a proposito: define el *plan de instalacion*, que no es lo mismo que el contenido del repo.
- Backfill de `validate-repo` para otros artefactos duplicados.

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Un check de `validate-repo` falla cuando un archivo del manifest no esta en `FALLBACK_CORE_FILES`, y viceversa
- [x] #2 Un check de `validate-repo` falla cuando la capa nucleo documenta un comando `scripts/*` que el manifest no instala
- [x] #3 Un test cubre ambos checks: mutar cualquiera de los dos debe hacerlos caer
- [x] #4 `FALLBACK_CORE_FILES` esta generating desde el manifest, o la duplicacion esta documentada con la razon de existir
- [x] #5 `npm run check:all` en verde
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Los checks ya existen en `validate-repo.mjs` desde 2.3.0. Falta cubrirlos con tests en `tests/`, hoy nadie los ejercita: mutarlos no cae nada.
2. Evaluar derivar `FALLBACK_CORE_FILES` del manifest en tiempo de import. Si se descarta, dejar el porque escrito en el comentario actual, que hoy promete una garantia que no existe.
3. Agregar `validate-repo` al step de CI si hoy no corre.
<!-- SECTION:PLAN:END -->

## Notes on why it was almost missed

<!-- SECTION:NOTES:BEGIN -->
La suite tenia 101 tests en verde y el gate era correcto en este repositorio. Lo que no habia era un consumidor. El defecto no era de logica sino de **alcance**: las pruebas cubrian la ejecucion del gate, no su instalabilidad.
<!-- SECTION:NOTES:END -->