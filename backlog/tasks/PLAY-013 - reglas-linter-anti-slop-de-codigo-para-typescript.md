---
id: PLAY-013
title: "Reglas deterministas de linter anti-slop (Oxlint/AST) contra vicios de código y comentarios generados por IA"
status: review
created_date: '2026-10-12'
updated_date: '2026-10-12'
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
<!-- SECTION:NOTES:END -->
