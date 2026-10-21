---
id: PLAY-034
title: "La instruccion `npm run gate:qa` falla para el consumidor (el alias npm no esta instalado)"
status: ready
created_date: '2026-10-21'
updated_date: '2026-10-21'
labels:
  - "docs"
  - "adoption"
  - "onboarding"
priority: medium
type: bug
estimate: 2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Los archivos de instrucciones que el consumidor recibe le ordenan correr `npm run gate:qa <ID>`, pero ese comando no existe en su repo. El alias npm `gate:qa` vive en `package.json`, y `package.json` **no esta en `manifest.core`**, por lo que `sync` nunca lo instala en el repo del consumidor.

Verificado en el repo fuente:

- `scripts/gate-qa.mjs` **si esta en `core`**, junto con sus modulos `lib/frontmatter.mjs`, `lib/pyramid.mjs`, `lib/task-inspection.mjs` y `lib/terminal.mjs`. El archivo del gate si llega al consumidor.
- `package.json` **no esta en `core`** (esta fuera del manifest), asi que el script npm `gate:qa` no se instala.
- `scripts/init.mjs` (PLAY-030) **no inyecta** el script en el `package.json` del consumidor; solo lo lee para detectar stack.

Resultado: un consumidor que sigue la instruccion recibe `Missing script: gate:qa`. Es un defecto documental y de packaging a la vez: la doc invoca un alias que nunca se instala, aunque el binario subyacente si esta presente. `node scripts/gate-qa.mjs <ID>` funcionaria hoy mismo.

