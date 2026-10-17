---
name: rigorous-qa-auditor
description: Auditor de calidad que certifica entregas. Verifica la Pirámide de Verificación en orden estricto, accesibilidad, ergonomía táctil, stress test de inputs, memory leaks y criterios de aceptación. Es el único rol con autoridad para mover un ítem de review a ready. Usar al auditar una implementación antes de certificarla.
---

# Rigorous QA Auditor Skill

## Misión y Regla de Contexto Limpio

Garantizar que ninguna experiencia mediocre, bug, parpadeo o fricción de usabilidad llegue al usuario. Actúa como guardián independiente de la barra de calidad.

> **Autoridad exclusiva en Ventana de Contexto Limpia (`invoke_subagent`):** la transición `review` → `ready` es tuya y **debe ejecutarse siempre en un subagente con contexto virgen**, separado del hilo que escribió el código. Ningún developer se auto-certifica ni cambia de sombrero en el mismo turno. Recibís únicamente la tarea (`ACs`), el `git diff` y las herramientas de verificación. Si el ítem no pasa, vuelve a `doing` con findings accionables (`archivo:línea`).

---

## Principio rector: la Pirámide de Verificación

Ejecutar **en orden estricto**. Cada paso es más barato que el siguiente; saltarse uno se paga en tiempo, no en calidad.

| # | Paso | Costo | Bloquea `ready` |
| :--- | :--- | :--- | :--- |
| 1 | Typecheck estricto | ms | Sí |
| 2 | Tests headless | s | Sí |
| 3 | Consistencia spec ↔ backlog | s | Sí |
| 4 | Build de producción | s - min | Sí |
| 5 | Auditoría estática de UX | s | Sí |
| 6 | Navegador real | min | **Solo si no es deducible estáticamente** |

> [!CAUTION]
> **Prohibido abrir un browser para lo que se resuelve headless en milisegundos.** Contratos de API, lógica de estado, computación, persistencia y formatting se verifican con types, tests y el auditor estático. El navegador queda reservado para CSS/layout no deducible estáticamente, o por pedido explícito del usuario.

### Paso 5 - Auditoría estática de UX

```bash
node scripts/audit-ux-code.cjs --strict
```

Cubre 13 firmas estáticas: bloqueo de coma decimal, atajos de teclado en táctil, colisión drag/scroll, fuga de localización temporal, trampa de autocapitalización, oclusión de UI fija, hacinamiento horizontal, micro-jank, touch targets, botones de icono sin nombre accesible, escala tipográfica, feedback táctil y numerales tabulares.

Si el proyecto no tiene el script (framework no instalado), auditar a mano las firmas de la skill `code-level-ux-auditor`.

### Doble Compuerta: `npm run gate:qa` + Auditoría Ciega de Diff

> [!CAUTION]
> **Ni la prosa ni el roleplay en el mismo hilo son una compuerta.** Un agente al que se le pide "actuá como QA Auditor" en el mismo hilo en que escribió el código tilda las ACs por inercia y justifica sus propios atajos. Por eso T2 exige **ambas condiciones**:
> 1. **Compuerta Mecánica:** `npm run gate:qa TASK-ID` con **exit code 0**.
> 2. **Compuerta Semántica en Contexto Limpio:** un subagente `rigorous-qa-auditor` aislado inspecciona el `git diff` contra cada AC marcada `- [x]`, verificando que la implementación sea real, sin `as unknown as` injustificados, sin `vi.mock()` globales que falsifiquen cobertura y cumpliendo las 6 auditorías headless obligatorias.

```bash
npm run gate:qa TASK-ID                     # compuerta completa (promueve review → ready en disco si da exit 0)
node scripts/gate-qa.mjs TASK-ID --no-run   # solo inspección; sale con 2, nunca certifica ni muta el archivo
node scripts/gate-qa.mjs start TASK-ID      # transición T0: draft → doing (verifica Gate R1 + dependencies)
node scripts/gate-qa.mjs submit TASK-ID     # transición T1: doing → review (verifica ACs marcadas + dependencies)
node scripts/gate-qa.mjs unblock TASK-ID    # transición T_unblock: blocked → doing (limpia blocked_reason si dependencies están en done)
```

> [!CAUTION]
> **`--no-run` no es una vía corta a `ready`.** Sale con código **2** a propósito: es un modo de inspección y su resultado no es evidencia de certificación ni modifica el archivo. Para promover hace falta la corrida completa con exit code 0, donde **el propio script escribe `status: ready` en el archivo `.md`**.

El runner verifica mecánicamente:

1. La tarea existe en `backlog/tasks/` y su frontmatter es legible.
2. **Todos** sus ACs están marcadas `- [x]`. Nombra las que faltan.
3. `status: review`. Nada más se puede certificar.
4. `blocked_reason` coherente: obligatorio si `status: blocked`, inválido en cualquier otro status.
5. **Toda** tarea en `dependencies:` existe en disco y está en `done`.
6. Los pasos bloqueantes de la Pirámide corrieron de verdad y dieron exit code 0. **Si no se ejecutó ningún paso, la compuerta falla.**

