# State Machine del Delivery Flow

> **Fuente de verdad única del delivery status.** `AGENTS.md`, `TEAM_PLAYBOOK.md`, el README y las sprint specs referencian este archivo. Ningún otro documento redefine la tabla: si cambiás una regla, cambiás acá.

---

## 1. Status y Taxonomía del Flujo

El ciclo de vida del trabajo consta de estados claramente tipados y sin ambigüedades:

| Fase | Status | Significado | Dónde reside | Quién lo asigna |
| :--- | :--- | :--- | :--- | :--- |
| **Discovery** | `ideas` | Idea, hipótesis o investigación preliminar. | Pool / Discovery | PO / Diseñador |
| **Backlog** | `draft` | **Tarea formal especificada y con ACs.** Lista para entrar a desarrollo. | Backlog (disco) | PO / Dev al crear la tarea |
| **Delivery** | `blocked` | **Detenido por un impedimento externo declarado.** Requiere `blocked_reason`. | Backlog (disco) | PO / Dev |
| **Delivery** | `doing` | En desarrollo activo. Único status con código escribiéndose. | Rama de trabajo | Principal Engineer / Agente |
| **Delivery** | `review` | Implementación completa y tests locales en verde. Esperando certificación. | Rama de trabajo | Principal Engineer / Agente |
| **Delivery** | `ready` | **Entrega formal del desarrollo (Línea de llegada del Dev/Agente).** Certificado bajo Pirámide. | Rama / Staging | **QA Auditor / Test Suite** |
| **Producción** | `done` | **Desplegado en producción.** Empaquetado y publicado en release. | Producción / Tag | **Release Management / Deploy** |

### Reglas Fundamentales de Estado:

1. **El Backlog no es un valor de estado:** Es la **dimensión de planificación y el contenedor** de trabajo no iniciado. Toda tarea en el Backlog tiene asignado legítimamente el estado canónico `draft` (o `ideas` si es exploratoria).
2. **Cero ítems sin estado:** Toda tarea que se crea en disco nace con `status: draft`. Dejar tareas sin estado o con status vacío colisiona con el tipado estricto (`ItemStatus`) y corrompe los filtros.
3. **`ready` es la meta del desarrollador:** El trabajo de desarrollo y del agente concluye formalmente al certificar en `ready`. Un desarrollador o agente **NUNCA** mueve una tarea a `done` durante el desarrollo.
4. **`done` exige deploy real:** El estado `done` se asigna exclusivamente cuando el Release Manager o el pipeline empaqueta la versión y la despliega a producción (el Release Assembler promueve automáticamente de `ready` a `done`). Marcar `done` sin deploy real es una mentira de estado.
5. **`blocked` exige `blocked_reason`:** Toda tarea en `blocked` **debe** declarar en su frontmatter el campo `blocked_reason: "<motivo>"`. Sin motivo no es un bloqueo, es una tarea abandonada en `doing` que distorsiona el WIP real. El campo es obligatorio y no vacío.

---

## 2. Refinement: un gate, no un estado

El refinamiento es una **condición de entrada**, no una etapa del flujo. Se modela como un flag en el ítem, no como un status.

**Gate R1 — un ítem solo puede entrar a `doing` si:**
1. Tiene statement de problema (perspectiva del usuario, no del código).
2. Tiene alcance acotado **y** out-of-scope explícito.
3. Tiene ACs medibles. "Que quede lindo" no es un AC.
4. Tiene Prioridad asignada por el PO.
5. **Sus ambigüedades están resueltas y registradas.** Un ítem refinado por asunción del agente no pasó R1: la desalineación inicial no se detecta en QA, porque el QA valida contra ACs que nacieron de la premisa equivocada. El refinamiento exige una ronda de preguntas explícitas sobre casos borde, fallbacks, estados vacíos y tradeoffs, con las respuestas grabadas en el ítem. Detalle en la skill `pm-orchestrator` § Grilling Session.

El flag se registra en el backlog del proyecto:

```markdown
### [BACKLOG-001] Título en imperativo
- **Refined:** yes (2026-10-04)   # o: no — falta: <qué>
```

