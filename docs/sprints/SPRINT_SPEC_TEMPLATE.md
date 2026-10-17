# Sprint Spec & Runbook - [ID / Feature Name]

<!--
  Status vocabulary is owned by .agents/STATE_MACHINE.md. Do not invent states.
  The backlog is NOT a status: every item starts in `draft` (or `ideas` for discovery); zero items exist without a status.
  Allowed values: ideas | draft | blocked | doing | review | ready | done | dismissed
-->

- **Status:** `[ ideas | draft | blocked | doing | review | ready | done | dismissed ]`
- **Blocked Reason:** `[ obligatorio y no vacío si status: blocked; omitir en otros estados ]`
- **Dismissed Reason:** `[ obligatorio y no vacío si status: dismissed; omitir en otros estados ]`
- **Last transition:** `[ from → to ]` by `[ actor ]` - `[ YYYY-MM-DD ]`
- **Refined:** `[ yes (YYYY-MM-DD) | no - falta: <qué> ]`
- **Sprint:** `[ SPRINT-XXX ]`
- **Backlog Item:** `[ ID ]`
- **Date:** YYYY-MM-DD
- **PO Lead:** PM Orchestrator

**Acceptance Criteria**

| # | Criterio | Verification method | Estado |
| :--- | :--- | :--- | :--- |
| AC-1 | [measurable criterion] | [test / manual check] | `- [ ]` |
| AC-2 | [measurable criterion] | [test / manual check] | `- [ ]` |

> Ningún ítem pasa a `review` con ACs sin marcar. La certificación de QA (`review` → `ready`) exige la tabla completa en verde.

**Refinement gate (R1)** - un ítem solo entra a `doing` con refinamiento aprobado:

- [ ] Statement de problema desde la perspectiva del usuario
- [ ] Alcance acotado **y** out-of-scope explícito
- [ ] ACs medibles
- [ ] Prioridad asignada por el PO
- [ ] Ambigüedades resueltas y registradas (Grilling Session completada)

---

## 1. 🔍 [RESEARCH] Benchmarks & Edge Cases - Market Researcher
> Análisis de referentes y patrones de interacción probados.

- **References Analyzed:**
- **Prominent Interaction Patterns:**
- **Domain Edge Cases & Risks:**
- **Recommendations for Design & Engineering:**

---

## 2. 🎨 [DESIGN SPEC] Experience & Micro-Interactions - Product Designer
> Anatomía visual, estados, movimiento y ergonomía táctil.

- **Tokens & Visual Hierarchy:**
- **Touch Targets (≥ 44px) & Mobile Ergonomics:**
- **Micro-Interactions & Sensory Feedback:**
- **Interactive States:**
  - *Default:*
  - *Hover:*
  - *Active / Focus:*
  - *Disabled:*
  - *Loading / Skeleton:*
  - *Empty State:*
  - *Error State:*

---

## 3. ⚙️ [TECH ARCHITECTURE] Implementation & Robustness - Principal Engineer
> Modularidad, hooks, tipado estricto e integridad de esquema.

- **Files Created / Modified:**
- **Typing & Validation:**
- **Performance (frame budget, memory leaks):**
- **Verification Pyramid (local, pre-handoff):**
  - [ ] `typecheck` - 0 errors
  - [ ] tests - 0 failures

> Al completar esta sección el ítem pasa a `status: doing` → `review` (T1).

---

## 4. 🛡️ [QA MATRIX] Certification - Rigorous QA Auditor
> Auditoría del ítem antes de certificarlo.

**Verification Pyramid - orden estricto. Ningún paso se saltea.**

1. [ ] **Typecheck estricto** - 0 errores
2. [ ] **Tests headless** - 0 fallos
3. [ ] **Consistencia spec ↔ backlog** - ACs, alcance y estado de commit coherentes
4. [ ] **Build de producción** - limpio

**Auditoría estática de UX (headless, sin browser):**

- [ ] `node scripts/audit-ux-code.cjs --strict` en verde

**Auditoría visual en navegador - solo para lo no deducible estáticamente:**

- [ ] Layout / CSS responsive no deducible por análisis estático (viewport objetivo)
- [ ] Consola del navegador sin errores

> [!IMPORTANT]
> `browser_subagent` y DevTools están **prohibidos** para lógica, estado, contratos de API o persistencia: eso se resuelve headless en los pasos 1 - 4. Solo se abren para issues de CSS/layout no deducibles estáticamente o por pedido explícito del usuario.

**Compuerta ejecutable - gate runner:**

- [ ] `node scripts/gate-qa.mjs <ID>` en verde (exit code 0 requerido para certificar)

**Findings & Resolved Friction:**

- **Verdict:** `[ APPROVED → ready | REJECTED → doing ]`

> **T2 (`review` → `ready`) es exclusiva del QA Auditor.** El developer no auto-certifica. La certificación requiere exit code 0 del runner. Al rechazar, registrar los findings accionables y mover el ítem a `doing` (T3).

---

## 5. 🚀 [RELEASE] Packaging & Deployment - Release Management
> Llenar en el momento del release, no durante el sprint.

- **Release Version:** `[ vX.Y.Z ]`
- **Items included (`ready` only):** `[ BACKLOG-ID, ... ]`
- **Value Delivered:**
- **Deploy Target:**
- **Changelog Entry:**

> Los releases se arman **por valor entregado** agrupando ítems en `ready`, con o sin sprint activo, históricos o del sprint en curso. Sprints y releases no tienen acoplamiento 1:1.

- [ ] Paquete desplegado en producción
- [ ] Items transicionados `ready` → `done` (T4)

> **Invariante fundamental:** ningún ítem puede estar en producción sin estar en `done`.

---

## 6. 🧠 [KNOWLEDGE FEED] System Memory
> Llenar al cerrar el sprint o el release. Requiere comando explícito del PO.

- **Rule Added / Updated:** `[ AGENTS.md o .agents/rules/* ]`
- **Skill Updated:** `[ .agents/skills/* ]`
- **ADR Recorded:** `[ path ]`
- **Backlog Items Created from Tech Debt:**