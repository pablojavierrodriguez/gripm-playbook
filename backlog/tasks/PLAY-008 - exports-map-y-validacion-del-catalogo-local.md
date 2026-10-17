---
id: PLAY-008
title: "Exports map y verificacion del catalogo local en validate-repo"
status: done
created_date: '2026-10-06'
updated_date: '2026-10-17'
labels:
  - "packaging"
  - "tooling"
  - "adoption"
dependencies:
  - PLAY-005
priority: medium
type: improvement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dos huecos que aparecieron al publicar el punto de extension (PLAY-005).

**1. El import del motor es un deep require.**

```js
const { auditProject } = require('@gripm/playbook/scripts/audit-ux-code.cjs');
```

Funciona porque el paquete no define un campo `exports`. En el momento en que se agregue uno -por ejemplo para restringir `main` o exponer el auditor con un nombre estable- **todos los deep requires externos se rompen**. El dia que se cree un `exports` map, los consumidores que hayan migrado con esta ruta reciben un error en runtime.

**2. `validate-repo` no conoce el catalogo local.** Verifica que el catalogo canonico ⇄ skill ⇄ manifiesto esten consistentes. No valida un catalogo propio del proyecto: ni sus IDs, ni sus checks, ni que no colisione con un ID canonico. El motor rechaza esas tres cosas al cargar, pero el error aparece tarde, en el momento de auditar, y no en el gate de consistencia.

Ademas, el error de colision actual dice "reserved canonical pattern" incluso cuando el ID colisiona con una firma canonica concreta y no con el patron. El mensaje correcto debe nombrar la firma colisionada especificamente.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `package.json` define un `exports` map con un nombre estable para el auditor (`"./audit"`, `"./gate"`, `"./check-loc"`)
- [x] #2 La ruta del import documentado sigue funcionando (deep require backwards-compatible `"./scripts/*"`)
- [x] #3 `validate-repo` valida un catalogo local declarado en `.uxaudit.json` si existe
- [x] #4 Un ID local que colisiona con una firma canonica da un mensaje que nombra la firma
- [x] #5 Un ID local con el patron reservado da un mensaje distinto del de colision
- [x] #6 `npm run check:all` en verde
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Transicionar a doing con `gate-qa.mjs start PLAY-008`.
2. Definir `exports` en `package.json` con entradas estables y comodin retrocompatible.
3. Actualizar `scripts/audit-ux-code.cjs` para incluir el titulo de la firma canonica en mensajes de colision.
4. Extender `scripts/validate-repo.mjs` para validar catalogos locales definidos en `.uxaudit.json`.
5. Agregar suite de tests para el `exports` map y catalogo local.
6. Verificar y tildar ACs.
7. Transicionar a review (`gate-qa.mjs submit PLAY-008`).
8. Certificar con subagente QA en contexto limpio (`gate-qa.mjs PLAY-008`).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Definido `exports` en `package.json` con `"./audit"`, `"./gate"`, `"./check-loc"` y `"./scripts/*"` para total retrocompatibilidad.
- Actualizado `scripts/audit-ux-code.cjs` para nombrar la firma canonica en colisiones.
- Agregada funcion `checkLocalCatalog` a `scripts/validate-repo.mjs`.
- Creada suite `tests/exports.test.mjs` con 4 tests cubriendo exports map, validacion y mensajes diferenciados.
<!-- SECTION:NOTES:END -->