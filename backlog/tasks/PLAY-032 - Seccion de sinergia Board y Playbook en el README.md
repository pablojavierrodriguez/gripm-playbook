---
id: PLAY-032
title: "Mencion breve de gripm Board como complemento en el README"
status: done
created_date: '2026-10-21'
updated_date: '2026-10-21'
labels:
  - "adoption"
  - "docs"
priority: medium
type: improvement
estimate: 1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
El README no menciona `gripm` en ninguna linea. Quien aterriza aqui no tiene por que saber que existe un board visual que lee el mismo backlog. Se agrega **una sola linea** de mencion, como complemento opcional.

**Rescoping decidido por el PO durante la implementacion.** El alcance original pedia una seccion completa con tabla comparando ambos proyectos y explicando la integracion. El PO lo rechazo: el README del playbook debe concentrarse en el playbook, sin enroscarse, y `gripm` solo vale como una mencion de complemento. La seccion grande se elimino y se dejo un unico tip. El PO dejo ademas claro que este repo no debe ir al repo de `gripm` a investigar: el foco es el playbook.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 El README menciona `gripm` como board visual opcional que lee el mismo backlog, en una sola linea (un tip), sin seccion ni tabla comparativa.
- [x] #2 La mencion no califica a ninguno de los dos proyectos de confuso ni establece una comparacion extensa; el texto se mantiene breve.
- [x] #3 `npm run check:all` pasa con 0 errores y el unico link agregado (a `https://github.com/pablojavierrodriguez/gripm`) es externo, por lo que no introduce rutas relativas que el validador tenga que resolver.
<!-- AC:END -->

## Verificacion

<!-- SECTION:VERIFY:BEGIN -->
La mencion es un bloque `> [!TIP]` en `README.md`, dentro de la seccion "Where the work lives":

> Prefer a visual board? `gripm` is the optional companion that reads the same `backlog/tasks/*.md` files in a browser. The two projects are independent; this framework runs fine without it.

Evidencia por AC:

- **#1** La seccion `## One workflow, two projects: the Board and the Playbook` fue eliminada del README. La unica presencia de `gripm` como board es el tip de una linea.
- **#2** El tip no usa la palabra "confuse" ni ninguna autocalificacion; describe `gripm` como companion opcional e independiente.
- **#3** `npm run check:all` en verde: validate + check:loc + **332/332 tests**. El link agregado es `https://`, que `checkMarkdownLinks` salta; no hay rutas relativas nuevas.

Riesgo residual honesto: la afirmacion de que `gripm` lee `backlog/tasks/*.md` se verifico contra el README de `gripm` (su linea 64, "markdown backlog (`backlog/tasks/*.md`)") durante la iteracion anterior; este item no vuelve a auditar ese repo por decision del PO. El link externo no se valida con ningun gate.
<!-- SECTION:VERIFY:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Eliminar la seccion grande que se habia agregado en la cabecera del README.
2. Agregar un unico tip en "Where the work lives" mencionando `gripm` como board visual opcional sobre el mismo backlog.
3. Correr `npm run check:all`.

## Rescoping y desvinculacion (decisiones registradas)

**Rescoping por el PO.** El alcance original (seccion con tabla comparando `gripm` y `@gripm/playbook`, mas explicacion del camino de integracion) se rechazo durante la implementacion. El README del playbook debe concentrarse en el playbook; `gripm` solo como una mencion de complemento, sin enroscarse. El PO senalo ademas que este repo no debe ir al repo de `gripm` a investigar terminologia. La seccion grande se elimino y se dejo un tip de una linea. Los ACs se reescribieron para reflejar el alcance minimo real.

**Desvinculacion de PLAY-030.** El item nacio con `dependencies: [PLAY-030]`, pero ese vinculo era de secuenciacion por conflicto de archivo, no un prerequisito funcional. PLAY-030 ya fue commiteado (`047e9fe`), por lo que el riesgo de conflicto desaparece. El gate de `review -> ready` exige que toda dependencia este en `done` (deploy real); mantener el vinculo dejaria este item de documentacion bloqueado hasta publicar el paquete. El propio gate contempla `done` **or unlinked** como resolucion valida, asi que se desvinculo.
<!-- SECTION:PLAN:END -->
