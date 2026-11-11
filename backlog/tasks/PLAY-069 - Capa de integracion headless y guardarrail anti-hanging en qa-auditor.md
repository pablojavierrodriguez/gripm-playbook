---
id: PLAY-069
title: "Capa de integracion headless y guardarrail anti-hanging en qa-auditor"
status: done
created_date: '2026-11-09'
updated_date: '2026-11-10'
labels: ["qa", "testing", "skills", "pyramid"]
dependencies: []
priority: high
type: feature
claimed_by: "antigravity:77f0a887-6629-4522-aa35-4fbcb0a0585e"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Durante la ejecución de tareas por agentes autónomos y subagentes en entornos de terminal CLI o CI:
1. **Salto falso a navegadores reales (Playwright):** Ante cualquier interacción de UI (modales, masking de inputs, selectors, formularios), los agentes tienden a asumir que los unit tests son insuficientes y recurren a suites completas de browser o `browser_subagent`. Esto provoca bloqueos indeterminados en terminales no interactivas (timeouts de 120s, colisiones de webservers locales en puertos ocupados, procesos zombis), quemando turnos y tokens.
2. **Vacío conceptual entre Unit y Browser Tests:** Es indispensable explicitar que el 95% de la interactividad de UI se certifica de forma determinista y en milisegundos mediante **tests headless de componentes e integración** (`.test.tsx` con React Testing Library / `renderHook` / JSDOM), reservando el browser real exclusivamente para aspectos visuales o de layout no deducibles estáticamente.
3. **Timeout excesivo en el runner del gate (`scripts/lib/pyramid.mjs`):** El timeout por paso en `spawnSync` está prefijado en 10 minutos (600s), permitiendo que procesos congelados mantengan colgada la sesión del agente.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Actualizar `.agents/skills/qa-auditor/SKILL.md`:
    - Formalizar el Paso 2 de la Pirámide de Verificación como `Headless tests (Unit & Component Integration)`.
    - Documentar la directiva operativa de Component Integration Headless (modales, masking, estado y stores deben validarse en headless tests; si pasan, se descarta browser real para estado).
    - Incorporar el Guardarraíl Anti-Hanging (timeouts <= 15s por test, flags headless/no-watch forzados, prevención de procesos zombis y servidores dev colgados).
  - Actualizar `.agents/skills/principal-engineer/SKILL.md`:
    - Incorporar el estándar de integración headless (`.test.tsx`) para componentes interactivos antes de someter a review.
    - Exigir timeouts acotados y limpieza determinista de procesos/puertos.
  - Actualizar `scripts/lib/pyramid.mjs`:
    - Reducir el timeout de seguridad de cada paso de 10 minutos a 2 minutos (`120_000 ms`), con soporte de override vía opciones.
    - Manejar el error de timeout de forma descriptiva indicando anti-hanging guardrail.
  - Actualizar `scripts/validate-repo.mjs`:
    - Incorporar el alias `'headless tests (unit & component integration)': 'test'` en `PYRAMID_ALIASES`.
  - Crear tests unitarios en `tests/` para verificar el alias de la pirámide y el timeout de `pyramid.mjs`.
- **Out-of-Scope:**
  - Cambiar dependencias externas o forzar librerías de testing específicas en proyectos consumidores.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `.agents/skills/qa-auditor/SKILL.md` actualiza la Pirámide de Verificación formalizando el Paso 2 como `Headless tests (Unit & Component Integration)` y documenta la directiva operativa que prohíbe delegar lógica de interacción/estado a navegadores reales.
- [x] #2 `.agents/skills/qa-auditor/SKILL.md` documenta las reglas del Guardarraíl Anti-Hanging (timeouts <= 15s por test, flags headless forzados, y prevención de servidores dev zombis).
- [x] #3 `.agents/skills/principal-engineer/SKILL.md` documenta la exigencia de tests headless de componentes e stores (`.test.tsx` / RTL) para flujos interactivos y la disciplina de timeouts acotados.
- [x] #4 `scripts/lib/pyramid.mjs` acota el timeout por paso a 2 minutos por defecto (configurable vía options) e identifica con claridad errores de timeout.
- [x] #5 `scripts/validate-repo.mjs` reconoce `'headless tests (unit & component integration)'` en `PYRAMID_ALIASES` y `npm run validate` pasa con código 0.
- [x] #6 La suite de tests de `gripm-playbook` (`tests/gate-qa.test.mjs`, `tests/validate-repo.test.mjs`) pasa al 100%.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Crear la tarea `PLAY-069` e iniciarla (transición T0: `draft` -> `doing`).
2. Actualizar `scripts/lib/pyramid.mjs` con timeout de 2 minutos y mensaje claro ante timeout.
3. Actualizar `scripts/validate-repo.mjs` con el alias de la pirámide.
4. Actualizar `.agents/skills/qa-auditor/SKILL.md` y `.agents/skills/principal-engineer/SKILL.md`.
5. Ejecutar tests de `pyramid.mjs`, `validate-repo.mjs` y `gate-qa.test.mjs`.
6. Enviar a review (transición T1: `doing` -> `review`).
7. Invocar subagente `qa-auditor` en contexto limpio para ejecutar el gate y certificar (transición T2: `review` -> `ready`).
<!-- SECTION:PLAN:END -->
