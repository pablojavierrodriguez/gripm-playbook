---
id: PLAY-067
title: "Ajustes conceptuales en skills foco virtual keyboard y empty array invariant"
status: done
claimed_by: "antigravity:47712f98-dbb2-45cf-8f50-02a1d15f0cf9"
created_date: '2026-11-09'
updated_date: '2026-11-10'
labels: ["skills", "ux", "architecture"]
dependencies: []
priority: medium
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
Tres lecciones críticas aprendidas en producción real en arquitecturas móviles y offline-first requieren formalizarse en las skills canónicas del Playbook:
1. **Robo de foco en modales:** Efectos `useEffect` que gestionan el autofocus inicial dependiendo de `isDirty` o callbacks mutables provocan que al tipear el primer carácter el foco sea devuelto al inicio o seleccione todo el texto.
2. **Colisión de teclados virtuales:** Vistas o modales con teclados táctiles in-app (numpads de montos, PIN, OTP) que no configuran `inputMode="none"` y `readOnly` provocan que el teclado virtual del SO se superponga y altere el viewport.
3. **Invariante offline/cloud "Empty Array != Fallback":** En clientes locales o cachés offline (Supabase, Dexie, IndexedDB), cuando el servidor responde HTTP 200 con `[]`, representa el estado canónico de la colección vacía. Tratar `[]` como ausencia de datos resucita registros zombis previamente eliminados.
4. **Erradicación del antipatrón de retro:** Eliminar de `pm-orchestrator` y `TEAM_PLAYBOOK.md` la orden de "actualizar gotchas en AGENTS.md", sustituyéndola por la política de progressive disclosure en 4 capas.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  - Actualizar `.agents/skills/code-level-ux-auditor/SKILL.md` con la sección de aislamiento del ciclo de vida del foco y colisión de teclados virtuales.
  - Actualizar `.agents/skills/principal-engineer/SKILL.md` incorporando la invariante "Empty Array != Fallback" en la sección de estado remoto y caché.
  - Actualizar `.agents/skills/pm-orchestrator/SKILL.md` y `.agents/TEAM_PLAYBOOK.md` erradicando la orden de agregar gotchas al archivo raíz.
- **Out-of-Scope:**
  - Alterar contratos de API de código ejecutable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `code-level-ux-auditor/SKILL.md` documenta la regla de aislamiento del ciclo de vida del foco en modales (`[open]` exclusivo).
- [x] #2 `code-level-ux-auditor/SKILL.md` documenta la recomendación de `inputMode="none"` y `readOnly` para inputs gobernados por teclados táctiles in-app.
- [x] #3 `principal-engineer/SKILL.md` documenta la invariante "Empty Array != Fallback" para evitar resucitación de zombis en caché.
- [x] #4 `pm-orchestrator/SKILL.md` y `TEAM_PLAYBOOK.md` reemplazan la instrucción de gotchas en AGENTS.md por la derivación a tests, `.agents/rules/` o skills.
- [x] #5 `npm run validate` y tests pasan exitosamente.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Editar `code-level-ux-auditor/SKILL.md`.
2. Editar `principal-engineer/SKILL.md`.
3. Editar `pm-orchestrator/SKILL.md` y `TEAM_PLAYBOOK.md`.
4. Ejecutar validaciones y tests.
<!-- SECTION:PLAN:END -->
