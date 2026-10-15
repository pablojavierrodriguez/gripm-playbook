---
id: PLAY-013
title: "Reglas deterministas de linter anti-slop (Oxlint/AST) contra vicios de código y comentarios generados por IA"
status: ready
created_date: '2026-10-12'
updated_date: '2026-10-15'
labels:
  - "anti-slop"
  - "code-quality"
  - "linter"
  - "principal-engineer"
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Los agentes de IA tienden a incurrir en vicios repetitivos de codificación ("code slop") que degradan silenciosamente la integridad técnica de las aplicaciones TypeScript y JavaScript:

1. **Fabricación de tipos:** Cuando el compilador detecta una incompatibilidad, los LLMs recurren con frecuencia a dobles aserciones como `value as unknown as TargetType` o ensanchan expresiones conocidas hacia `any` o `unknown`, esquivando el sistema de tipos en lugar de resolver el contrato.
2. **Tests mentirosos por mockeo desmedido:** En suites de tests (Vitest/Jest), los agentes abusan de `vi.mock()` para aislar módulos enteros, produciendo tests verdes que no validan las integraciones reales y ocultan roturas de dependencias.
3. **Validación perezosa en runtime:** Uso de `typeof x === 'object'` en los bordes del sistema (APIs, payloads) en lugar de esquemas deterministas y seguros (Zod, Valibot, ArkType).
4. **Comentarios de relleno y decorativos:** Banners con caracteres repetidos (`// ==================== AUTH ====================`), narración paso a paso de control flow trivial (`// Step 1: validate input`) y comentarios que simplemente duplican el nombre del símbolo o función sin aportar contexto arquitectónico.

### Solución
Inspirado en el enfoque determinista de `dmmulroy/anti-slop` y la higiene de `miqdadbadjuber/anti-slop` (antislop-code):
- Establecer en el playbook las reglas y configuraciones linter deterministas que rechazan estos patrones mediante análisis estático de AST (con exit code 1 bloqueante).
- Actualizar la skill del Principal Engineer para consagrar la prohibición de comentarios de relleno y la disciplina estricta de aserciones de tipos.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Actualizar .agents/skills/principal-engineer/SKILL.md con las reglas de higiene de comentarios (prohibición de separadores decorativos, narración de flujo trivial y duplicación de firmas)
- [x] #2 Documentar en el playbook las reglas de código anti-slop: prohibición de aserciones encadenadas (no-chained-type-assertions), requisito de justificación explícita ante type assertions y prohibición de widening innecesario
- [x] #3 Documentar en el playbook la política contra el mockeo indiscriminado de módulos en tests (no-module-mocking) en favor de costuras reales de arquitectura
- [x] #4 Proveer configuración recomendada y receta de integración de Oxlint / plugins anti-slop para proyectos consumidores del playbook
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Redactar sección de higiene anti-slop en `.agents/skills/principal-engineer/SKILL.md`.
2. Crear guía o receta de configuración de linter anti-slop (Oxlint/ESLint) en `docs/` o en stacks correspondientes.
3. Ajustar la Pirámide de Verificación para incorporar el linting anti-slop como compuerta determinista.
4. Validar el repositorio con `npm run validate` y `npm test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Dev Handoff — 2026-10-15
- AC #4 implementado en `.agents/skills/principal-engineer/SKILL.md` (§ 13):
  - Configuración canónica `.oxlintrc.json` con categorías `correctness: error`, reglas `typescript/no-explicit-any`, `typescript/no-unsafe-*`, `eslint/no-empty`, `unicorn/no-unnecessary-await`.
  - Receta de integración en `package.json` (`lint:anti-slop` con `--deny-warnings`).
  - Reglas de AST / ESLint para detección de evasión (`as unknown as`, `consistent-type-assertions`).
- Tarea movida a `status: review` para auditoría de QA.

### QA Verdict — 2026-10-15 (Round 1)
- **Verdict:** [ REJECTED → doing ]
- **Blocking Finding:**
  - AC #1, #2, #3 are verified in `.agents/skills/principal-engineer/SKILL.md` (§ 10, 11, 12).
  - AC #4 FAILED: The criterion was marked `[x]`, but no Oxlint configuration or integration recipe was provided anywhere in the repository. Commit `f1a100e` explicitly admits: *"AC #4 (receta Oxlint) queda sin Implementar: es un artefacto de tooling, no prosa."* Marking an unfulfilled criterion as `[x]` violates backlog hygiene rule #2 and the Verification Pyramid.
- **Actionable Fix:**
  1. Implement the recommended Oxlint / AST linter configuration and integration recipe for consumers (e.g., in `.agents/skills/principal-engineer/SKILL.md` or a consumer documentation guide `docs/LINTER_ANTI_SLOP.md`), OR
  2. With PO approval, remove/split AC #4 into a dedicated tooling task (e.g., in a future release) and re-submit PLAY-013 to `review`.

### QA Verdict — 2026-10-15 (Round 2 - Final Certification)
- **Verdict:** [ APPROVED → ready ]
- **Evidence & Findings:**
  - **AC #1, #2, #3:** Re-verified in `.agents/skills/principal-engineer/SKILL.md` (§ 10 Higiene de comentarios, § 11 Disciplina de tipos y aserciones, § 12 Política de mockeo en tests). All rules remain clear and well-formed.
  - **AC #4:** Verified in `.agents/skills/principal-engineer/SKILL.md` (§ 13 Receta e integración de linter anti-slop (Oxlint / AST)). Provides concrete recommended `.oxlintrc.json`, `package.json` script integration (`lint:anti-slop`), and AST rules for evasion detection (`no-chained-assertions`, `as unknown as`).
  - **Verification Pyramid:**
    - Typecheck / Repo consistency: `npm run validate` (Pass, exit 0)
    - Headless unit & integration tests: `npm test` (Pass, 128 tests passing, 0 failed)
    - Spec ↔ backlog consistency: `npm run gate:review` (Pass, exit 0)
    - Static UX audit: `npm run audit:ux:strict` (Pass, exit 0)
    - QA Gate: `npm run gate:qa PLAY-013` (Pass, exit 0)
- **Status:** Promoted from `review` to `ready`.
<!-- SECTION:NOTES:END -->
