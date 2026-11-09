---
id: PLAY-065
title: "Reglas estáticas UX-016 y UX-017 de diálogos bloqueantes y backdrop-blur en modales"
status: ready
created_date: '2026-11-09'
updated_date: '2026-11-09'
labels: ["ux", "linter", "rules"]
dependencies: []
priority: high
type: feature
claimed_by: "antigravity:47712f98-dbb2-45cf-8f50-02a1d15f0cf9"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Los desarrolladores y agentes de IA introducen patrones problemáticos en interfaces web y móviles que degradan la experiencia de usuario o quiebran la composición de GPU:
1. Diálogos nativos bloqueantes (`window.confirm()`, `window.alert()`, `window.prompt()` o llamadas no cualificadas en UI): congelan el event loop de JavaScript, bloquean animaciones, Service Workers y composición de layout, rompiendo la experiencia de app nativa en PWAs y violando accesibilidad WCAG.
2. Anti-patrón de `backdrop-blur` con fondos de opacidad reducida (`bg-*/80`, `bg-*/90`, `bg-*/95`, `bg-opacity-`, `bg-black/`, `bg-white/`) en modales, sheets o dialogs: quiebra la separación de capas del compositor de hardware en WebKit (iOS Safari) y Chromium (Android), volviendo el modal translúcido, provocando parpadeos negros o disparando el consumo de memoria GPU.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Agregar la regla `UX-016` ("Blocking native dialog in UI code") en `scripts/ux-rules.json` con severidad `WARNING` (o `ERROR` con `--strict`), excluyendo tests y fixtures.
  - Agregar la regla `UX-017` ("Mobile modal backdrop-blur compositor collision") en `scripts/ux-rules.json` con severidad `WARNING`, detectando `backdrop-blur` combinado con opacidad reducida en modales/dialogs/sheets.
  - Actualizar el catálogo canónico en `.agents/skills/code-level-ux-auditor/SKILL.md`.
  - Crear tests unitarios en `tests/audit-ux.test.mjs` para verificar la detección y los casos de exclusión/falsos positivos.
- **Out-of-Scope:**
  - Modificar el parser AST central de JSX (`scripts/lib/ux-jsx-parser.cjs`) salvo que se requiera soporte adicional de matcher.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `scripts/ux-rules.json` define la regla `UX-016` que detecta `window.confirm(`, `window.alert(`, `window.prompt(`, `confirm(`, `alert(`, `prompt(` en archivos de UI, sugiriendo AlertDialogs accesibles.
- [x] #2 `scripts/ux-rules.json` define la regla `UX-017` que detecta combinaciones de `backdrop-blur` con fondos de opacidad reducida (`bg-*/95`, `bg-*/90`, etc.) en modales y sheets móviles.
- [x] #3 `.agents/skills/code-level-ux-auditor/SKILL.md` documenta formalmente `UX-016` y `UX-017` con firma, impacto y corrección recomendada.
- [x] #4 `tests/audit-ux.test.mjs` incluye casos de prueba específicos para `UX-016` y `UX-017`, validando detección positiva y ausencia de falsos positivos en código limpio.
- [x] #5 La suite completa `npm test` en `gripm-playbook` pasa al 100%.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Escribir tests en `tests/audit-ux.test.mjs` para `UX-016` y `UX-017`.
2. Implementar `UX-016` y `UX-017` en `scripts/ux-rules.json`.
3. Actualizar `code-level-ux-auditor/SKILL.md`.
4. Ejecutar suite de pruebas y verificar.
<!-- SECTION:PLAN:END -->