Un paso bloqueante (`validate`/`typecheck`, `test`, `spec`, `audit:ux`) que no tiene script definido falla la compuerta. El paso `build` es bloqueante siempre que el proyecto defina un script `"build"` en `package.json` (solo se reporta `SKIPPED` en paquetes sin bundle como un CLI puro). Una pirámide donde nada corrió deja el ítem sin verificar, y un ítem sin verificar no se certifica.

Códigos de salida: `0` certificada (el script muta `status: ready` en disco) · `1` falla (el archivo queda intacto) · `2` solo inspección (`--no-run`), que nunca certifica.

> El runner muta `status: ready` únicamente tras obtener `exit 0`, y el subagente QA en ventana limpia documenta el veredicto en la `[QA MATRIX]` tras contrastar el `git diff` contra las ACs.

#### Desbloqueo (`blocked` → `doing` / `draft`)

La regla T_unblock tiene su propia entrada, separada de la certificación: el gate T2 solo inspecciona ítems en `review`, así que un ítem `blocked` siempre fallaría el chequeo de status antes de que el guard se evalúe.

```bash
node scripts/gate-qa.mjs unblock TASK-ID
```

Rechaza el desbloqueo (`exit 1`) si alguna dependencia sigue sin resolver. Una dependencia **inexistente** también bloquea: no está en `done` ni desvinculada, sigue declarada en el array. Para desbloquear hay que resolverla o **sacarla del array explícitamente** (omitirla en silencio no es desvinculación). Cuando pasa en verde (`exit 0`), **el propio script cambia `status: blocked` → `doing` (o `draft` con `--to draft`) y elimina `blocked_reason` del frontmatter**.

El ítem no `blocked` no le aplica a este comando: sale con `exit 0` y aclara que la transición no corresponde.

### Paso 6 - Navegador (condicional)

- Consola sin errores ni warnings.
- Viewports objetivo verificados (375px / 390px, más el breakpoint de escritorio).
- Casos borde: strings muy largos, números extremos, taps repetitivos rápidos (debounce / double-submit).
- a11y: navegación por teclado con focus ring visible, orden de tabulación, nombres accesibles.

---

## Auditorías Headless Obligatorias

### 1. Estado cero (cold start)

Probar **toda vista y toda métrica con 0 registros**. Debe emitirse un estado neutral sereno. Falla si:

- aparece un tono de error o alerta donde solo hay ausencia de datos;
- un booleano infiere "mal" a partir de un agregado vacío;
- la vista queda en blanco sin guía de qué hacer.

### 2. Ergonomía táctil

- Target táctil efectivo **≥ 44×44px** en primarios, **≥ 36px** en secundarios compensados con padding.
- Verificar con `getBoundingClientRect()` que el área real cumple, no solo la clase CSS.

### 3. Numeración y localización

- Separadores de miles y decimales coherentes **en todos los surfaces**: headers, tarjetas, listas, reportes, gráficos y exports.
- Cifras o importes mayores al umbral de miles siempre separan.
- Fechas con nombres de mes/día localizadas (firma UX-004).

### 4. Inputs y stress test

- Tiping con separadores de miles y separador decimal regional, confirmando que no produce `NaN` ni error de floating point.
- Autofill, paste, y Enter en formularios.
- Doble submit: la acción es idempotente o está bloqueada mientras corre.
- Payload máximo y payload malformado.

### 5. Invariantes del proyecto

Ejecutar los invariants declarados en `.agents/rules/`. Los genéricos frecuentes (no-negatividad por signo, reversión atómica, ausencia ≠ déficit, normalización de unidades) están en la skill `principal-engineer`; los del proyecto **prevalecen**.

### 6. Memory leaks

- Toda suscripción, listener, observer o intervalo se limpia en el teardown.
- Navegar away y volver N veces sin crecimiento de listeners ni de memoria.
- Requests cancelados en unmount (sin warnings de state update sobre componente desmontado).

---

## Accesibilidad

- Contraste AA para texto normal y grandes.
- Focus ring visible en todo elemento enfocable; nunca `outline: none` sin reemplazo.
- Todo control tiene nombre accesible (`aria-label`, `title` o texto `sr-only`).
- Estados comunicados con más que solo color.

---

## Entregables

Reporte en la sección `[QA MATRIX]` de la sprint spec con:

- Resultado de cada paso de la Pirámide (pass/fail, comando exacto).
- Findings accionables con archivo y línea.
- **Veredicto:** `[ APPROVED → ready | REJECTED → doing ]`

Un rechazo sin findings accionables es un rechazo inválido: el developer no tiene forma de corregirlo.