Un ítem no refinado permanece en `draft` (o `ideas` si es discovery) en el backlog. No puede entrar a `doing` hasta que se apruebe el Gate R1.

---

## 3. Transiciones

| # | De → A | Actor | Guard |
| :--- | :--- | :--- | :--- |
| T0 | `draft` → `doing` | Principal Engineer | **Gate R1 aprobado** + priorizado por el PO + **todas las `dependencies:` en `done`** + rama lista. |
| T1 | `doing` → `review` | Principal Engineer | Código implementado, ACs marcadas `- [x]`, y pasos 1–2 de la Pirámide en verde local (`typecheck` + tests). |
| T2 | `review` → `ready` | **QA Auditor** | Pirámide de Verificación completa en verde **y `npm run gate:qa` con exit code 0**. Una transición declarada solo en prosa no surte efecto. |
| T3 | `review` → `doing` | QA Auditor | Rechazado, con findings accionables registrados en la QA Matrix. |
| T4 | `ready` → `done` | Release Management | Paquete desplegado en producción. |
| T5 | `doing` → `draft` | PO | Timebox del sprint expirado, o depriorizado explícitamente. |
| T_block | `draft` → `blocked` | PO / Dev | Impedimento externo identificado. `blocked_reason` obligatorio. |
| T_block | `doing` → `blocked` | PO / Dev | Impedimento externo identificado. `blocked_reason` obligatorio. |
| T_unblock | `blocked` → `doing` / `draft` | PO / Dev | El impedimento fue resuelto **o** sus `dependencies:` bloqueantes quedaron en `done` o fueron desvinculadas del array. |

---

## 4. Invariantes

1. **Producción ⊆ `done`.** Ningún ítem puede estar en producción sin estar en `done`. Violarlo es un incidente de proceso, no un detalle de bookkeeping.
2. **El developer no auto-certifica.** T2 (`review` → `ready`) es exclusiva del QA Auditor. El Principal Engineer jamás mueve su propio ítem a `ready`.
3. **`ready` es inmutable.** Una vez certificado, el código no se modifica sin volver a `doing`. Un fix post-QA **invalida la certificación**: el ítem vuelve a `doing` y reingresa por T1/T2 completas.
4. **T4 exige deploy real.** Marcar `done` sin desplegar es una mentira de estado.
5. **Ni sprint ni retrospectiva se cierran por deducción.** Requieren comando textual explícito del PO.
6. **El refinamiento nunca se pierde.** Un ítem que vuelve al pool conserva su registro de refinamiento; no se re-refina desde cero.
7. **`ready` se-earned, no se-declara.** La transición T2 requiere exit code 0 del gate runner. Un agente que simule el rol de QA en el mismo turno en que escribe el código está violando este invariante, por bienintencionado que sea.
8. **Ninguna dependencia se cumple porinuición.** Un ítem no entra a `doing` ni se certifica en `ready` mientras alguna tarea de su `dependencies:` no esté en `done`. La desvinculación de una dependencia es un acto explícito y queda registrada, no una omisión silenciosa.

---

## 5. Release management desacoplado

- Sprints y releases **no** tienen acoplamiento 1:1.
- Un release se arma agrupando ítems en `ready`, estén o no en el sprint activo, y sean históricos o del sprint en curso.
- El criterio de agrupación es **valor entregado**, no fecha.
- El `CHANGELOG` del release lista los ítems por su ID de backlog.

---

## 6. Cómo se refleja en una sprint spec

El campo `Status:` de `docs/sprints/SPRINT-XXX.md` o del frontmatter de tareas usa **exactamente** uno de estos valores canónicos en minúsculas:

```
ideas | draft | blocked | doing | review | ready | done
```

Una tarea en `blocked` declara además su motivo en el frontmatter:

```markdown
---
id: PLAY-NNN
status: blocked
blocked_reason: "Bloqueada: la API de pagos no define el contrato de idempotencia"
---
```

Y registra la transición operada cuando aplique:

```markdown
- **Status:** `review`
- **Last transition:** `review` → `ready` por QA Auditor (2026-10-04)
```