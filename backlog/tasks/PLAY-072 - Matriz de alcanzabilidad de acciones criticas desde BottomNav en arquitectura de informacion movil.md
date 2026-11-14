---
id: PLAY-072
title: "Matriz de alcanzabilidad de acciones criticas desde BottomNav en arquitectura de informacion movil"
status: ready
created_date: '2026-11-14'
updated_date: '2026-11-14'
labels: ["ux", "ia", "mobile", "product-design", "skills"]
dependencies: []
priority: high
type: feature
claimed_by: "antigravity:dev-00a9c7bd"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
El playbook actual audita componentes aislados (tamano de toque, contraste, estados), pero carece de una compuerta de **Arquitectura de Informacion Movil (IA)** que garantice la alcanzabilidad real de acciones criticas desde los puntos de entrada de navegacion movil (`BottomNav`). En produccion movil ocurrio que entrar al detalle de una entidad desde la pestana primaria exponia acciones secundarias ("Editar", "Ajustar") pero omitia la accion critica principal, obligando a descubrir una ruta alternativa oculta bajo el menu secundario (`More`).

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Actualizar `.agents/skills/pm-orchestrator/SKILL.md`: incorporar la dimension de alcanzabilidad movil en la tabla R1 Gate, el dispatch hacia `product-designer` y el DoD.
  - Actualizar `.agents/skills/product-designer/SKILL.md`: exigir una **Matriz de Alcanzabilidad de Acciones Criticas** (`BottomNav` tabs primarios × acciones criticas de entidad) dentro de `[DESIGN SPEC]` para flujos moviles multi-entrada.
  - Actualizar `.agents/skills/qa-auditor/SKILL.md`: validar durante Step 6 / calidad UX que ninguna accion critica quede huerfana fuera de los flujos accesibles desde las pestanas primarias del `BottomNav`.
  - Actualizar `.agents/stacks/mobile/skills/mobile-ux-design/SKILL.md`: agregar seccion canonica de Arquitectura de Informacion Movil y matriz de alcanzabilidad `BottomNav`.
  - Mantener el contenido 100% agnostico al dominio (`checkCorePurity` en verde).
  - Agregar test de regresion en `tests/validate-repo.test.mjs`.
- **Out-of-Scope:**
  - Generacion automatica de grafos AST de rutas (auditoria de arquitectura guiada por contrato en spec y QA).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `.agents/skills/pm-orchestrator/SKILL.md` incluye verificacion de alcanzabilidad movil (`BottomNav`) en la tabla R1 Gate, en el brief de diseno y en el DoD.
- [x] #2 `.agents/skills/product-designer/SKILL.md` exige declarar la **Critical Action Reachability Matrix** (`BottomNav` tabs × critical entity actions) en `[DESIGN SPEC]`.
- [x] #3 `.agents/skills/qa-auditor/SKILL.md` y `.agents/stacks/mobile/skills/mobile-ux-design/SKILL.md` documentan la auditoria de alcanzabilidad de acciones criticas desde todos los entry points reales de navegacion movil.
- [x] #4 `npm run validate` pasa con `checkCorePurity` en verde y `tests/validate-repo.test.mjs` verifica la presencia de la directiva en las skills.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Crear e iniciar `PLAY-072` (`draft` -> `doing`).
2. Actualizar `pm-orchestrator`, `product-designer`, `qa-auditor` y `mobile-ux-design`.
3. Agregar tests de regresion en `tests/validate-repo.test.mjs`.
4. Verificar `npm run validate` y `node --test tests/validate-repo.test.mjs`.
<!-- SECTION:PLAN:END -->
