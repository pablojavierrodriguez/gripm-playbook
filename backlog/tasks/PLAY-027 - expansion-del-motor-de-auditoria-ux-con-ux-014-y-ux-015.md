---
id: PLAY-027
title: "Expansion del motor de auditoria UX con firmas canonicas UX-014 y UX-015"
status: done
created_date: '2026-10-17'
updated_date: '2026-10-21'
claimed_by: "antigravity:0bf9c7fc-c9b7-49a2-8842-d45ec85d64b0"
labels:
  - "ux-audit"
  - "craftsmanship"
  - "accessibility"
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ampliar el catalogo canonico de reglas de auditoria estatica de UX (`scripts/ux-rules.json`) de 13 a 15 firmas y sincronizar la documentacion en `.agents/skills/code-level-ux-auditor/SKILL.md`:

1. **`UX-014` (Anti-em-dash / anti-AI cliche in UI or metadata):** Detecta caracteres em-dash (`\u2014`) o en-dash (`\u2013`) en nodos de texto JSX y atributos de UI/metadata para hacer cumplir mecanicamente la regla global de guion simple (` - `).
2. **`UX-015` (Viewport touch zoom lock):** Detecta configuraciones de viewport (`maximum-scale=1`, `user-scalable=no`, `user-scalable=0`, `userScalable: false`) que bloquean el pinch-to-zoom en dispositivos tactiles y violan WCAG 1.4.4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Incorporar las firmas `UX-014` y `UX-015` con severidad `WARNING` en `scripts/ux-rules.json`
- [x] #2 Documentar `UX-014` y `UX-015` en `.agents/skills/code-level-ux-auditor/SKILL.md` y actualizar `README.md` manteniendo paridad con `validate-repo.mjs`
- [x] #3 Agregar casos de violacion en `tests/fixtures/react-app/src/components/Violations.tsx` y tests unitarios/E2E en `tests/audit-ux.test.mjs` y `tests/e2e-delivery.test.mjs`
- [x] #4 Verificar que `node scripts/audit-ux-code.cjs --list-rules` reporte las 15 firmas canonicas y `npm run check:all` pase en verde
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Definir `UX-014` y `UX-015` en `scripts/ux-rules.json`.
2. Actualizar `.agents/skills/code-level-ux-auditor/SKILL.md` y `README.md`.
3. Añadir triggers en `Violations.tsx` y cobertura de tests en `tests/audit-ux.test.mjs` y `tests/e2e-delivery.test.mjs`.
4. Ejecutar `npm run validate` y `npm test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Catalogo ampliado a 15 firmas canonicas (`UX-001` .. `UX-015`) con cobertura completa de tests unitarios y E2E.
<!-- SECTION:NOTES:END -->
