---
id: PLAY-042
title: "Resolver contradicciones y bugs criticos en skills de stacks y auditoria"
status: done
created_date: '2026-10-25'
updated_date: '2026-10-26'
labels: ["stacks", "ux-audit", "integrity"]
dependencies: []
priority: high
type: bug
claimed_by: "antigravity:dev"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Existen contradicciones directas entre los skills de stacks y las reglas deterministas del core, ademas de un script fantasma que causa fallos inmediatos:
1. `mobile-ux-design/SKILL.md` prescribe `pb-20` / `pb-24` para contenedores desplazables con barras inferiores fijas, cuando la regla `UX-006` en `scripts/ux-rules.json` penaliza explicitamente `pb-20` y `pb-24` como WARNING y exige `pb-32` + `safe-area-inset-bottom`.
2. `ui-radix-tailwind/SKILL.md` utiliza `text-[9px]` y `text-[10px]` en su seccion de modales oficiales, lo que dispara la regla `UX-011` (`Arbitrary font size outside the canonical type scale`) en `audit-ux-code.cjs`, y hardcodea clases de color (`text-slate-800 dark:text-slate-200`) violando su propia regla de tokens semanticos.
3. `pwa-assets-audit/SKILL.md` instruye ejecutar `node .agents/skills/pwa-assets-audit/scripts/validate-manifest.mjs`, pero dicho script no existe en el repositorio ni en `.playbook-manifest.json`. Ademas, `scripts/validate-repo.mjs` no audita los scripts referenciados dentro de `.agents/stacks/`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] Corregir `mobile-ux-design/SKILL.md` para prescribir `pb-32` + `env(safe-area-inset-bottom)` alineado con `UX-006`.
- [x] Corregir `ui-radix-tailwind/SKILL.md` eliminando `text-[9px]` / `text-[10px]` y sustituyendo colores hardcodeados por tokens semanticos del design system.
- [x] Proveer la implementacion real de `validate-manifest.mjs` (o registrarla e instalarla via manifest) o corregir la invocacion documental en `pwa-assets-audit/SKILL.md`.
- [x] Extender `scripts/validate-repo.mjs` en `checkDocsReferenceInstalledFiles()` para que inspeccione tambien los archivos de documentacion dentro de `.agents/stacks/`.
- [x] `npm run validate` y `npm test` pasan en verde con 0 errores.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Editar `.agents/stacks/mobile/skills/mobile-ux-design/SKILL.md` ajustando padding seguro.
2. Editar `.agents/stacks/react/skills/ui-radix-tailwind/SKILL.md` limpiando tamanios arbitrarios y clases hardcodeadas.
3. Resolver el script de validacion de manifest e incorporarlo a `.playbook-manifest.json` y `validate-repo.mjs`.
4. Ejecutar validaciones locales.
<!-- SECTION:PLAN:END -->
