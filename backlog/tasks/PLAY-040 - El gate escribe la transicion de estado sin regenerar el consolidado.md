---
id: PLAY-040
title: "El gate escribe la transicion de estado sin regenerar el consolidado y el commit siguiente se rechaza"
status: draft
created_date: '2026-10-22'
updated_date: '2026-10-22'
labels:
  - "gate"
  - "backlog"
  - "workflow"
priority: high
type: bug
estimate: 2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`scripts/gate-qa.mjs` escribe `status` en disco en dos transiciones: T1 (`submit`, doing a review) y T2 (review a ready), ambas via `mutateTaskFrontmatter`. **Ninguna de las dos regenera `BACKLOG.md`.**

El Backlog Guard del consumidor (`verify-backlog-sync.js`, hook `--hook`) rechaza cualquier commit cuyo `BACKLOG.md` este desfasado respecto a las tareas. Asi que el flujo mecanico completo queda roto en un punto que nadie documenta:

```
node scripts/gate-qa.mjs submit DEV-326    -> escribe doing a review. EXIT 0.
npm run backlog:check                      -> EXIT 1: BACKLOG.md desactualizado.
npm run backlog:sync                        -> EXIT 0.
node scripts/gate-qa.mjs DEV-326           -> GATE PASSED, escribe ready. EXIT 0.
npm run backlog:check                       -> EXIT 1: BACKLOG.md desactualizado otra vez.
npm run backlog:sync                        -> EXIT 0.
git commit                                  -> recien aqui pasa el guard.
```

Medido en gripm el 2026-10-22 durante la certificacion de DEV-326: **dos** syncs de mas, ambos provocados por el propio gate. El gate es la herramienta que certifica que el repo esta listo para commitear, y cada corrida lo deja en un estado que el hook de pre-commit rechaza.

El punto ciego es estructural. El gate escribe un archivo y no conoce el consolidado que lo refleja. No es un bug de implementacion puntual: es que la transicion y el consolidado estan en capas que no se hablan.

**Nota de alcance:** `scripts/gate-qa.mjs` tiene 147 lineas de diff sin commitear en este repo por PLAY-037 (portabilidad de rutas para consumidores). Ese trabajo es ortogonal a este hallazgo, pero comparte archivo: verificar el estado antes de tocar, y re-sincronizar el alcance si PLAY-037 lo reubica.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Despues de que el gate escribe una transicion (`submit` o T2), `npm run backlog:check` sale con codigo 0 sin que el usuario corra `backlog:sync` a mano.
- [ ] #2 La regeneracion del consolidado ocurre solo si la verificacion previa paso, respetando el contrato ya documentado en `verify-backlog-sync.js:363-365`: un commit rechazado nunca deja el consolidado reescrito como efecto secundario.
- [ ] #3 El gate no stagea nada. La regla "un hook verifica, no muta" aplica tambien a la CLI: regenerar el consolidado no equivale a `git add BACKLOG.md`.
- [ ] #4 Un consumidor sin `BACKLOG.md` en disco (proyecto que aun no lo genero) no recibe error: la regeneracion se omite en silencio.
- [ ] #5 `npm run check:all` sale con 0 tras el cambio.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Localizar el punto exacto en `gate-qa.mjs` donde ambas transiciones persisten el `status`.
2. Invocar la exportacion del consolidado ahi, con la misma guarda de existencia que ya usa el hook.
3. Correr `check:all`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Por que es alta prioridad y no un detalle de DX.** El gate existe para eliminar la certificacion manual. Hoy elimina la parte de "verificar" y devuelve la parte de "escribir" al usuario, que tiene que recordar dos comandos intercalados. Es la misma promesa rota en el mismo lugar donde DEV-326 la arreglaba: el fork del gate en gripm tampoco escribia, y el canon si pero a medias.

**Relacion con PLAY-034.** Esa tarea mostro que el consumidor no recibe `package.json` y por eso no tiene los alias npm. Si la solucion aqui termina siendo invocar un script npm desde el gate, conviene usar la forma `node` directa, que PLAY-034 ya establecio como norma para todo lo que viaja al consumidor.
<!-- SECTION:NOTES:END -->
