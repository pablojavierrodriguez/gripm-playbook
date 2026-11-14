---
id: PLAY-070
title: "Reglas estaticas UX-018 UX-019 y UX-020 contra oclusion movil y trampas de stacking context"
status: ready
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["ux", "audit", "mobile", "static-analysis"]
dependencies: []
priority: high
type: feature
claimed_by: "antigravity:dev-00a9c7bd"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Auditorias reales de produccion en DOM movil detectaron tres puntos ciegos estructurales donde las 17 firmas actuales (`UX-001`..`UX-017`) reportaban `0 errors, 0 warnings`, pero los controles quedaban fisicamente ocluidos detras de capas de navegacion o fuera de vista:
1. **Trampa de stacking context por animaciones / ausencia de Portal (`UX-018`):** Un overlay o modal/sheet (`fixed inset-0` con `z-30`/`z-40`/`z-50`/`z-[...]` o `willChange`) renderizado sin `createPortal(..., document.body)` o primitiva de Portal queda encerrado en el stacking context de wrappers padres con `will-change`, `transform` o `opacity` animados, terminando tapado por `BottomNav` aunque declare `z-50`.
2. **Footers de pagina con `sticky bottom-0` sin compensar `BottomNav` (`UX-019`):** Barras de accion a nivel de vista con `sticky bottom-0` sin offset movil (`bottom-16 md:bottom-0`, `bottom-14`, `bottom-[...]`) quedan fisicamente tapadas detras del `BottomNav` en `< 768px`.
3. **Botones `sticky bottom-0` dentro del cuerpo scrolleable de Sheets/Modales (`UX-020`):** Declarar `sticky bottom-0` dentro de `<ResponsiveSheet>`, `<Sheet>`, `<Drawer>`, `<Dialog>` o `<Modal>` (en lugar de un slot `footer` anclado / `<SheetFooter>`) provoca que los CTAs desaparezcan al hacer scroll interno o al desplegar el teclado virtual movil. Ademas, `mobile-ux-design/SKILL.md` prescribia un patron antiguo con `sticky bottom-0 bg-background/95 backdrop-blur-md` que contradecia `UX-017` y `UX-020`.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Incorporar soporte de `unlessFileContent` en `scripts/lib/ux-jsx-parser.cjs` para evaluar guardas a nivel de archivo (ej. `createPortal(` o primitivas Portal fuera del JSX del overlay).
  - Incorporar `UX-018`, `UX-019` y `UX-020` con severidad `WARNING` en `scripts/ux-rules.json`, activas en ambos presets (`pragmatic` y `strict`, sin agregarlas a `PRAGMATIC_EXCLUDED_RULES`).
  - Documentar las tres reglas y actualizar el checklist pre-merge en `.agents/skills/code-level-ux-auditor/SKILL.md` manteniendo paridad exacta de titulo y severidad.
  - Corregir la seccion 3 de `.agents/stacks/mobile/skills/mobile-ux-design/SKILL.md` exigiendo Portal para modales/sheets, slot `footer` / `<SheetFooter>` solido anclado en lugar de `sticky bottom-0` + `backdrop-blur`, y compensacion `bottom-16 md:bottom-0 z-30` en footers sticky de pagina.
  - Agregar triggers representativos en `tests/fixtures/react-app/src/components/Violations.tsx` y tests unitarios de deteccion positiva y escapes limpios en `tests/audit-ux.test.mjs`.
- **Out-of-Scope:**
  - Verificacion fisica en browser real / hit-testing DOM (cubierto en `PLAY-071`) y matriz de alcanzabilidad de IA movil (cubierto en `PLAY-072`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `scripts/ux-rules.json` define `UX-018`, `UX-019` y `UX-020` con severidad `WARNING`, activas tanto en preset `pragmatic` como en `strict`.
- [x] #2 `.agents/skills/code-level-ux-auditor/SKILL.md` documenta los encabezados canonicos `### 18. [UX-018] · WARNING · ...`, `### 19. [UX-019] · WARNING · ...` y `### 20. [UX-020] · WARNING · ...` con paridad verificada por `npm run validate`, y actualiza el checklist pre-merge.
- [x] #3 `.agents/stacks/mobile/skills/mobile-ux-design/SKILL.md` reemplaza el patron contradictorio `sticky bottom-0 bg-background/95 backdrop-blur-md` en sheets por slot `footer` / `<SheetFooter>` anclado y exige `createPortal`/Portal en overlays y compensacion `bottom-16 md:bottom-0 z-30` en footers sticky de vista.
- [x] #4 `tests/fixtures/react-app/src/components/Violations.tsx` dispara las 20 reglas mientras `Clean.tsx` mantiene 0 hallazgos.
- [x] #5 `tests/audit-ux.test.mjs` verifica casos positivos y de escape valido para `UX-018`, `UX-019` y `UX-020`, y `npm test` + `npm run validate` pasan con codigo 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Agregar `UX-018`, `UX-019` y `UX-020` a `scripts/ux-rules.json`.
2. Actualizar `.agents/skills/code-level-ux-auditor/SKILL.md` y `.agents/stacks/mobile/skills/mobile-ux-design/SKILL.md`.
3. Actualizar fixture `Violations.tsx` y agregar suite unitaria en `tests/audit-ux.test.mjs`.
4. Validar paridad de catalogo (`validate`) y suite de auditoria (`audit-ux.test.mjs`).
<!-- SECTION:PLAN:END -->
