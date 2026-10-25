---
id: PLAY-043
title: "Purga de project bleed y acoplamiento residual en stack packs de react y mobile"
status: draft
created_date: '2026-10-25'
updated_date: '2026-10-25'
labels: ["stacks", "refactor", "portability"]
dependencies: [PLAY-042]
priority: high
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Los stack packs (`.agents/stacks/react`, `.agents/stacks/mobile`) presentan fuga de contexto y acoplamiento ("project bleed") procedente de una aplicacion SaaS anterior sin sanitizar:
- `forms-rhf-zod/SKILL.md` hace referencia a una skill inexistente `i18next-namespaces`, asume rutas fijas `src/locales/es.json` e importa helpers (`formatThousandsInput`, `parseThousandsInput`) desde `@/lib/utils` sin proveer su definicion.
- `ui-radix-tailwind/SKILL.md` impone que existe un componente preexistente `src/components/ui/date-range-picker.tsx`, muestra queries acopladas a columnas como `"starts_at"`, y prescribe modales rigidos propios de un producto especifico.
- `mobile-ux-design/SKILL.md` prescribe hooks internos como `usePWAInstall` y estilos CSS ultra-acoplados (`.peer[data-state="expanded"] ~ div .btn-action-label`) pertenecientes al layout de una aplicacion externa.

Es necesario sanitizar estos skills para que provean patrones canonicos autocontenidos y portables para cualquier proyecto React / Mobile.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] Sanitizar `forms-rhf-zod/SKILL.md` removiendo la dependencia a la skill inexistente `i18next-namespaces` y encapsulando los helpers de entrada de miles/decimales o documentando su contrato generico.
- [ ] Desacoplar `ui-radix-tailwind/SKILL.md` de rutas fijas inexistentes (`date-range-picker.tsx`) convirtiendo los ejemplos en snippets autocontenidos y neutrales.
- [ ] Eliminar selectores CSS hiper-especificos y referencias de hooks privados de `mobile-ux-design/SKILL.md`.
- [ ] Estandarizar el idioma de los skills de stacks al estandar ingles (alineado con los demas skills del playbook) o documentar formalmente su alcance.
- [ ] `npm run validate` ejecuta y aprueba con 0 errores.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Revisar y neutralizar ejemplos y referencias en `.agents/stacks/react/skills/forms-rhf-zod/SKILL.md`.
2. Revisar y limpiar `.agents/stacks/react/skills/ui-radix-tailwind/SKILL.md`.
3. Sanitizar `.agents/stacks/mobile/skills/mobile-ux-design/SKILL.md`.
4. Verificar coherencia y enlaces rotos con `scripts/validate-repo.mjs`.
<!-- SECTION:PLAN:END -->