Este defecto quedo fuera de PLAY-029 (alcance editorial) y de PLAY-030 (alcance CLI/adaptadores): los adaptadores nuevos si usan `node scripts/gate-qa.mjs`, pero `AGENTS.md` y los skills del core conservan la instruccion vieja.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Resolucion elegida y registrada: **(a) sustituir la invocacion npm por la forma `node`** en la documentacion cara al consumidor. `npm run gate:qa <ID>` pasa a `node scripts/gate-qa.mjs <ID>`. Se descarto (b) inyectar el script en el `package.json` del consumidor porque exige mutar un archivo que es del consumidor, con riesgo de pisar sus propios scripts.
- [x] #2 La sustitucion se aplica a **todas** las invocaciones de `npm run gate:qa` en los archivos que el consumidor recibe (`AGENTS.md`, `.agents/TEAM_PLAYBOOK.md`, `.agents/STATE_MACHINE.md`, skills `pm-orchestrator` y `qa-auditor`) **y** en `README.md`. El README entra en el alcance: aunque documenta este repo, es lo primero que lee un consumidor en npm/GitHub y ya usa la forma `node` en L116-117 (`node scripts/gate-qa.mjs start`), asi que unificarla elimina la inconsistencia interna.
- [x] #3 `npm run audit:ux` (TEAM_PLAYBOOK L46) sufre la misma causa raiz y se sustituye igual por `node scripts/audit-ux-code.cjs`, porque `scripts/audit-ux-code.cjs` si esta en `core`. Dejarlo roto al lado del gate arreglado seria incoherente.
- [x] #4 Las referencias de **concepto** (no invocacion) al gate quedan como `gate:qa`: `AGENTS.md` L36 (`still requires gate:qa`), `pm-orchestrator` L115 y `README` L62. Cambiarlas produciria prosa ilegible (`requires node scripts/gate-qa.mjs`).
- [x] #5 La sustitucion arregla **unicamente** comandos cuyo binario esta en `core`. `npm run validate` en `.agents/TEAM_PLAYBOOK.md` L142 (un archivo que el consumidor **si** recibe) comparte la misma causa raiz pero **no** admite el fix: `scripts/validate-repo.mjs` no esta en `core`, asi que ni `npm run validate` ni `node scripts/validate-repo.mjs` funcionarian en el consumidor. Queda **fuera** y se reporta como hallazgo que necesita decision propia (anadir el binario al core, o dejar de prometerlo).
- [x] #6 `README.md` se aclara como **landing page de npm, no archivo instalado**: no esta ni en `core` ni en `preserved`. Sus comandos (`validate`, `gate:review`, `check:all`, `audit:ux:strict`, `audit:ux:baseline`) **si** funcionan en este repo. Solo se unifico `npm run gate:qa` a la forma `node` por consistencia interna con L116-117, que ya usan `node scripts/gate-qa.mjs start`/`unblock`. `gate:review` y `check:all` permanecen en forma npm porque su binario no esta en core: unificarlos daria una falsa apariencia de que el README es 100% copy-pasteable para el consumidor, cosa que no es.
- [x] #7 `npm run build` (AGENTS L63, TEAM_PLAYBOOK L145, README L272) **no** se toca: es el build del propio proyecto del consumidor, no un script de gripm.
- [x] #8 `npm run check:all` pasa con 0 errores tras el cambio (332/332 tests, 72 suites).
- [x] #9 **Fix post-QA (invariante T_ready-immutability).** La QA ciego (subagente limpio) hallo que el barrido inicial subescalo el alcance: el inventario solo cubrio los 5 archivos donde aparecia `npm run gate:qa`, no **todos** los archivos core. Se reabrio el item a `doing` (STATE_MACHINE L77: un fix post-QA invalida la certificacion y debe recorrer T1/T2 de nuevo) y se sustituyeron las 4 lineas restantes de **mismo defecto** en archivos que el consumidor **si** recibe y cuyo binario **si** esta en core: `.agents/skills/code-level-ux-auditor/SKILL.md` L26 (forma `node scripts/audit-ux-code.cjs --update-baseline`, ya usada en L21-25) y L32 (prosa), mas `scripts/audit-ux-code.cjs` L1009 y L1204 (la **propia salida del binario** instruia `npm run audit:ux` al consumidor).
- [x] #10 **Hallazgos reportados, deliberadamente fuera de este fix** (mismo origen: `package.json` no viaja al consumidor, pero no admiten sustitucion porque su binario no esta en core o es ambiguo): (a) `npm run validate` en `TEAM_PLAYBOOK.md` L142; (b) `npm run lint:anti-slop` en `principal-engineer/SKILL.md` L215, que ademas no existe ni en este `package.json` (lectura ambigua: recomendacion de CI propia del consumidor vs script ausente); (c) en `README.md` (landing page, no instalado) `validate`, `gate:review` y `check:all`. Todos requieren decision propia del PO, no se resuelven por sustitucion.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decidir la resolucion (a) o (b) y registrarla aqui antes de tocar nada.
2. Si (a): sustituir `npm run gate:qa` por `node scripts/gate-qa.mjs` en los archivos cara al consumidor; decidir alcance de `README.md`.
3. Si (b): añadir al onboarding la inyeccion del script `gate:qa` en el `package.json` del consumidor, sin pisar un `package.json` que ya tenga el script.
4. Correr `npm run check:all`.

## Notas de alcance y riesgo

**Por que no es un find-replace automatico sin mas.** El cambio toca los documentos canonicos del framework (`AGENTS.md`, `TEAM_PLAYBOOK.md`, `STATE_MACHINE.md` y dos skills), que fueron estandarizados a ingles y certificados por QA ciego en PLAY-029. Reescribirlos a vuela plomo la víspera de un release contradice la disciplina del propio framework. Si el PO decide incluirlo en 2.6.0, debe pasar por el flujo normal (doing -> review -> QA ciego); si no, es un candidato a fast-follow.

**Decision de alcance pendiente.** `README.md` documenta este repo, donde `npm run gate:qa` si funciona, pero tambien es lo primero que lee un consumidor en npm/GitHub. Cambiarlo o no es decision del PO, no una consecuencia mecanica.

**Riesgo bajo en verificacion.** Ningun test ni script fija el string `npm run gate:qa` (verificado: 0 coincidencias en `tests/` y `scripts/`), y el validador no lo caza. `node scripts/gate-qa.mjs` funciona en el mantenedor y en el consumidor por igual.
<!-- SECTION:PLAN:END -->
