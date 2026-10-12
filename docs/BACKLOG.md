# Backlog

> **Este archivo no es el backlog.** Es la convención que lo governa.
> Los ítems de **este** repo viven en **`backlog/tasks/`**, en formato [Backlog.md](https://github.com/MrLesk/Backlog.md), el mismo estándar que usan `gripm` y `dev-board`. `backlog/` no se instala: si adoptás el playbook en tu proyecto, este archivo es la guía y vos creás tu propio `backlog/tasks/`.
>
> **Vocabulary de estados:** ver [`.agents/STATE_MACHINE.md`](../.agents/STATE_MACHINE.md).
> **Status válidos:** `ideas` | `draft` | `blocked` | `doing` | `review` | `ready` | `done` | `dismissed`
> **El backlog no es un status.** Un ítem sin status es un ítem que aún no entró al flujo. Para recibir `doing` tiene que haber pasado el **refinement gate (R1)**.

---

## 1. Por qué Backlog.md y no GitHub Issues

`README.md` le indica al PM Orchestrator leer los ítems del backlog vía GitHub MCP, y `STATE_MACHINE.md` exige que el release liste los ítems por su ID de backlog. Ese formato es el estándar de la organización: `gripm` y `dev-board` lo usan, y el auditor, el parser y los hooks de `gripm` solo lo entienden.

Un ítem del playbook es un ítem de la organización. Si viviera en otro formato, dejaría de ser sincronizable y el release dejaría de poder citar IDs reales.

**GitHub Issues sigue siendo el canal de entrada** para quien reporta un defecto desde afuera. Traducir ese reporte a un ítem formal es trabajo del PM Orchestrator, no del que reporta.

---

## 2. Dónde vive cada cosa

| Artefacto | Ubicación | Contiene |
| :--- | :--- | :--- |
| **Backlog** | `backlog/tasks/` | Todo ítem, en archivos Backlog.md con frontmatter |
| **Consolidado** | `BACKLOG.md` | Generado desde `backlog/tasks/`. No se edita a mano. |
| **Release log** | `CHANGELOG.md` | Solo lo que ya se publicó. **Nunca** trabajo abierto. |
| **Sprint** | `docs/sprints/SPRINT-XXX.md` | Los ítems comprometidos en un timebox |

> [!CAUTION]
> El changelog no es una bitácora. Anotar un ítem abierto en `## [Unreleased]` no lo registra: lo esconde. `Unreleased` queda vacío por diseño.

---

## 3. Ciclo de vida de un ítem

El status vive en el campo `status:` del frontmatter y **nunca** en el changelog.

| Momento | Dónde se registra | Quién |
| :--- | :--- | :--- |
| Aparece un problema | Issue o ítem nuevo, `status: ideas` | cualquiera |
| Pasa el **gate R1** | `status: draft` + ACs medibles | PM Orchestrator |
| `doing` | frontmatter | Principal Engineer |
| Se frena | `status: blocked` + `blocked_reason` | PO / Dev |
| `review` | frontmatter | Principal Engineer |
| `ready` | frontmatter + `gate:qa` en verde | **Solo QA Auditor** (T2) |
| `done` | frontmatter + issue cerrado | Release Management, tras deploy real |
| Entra en un release | `CHANGELOG.md`, bajo su ID | Release Management |

Los IDs son estables, monotónicos y nunca se reutilizan. El prefijo de este repo es `PLAY-`; los ítems de `gripm` usan `DEV-`. Un release puede agrupar ambos, y en ese caso el changelog cita los dos.

---

## 4. Definiciones

- **ID:** `PLAY-NNN`. Estable, monotónico, nunca reutilizado. Es lo que aparece en el changelog.
- **Refined:** flag `yes (fecha)` / `no — falta: <qué>`. Es el **gate R1**, no un status.
- **Status:** `ideas`, `draft`, `blocked`, `doing`, `review`, `ready`, `done`, `dismissed`.
- **Prioridad:** `high` · `medium` · `low`.
- **`blocked_reason`:** obligatorio y no vacío **únicamente** cuando `status: blocked`. Fuera de ese status, el campo es un error de validación.

---

## 4.b Estado `blocked`: registrar el impedimento

`blocked` existe para que una tarea frenada no mienta. Sin él, el ítem queda en `doing` indefinidamente: el WIP del sprint está inflado y nadie recuerda por qué se paró.

```markdown
---
id: PLAY-NNN
status: blocked
blocked_reason: "Bloqueada: el contrato de idempotencia de la API de pagos no está definido"
dependencies:
  - PLAY-012
---
```

Reglas:

1. `blocked_reason` es **obligatorio** y no vacío. Un bloqueo sin motivo escrito es una tarea abandonada, no una tarea bloqueada.
2. Solo se asigna con `blocked_reason`; el campo es inválido en cualquier otro status.
3. Volver a `doing` o `draft` requiere que el impedimento se haya resuelto **o** que sus `dependencies:` bloqueantes estén en `done` o hayan sido desvinculadas explícitamente del array.
4. El desbloqueo no borra el `blocked_reason`: queda el registro histórico del impedimento.

> Un ítem no entra a `doing` ni se certifica en `ready` mientras alguna de sus `dependencies:` no esté en `done`. El gate runner (`npm run gate:qa <ID>`) rechaza la certificación mecánicamente.

---

## 5. Reglas de higiene

1. Un ítem no recibe `doing` sin haber pasado el refinement gate.
2. Un ítem no pasa a `review` con ACs sin marcar.
3. Ningún ítem se marca `done` sin deploy real.
4. Un ítem `ready` que recibe un fix post-QA vuelve a `doing` y pierde la certificación.
5. Los ítems no completados en el timebox vuelven al pool conservando su refinamiento.
6. Todo tech debt detectado en QA o retrospectiva genera un ítem nuevo.
7. **Nada se anota en el changelog hasta que se publica.** Un ítem sin archivo en `backlog/tasks/` está perdido.
8. `status: blocked` sin `blocked_reason` no vacío es un ítem inválido.
9. Un ítem no entra a `doing` ni se certifica en `ready` con una `dependencies:` sin resolver en `done`.

---

## 6. Frontmatter de un ítem

```markdown
---
id: PLAY-NNN
title: "Título en imperativo"
status: draft
created_date: 'YYYY-MM-DD'
updated_date: 'YYYY-MM-DD'
labels: ["area"]
dependencies: [PLAY-002]
priority: medium
type: feature
blocked_reason: "Solo si status: blocked; obligatorio en ese caso"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
[Qué está roto o falta, desde la perspectiva del usuario]
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Criterio medible
- [ ] #2 Criterio medible
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Paso concreto
<!-- SECTION:PLAN:END -->
```

Los marcadores `SECTION:*` y `AC:BEGIN/END` son los que leen el parser de `gripm`. Un archivo sin ellos no se indexa.