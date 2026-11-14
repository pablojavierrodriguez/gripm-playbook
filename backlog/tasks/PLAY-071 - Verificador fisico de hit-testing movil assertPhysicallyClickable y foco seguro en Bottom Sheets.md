---
id: PLAY-071
title: "Verificador fisico de hit-testing movil assertPhysicallyClickable y foco seguro en Bottom Sheets"
status: ready
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["ux", "qa", "mobile", "hit-testing", "a11y"]
dependencies: []
priority: high
type: feature
claimed_by: "antigravity:dev-00a9c7bd"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
La auditoria de produccion en DOM movil revelo dos fallos que escapan tanto a linters estaticos como a `jsdom` o `expect(locator).toBeVisible()`:
1. **Ceguera ante oclusion fisica en `375x812` y targets con pseudo-elementos (`::after` / `::before`):** `toBeVisible()` solo evalua estilos y opacidad, sin detectar si otro elemento (como `BottomNav`, banners o FAB) intercepta los toques en `(cx, cy)` ni si el control sobresale de `812px` de alto util. Ademas, controles compactos que expanden su hit-target con `::after` (ej. un toggle `h-6 border-2`) ven reducida su padding-box a `20px` por el borde de `4px`, por lo que `after:-inset-y-2.5` alcanza solo `40px` y recien `after:-inset-y-3` logra `>= 44px`.
2. **Auto-foco indiscriminado al abrir Bottom Sheets en movil (`< 768px`):** Enfocar automaticamente el primer `<input>` al montar un sheet levanta el teclado virtual de inmediato y recorta el viewport util a la mitad antes de que el usuario pueda leer el contenido o confirmar acciones.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Implementar y exportar `scripts/lib/physical-hit-test.mjs` (y export `./hit-test` en `package.json`, registrado en `.playbook-manifest.json` y `FALLBACK_CORE_FILES` de `scripts/sync-playbook.mjs`) con `computeEffectiveHitBox`, `evaluatePhysicalClickability`, `assertPhysicallyClickable` y `assertLocatorPhysicallyClickable`.
  - Contemplar bounding box efectiva con `::after` / `::before` descontando los bordes (`padding-box`), verificando `width >= 44 && height >= 44`, `box.y >= 0 && box.y + box.height <= viewportHeight` y propiedad de `document.elementFromPoint(cx, cy)` (el elemento o un descendiente suyo).
  - Actualizar `.agents/skills/qa-auditor/SKILL.md` (conteo de 20 reglas estaticas en Step 5, y obligatoriedad de `assertPhysicallyClickable` en Step 6 / Touch Ergonomics sobre `375x812`).
  - Actualizar `.agents/skills/code-level-ux-auditor/SKILL.md`, `.agents/skills/product-designer/SKILL.md` y `.agents/stacks/mobile/skills/mobile-ux-design/SKILL.md` con hit-testing fisico, calculo de padding-box en pseudo-elementos y politica de foco seguro en Bottom Sheets (`tabIndex={-1}` al contenedor por defecto en `< 768px`, opt-in explicito via `autoFocusFirstField`).
  - Agregar tests unitarios en `tests/physical-hit-test.test.mjs` cubriendo oclusion, overflow vertical (`> 812px`), target `< 44px`, pseudo-element `h-6 border-2` con `after:-inset-y-2.5` (40px fail) vs `after:-inset-y-3` (44px pass) y Locator async.
- **Out-of-Scope:**
  - Integrar un browser real (Playwright) como dependencia del paquete `@gripm/playbook`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `scripts/lib/physical-hit-test.mjs` exporta `computeEffectiveHitBox`, `evaluatePhysicalClickability`, `assertPhysicallyClickable` y `assertLocatorPhysicallyClickable` verificando `effectiveBox` (`>= 44x44px` incluyendo `::after`/`::before` sobre `padding-box`), limites del viewport (`375x812` por defecto) y pertenencia de `document.elementFromPoint(cx, cy)`.
- [x] #2 `scripts/lib/physical-hit-test.mjs` queda registrado en `.playbook-manifest.json`, `FALLBACK_CORE_FILES` de `scripts/sync-playbook.mjs` y `exports["./hit-test"]` de `package.json`, pasando `npm run validate`.
- [x] #3 `.agents/skills/qa-auditor/SKILL.md` actualiza el conteo de firmas estaticas en Step 5 a 20 y exige `assertPhysicallyClickable` en `375x812` bajo Step 6 y Touch Ergonomics.
- [x] #4 `.agents/skills/code-level-ux-auditor/SKILL.md`, `.agents/skills/product-designer/SKILL.md` y `.agents/stacks/mobile/skills/mobile-ux-design/SKILL.md` documentan la matematica de padding-box en pseudo-elementos `after:-inset-y-*` y la regla de foco inicial seguro en Bottom Sheets (`tabIndex={-1}` por defecto en `< 768px`, opt-in explicito `autoFocusFirstField`).
- [x] #5 `tests/physical-hit-test.test.mjs` verifica todos los casos de borde (`40px` vs `44px`, oclusion de overlay, corte fuera de `812px`, descendiente valido) y `npm test` pasa con codigo 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Escribir `scripts/lib/physical-hit-test.mjs` sin dependencias externas.
2. Registrar el modulo en `.playbook-manifest.json`, `scripts/sync-playbook.mjs` y `package.json`.
3. Documentar hit-testing fisico, padding-box `::after` y foco seguro de Bottom Sheets en `qa-auditor`, `code-level-ux-auditor`, `product-designer` y `mobile-ux-design`.
4. Escribir `tests/physical-hit-test.test.mjs` y validar con `npm run check:all`.
<!-- SECTION:PLAN:END -->
