---
id: PLAY-007
title: "onlyFile debería enganchar el componente renderizado y no el nombre del archivo"
status: ready
created_date: '2026-10-06'
updated_date: '2026-10-24'
labels:
  - "engine"
  - "correctness"
  - "authoring"
dependencies:
  - PLAY-005
priority: medium
type: improvement
estimate: 3
claimed_by: "antigravity:principal-engineer"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`onlyFile` (PLAY-005) resuelve por **nombre de archivo**. Es lo que el consumidor necesitaba para expresar "`truncate` dentro de un diálogo", y funciona, pero la forma en que funciona es frágil:

```json
"check": { "line": ["truncate"], "onlyFile": ["Modal", "Dialog"] }
```

Un diálogo definido en `Overlays.tsx` no se ve. Uno en `ConfirmModal.tsx`, sí. El comportamiento depende de cómo el proyecto nombró sus archivos, no de qué renderiza el componente.

La misma debilidad ya existía en el invariante `ENV-002` del consumidor, y fue parte de lo que abrió la pregunta de si debía promoverse al catálogo: el problema no es solo si una regla debe ser canónica, sino si la regla es correcta.

La solución refinada y aprobada por el PO agrega la semántica declarativa `withinComponent` en `check`: el árbol de parseo de unidades de JSX conoce la jerarquía de ancestros (`frame.parent`), permitiendo verificar si un elemento está contenido dentro de un componente padre (ej. `<Dialog>`, `<Modal>`, `<Dialog.Content>`) sin importar el nombre del archivo en disco.
<!-- SECTION:DESCRIPTION:END -->

## Out of scope

- Cambios de comportamiento en las firmas canónicas existentes (UX-001 a UX-015).
- Un motor de reglas programable con selectores complejos; el catálogo declarativo sigue siendo el contrato estricto (`withinComponent: ["Dialog", "Modal"]`).
- Romper o eliminar `onlyFile`: se preserva por retrocompatibilidad para reglas que genuinamente filtran por path.

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 El motor de auditoría (`scripts/audit-ux-code.cjs`) soporta `check.withinComponent` como array de nombres de componente (soporta matching de nombre exacto y componentes con notación de punto como `<Dialog.Content>`).
- [x] #2 Un elemento o texto dentro de un componente objetivo (ej. `<Dialog>`) declarado en un archivo con cualquier nombre (ej. `src/Overlays.tsx`) es detectado y reportado si viola la condición.
- [x] #3 `onlyFile` se mantiene 100% funcional y retrocompatible para filtrado por ruta de archivo.
- [x] #4 La documentación de authoring en `.agents/skills/code-level-ux-auditor/SKILL.md` y `README.md` documenta la sintaxis y distingue `withinComponent` de `onlyFile`.
- [x] #5 Tests automatizados en `tests/audit-ux.test.mjs` validando `withinComponent` con anidamientos profundos, nombres de archivo no obvios (`Overlays.tsx`), componentes con punto y coexistencia con `onlyFile`.
- [x] #6 `npm run check:all` (`validate`, `check:loc`, `test`) en verde con 0 fallos.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Modelado de Ancestros en `buildUnits` (`scripts/audit-ux-code.cjs`):**
   - En el loop de cierre de frames (`closeFrame`), propagar los nombres de componentes ancestros (`ancestors: string[]`) desde `frame.parent` a cada `unit`.
   - Normalizar nombres de componentes para soportar tanto tags simples (`Dialog`) como compuestos (`Dialog.Content`, extrayendo base y nombre completo).
2. **Evaluación de `withinComponent` en `lineMatches`:**
   - Incorporar en `lineMatches` la validación de `check.withinComponent`: si está declarado, verificar si alguno de los ancestros del `unit` coincide con los tokens solicitados.
3. **Tests de integración unitarios en `tests/audit-ux.test.mjs`:**
   - Crear tests con proyectos temporales que reproduzcan el caso `Overlays.tsx` con `<Dialog>` y reglas locales que usen `withinComponent`.
   - Verificar retrocompatibilidad con `onlyFile`.
4. **Documentación:**
   - Actualizar especificaciones en `SKILL.md` y `README.md`.
5. **Verificación:**
   - Correr `npm run check:all` y compuertas mecánicas.
<!-- SECTION:PLAN:END -->