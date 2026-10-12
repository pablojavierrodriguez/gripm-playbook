---
name: code-level-ux-auditor
description: Audita estáticamente el código fuente en busca de anti-patrones de UX móvil, colisiones de gestos y scroll, oclusión de UI fija, janks de renderizado, micro-ergonomía y accesibilidad. Usar cuando se revise código de UI, antes de un commit, o cuando la tarea mentione touch targets, viewport móvil, teclado virtual, scroll, drag o a11y estática.
---

# Auditor Estático de UX a Nivel de Código

## Misión y Filosofía

La calidad de experiencia de usuario no es una capa de pintura: **se programa en el código**. Los bugs que más frustran al usuario —drag trabado, saltos de scroll, inputs que rechazan la coma, contenido tapado por la barra inferior, tirones de 15 FPS, botones sin nombre accesible— poseen **firmas estáticas inequívocas** en el código fuente.

Esta skill define las reglas de inspección y delega la detección mecánica en un runner de reglas declarativas.

---

## ⚙️ Tooling: el catálogo de reglas es la fuente de verdad

La detección **no** está hardcodeada en el script. Vive en `scripts/ux-rules.json`, que es la fuente de verdad canónica compartida entre esta skill y el runner:

```bash
node scripts/audit-ux-code.cjs            # human report
node scripts/audit-ux-code.cjs --strict   # falla también con WARNING
node scripts/audit-ux-code.cjs --format json
node scripts/audit-ux-code.cjs --list-rules
node scripts/audit-ux-code.cjs --rule UX-006
npm run audit:ux:baseline                 # snapshotear lo ya revisado
```

- **El motor es agnóstico del stack.** Las reglas que dependen de una librería declaran `requires.deps` y se saltan solas si la dependencia no está en el `package.json` del proyecto. No hay nombres de archivo ni de proyecto en el motor.
- ** severidades:** `ERROR` (rompe funcionalidad táctil, falla el audit sin `--strict`), `WARNING` (degrada, falla con `--strict`), `INFO` (higiene).
- **Supresión:** `// ux-audit-ignore` desactiva todas las reglas de la línea; `// ux-audit-ignore UX-004` solo esa. Opt-out por proyecto en `.uxaudit.json` (`disableRules`, `exclude`).
- **Baseline:** `audit-ux-baseline.json` registra las observaciones ya revisadas para poder adoptar el auditor sobre un codebase que ya tiene cientos de hallazgos, sin silenciar el gate ni ahogar en ruido irrecuperable. `npm run audit:ux:baseline` reescribe el snapshot. **`ERROR` nunca se absorbe**: una severidad que rompe el build no se silencia con un archivo.

### Anatomía de una unidad

El motor segmenta el archivo en **elementos JSX** y cada elemento expone tres granularidades. Elegir la correcta es lo que separa una regla precisa de una que inunda de falsos positivos:

| Campo | Qué incluye | Para qué sirve |
| :--- | :--- | :--- |
| `text` | Solo el tag de apertura y sus atributos | `line`, `alsoLine`, `unlessLine` — la firma vive en el elemento que la porta, y el hallazgo apunta a ese elemento, no a su wrapper |
| `ownContent` | El tag de apertura, el de cierre y los nodos de texto propios, **excluyendo** los descendientes | `alsoContent` — "¿este elemento es el que renderiza el valor?" |
| `scopeText` | El elemento **más** todos sus descendientes | `needsContent`, `unlessContent`, `unlessVisibleText` — "¿este elemento contiene aquello?" |

Ejemplo que separa las dos últimas:

```tsx
<div className="card">
  <span>{format(date, "MMMM yyyy")}</span>
</div>
```

Sobre el `<div>`: `needsContent: ["MMMM"]` matchea (el `<span>` es descendiente suyo), pero `alsoContent: ["MMMM"]` **no** — el `MMMM` vive dentro del hijo, no en el contenido propio del div. Sobre el `<span>` ambos matchean.

Esa distinción es la que hace que `UX-004` reporte el `<span>` que renderiza la fecha y no el `<div>` que lo envuelve.

- `unlessVisibleText: true` silencia la regla cuando el elemento renderiza texto visible. Ninguna lista de tokens puede expresar eso, y es lo que separa un botón etiquetado de uno icon-only: `<button><span>Guardar</span></button>` es accesible sin ningún atributo `aria-*`.
- `onlyFile` es el contrapositivo de `unlessFile`: corre la regla **solo** si el path contiene alguno de los tokens. Sin él, una regla acotada por contexto (`truncate` dentro de un diálogo) no es declarable, porque un filtro de archivo solo puede apagar una regla, nunca encenderla.

### Reglas propias del proyecto

Un proyecto que necesita firmas propias **no bifurca el motor**. Declara un catálogo suyo en `.uxaudit.json` y sus reglas corren junto a las canónicas:

```json
{ "src": "src", "rules": "audit-ux.local-rules.json" }
```

> [!CAUTION]
> **`UX-NNN` está reservado** para `scripts/ux-rules.json`. Un catálogo local que use ese patrón se rechaza con error. Es lo que garantiza que un `UX-009` signifique lo mismo en todos los consumidores: cuando un proyecto leía su propio `UX-009` como "touch target" mientras el skill documentaba otra cosa, el catálogo dejó de ser confiable. Elegí otro prefijo.

Para lo que el catálogo declarativo no alcanza, importá el motor en vez de copiarlo:

```js
const { auditProject } = require('@gripm/playbook/scripts/audit-ux-code.cjs');
const { findings, summary } = auditProject({ root: process.cwd() });
```

Importar el módulo **no** corre una auditoría; solo ejecutarlo como binario lo hace. `auditProject` devuelve `{ rulesVersion, srcDir, summary, findings, unreadable, absorbed }` y no imprime ni sale, así que el consumidor maneja la presentación.

> [!IMPORTANT]
> **Regla de manutenção:** si agregás una firma nueva, su `id` debe existir en **ambos** lados (`ux-rules.json` y esta tabla) con el mismo título y severidad. `UX-001..UX-008` son IDs históricos: **nunca se renumeran**. Las firmas nuevas se agregan desde `UX-009`.

---

## 📋 Catálogo canónico de firmas

### 1. [UX-001] · ERROR · Regional decimal comma blocker (input[type=number])
- **Firma:** `<input type="number">` para capturar montos o saldos.
- **Impacto:** En teclados móviles de LATAM el pad numérico muchas veces solo muestra `,` y desactiva `.`, pero el estándar HTML5 `type="number"` rechaza la coma en WebKit/Blink: valor vacío o error silencioso.
- **Corrección:** `inputMode="decimal"` con helpers bidireccionales de formato/parseo por locale.

### 2. [UX-002] · INFO · Physical keyboard shortcuts leaking into touch layouts
- **Firma:** chips `<kbd>`, el glifo `⌘` o textos `Ctrl+` sin ocultado responsivo.
- **Impacto:** En smartphone no existe teclado físico ni tecla Command; esos elementos contaminan headers y barras de acción móviles.
- **Corrección:** envolver en `hidden sm:inline-flex` o condicionar con `useIsMobile()`.

### 3. [UX-003] · WARNING · Drag gesture colliding with a scroll container
- **Firma:** `<Reorder.Group>` o `drag="y"` dentro de un contenedor `overflow-y-auto` sin compensar scroll.
- **Impacto:** el navegador interpreta el movimiento vertical como scroll nativo y dispara `pointercancel`, congelando el drag a mitad de camino. Además el scroll previo desincroniza las coordenadas y los ítems saltan.
- **Corrección:** Pointer Events nativos con `setPointerCapture`, transformaciones GPU, detección del scroll parent y auto-scroll en bordes. Mantener siempre controles accesibles de subir/bajar.
- **Gating:** requiere `framer-motion` / `motion`.

### 4. [UX-004] · WARNING · Temporal localisation leak (month/day names without locale)
- **Firma:** `format(date, "MMMM yyyy")` o `format(date, "EEEE")` sin argumento de locale.
- **Impacto:** UI mezclada ("January 2026", "Monday") dentro de un producto ya localizado.
- **Corrección:** importar el locale y pasarlo: `format(date, 'MMMM yyyy', { locale: activeLocale })`.
- **Gating:** requiere `date-fns`.

### 5. [UX-005] · ERROR · Autocapitalise / autocorrect trap on identity inputs
- **Firma:** `<input type="email">` sin `autoCapitalize="none"` ni normalización de valor.
- **Impacto:** los teclados iOS/Android fuerzan mayúscula inicial o agregan un espacio al final tras el autofill, provocando el error recurrente de credenciales inválidas.
- **Corrección:** `inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}` y normalizar con `.trim().toLowerCase()`.

### 6. [UX-006] · WARNING · Fixed bottom UI occluding scrollable content
- **Firma:** vistas con scroll padding `pb-16` / `pb-20` / `pb-24` mientras hay una barra inferior fija o un FAB, en lugar de `pb-32` + `safe-area-inset-bottom`.
- **Impacto:** las últimas filas de la lista quedan físicamente tapadas y son inalcanzables.
- **Corrección:** `pb-32` (o una variable CSS derivada del alto de la barra) más `env(safe-area-inset-bottom)` en el contenedor de scroll.

### 7. [UX-007] · INFO · Horizontal crowding on mobile cards (< 640px)
- **Firma:** fila `flex ... justify-between` que empaqueta 3 o más nodos complejos (icono + categoría + cuenta + badge + monto) sin `truncate` ni wrap.
- **Impacto:** títulos largos se superponen o empujan el monto fuera del viewport de 375px.
- **Corrección:** invariante de dos niveles — fila 1 identidad y monto, fila 2 contexto/chips. `min-w-0` en las columnas hijas y acciones secundarias colapsadas en un menú.

### 8. [UX-008] · WARNING · Micro-Jank: synchronous I/O or heavy compute per frame
- **Firma:** escrituras en `localStorage`/`sessionStorage`, `JSON.stringify` o `fetch()` dentro de handlers `onScroll`, `onPointerMove`, `onTouchMove`, `onDrag`, `onWheel` o `requestAnimationFrame`.
- **Impacto:** caída de 60 a menos de 15 FPS, lag perceptible durante la interacción táctil.
- **Corrección:** mantener el estado del gesto en memoria y persistir con debounce al soltar.
- **Nota:** detección heurística; revisar cada hallazgo manualmente.

### 9. [UX-009] · WARNING · Sub-44px touch target
- **Firma:** elemento interactivo con tamaño explícito menor a 36px (`h-5..h-8`, `w-5..w-8`, `size-6..size-8`) sin padding, `hitSlop` ni `min-*` compensatorio.
- **Impacto:** por debajo de ~36px el target queda short del mínimo de accesibilidad 44×44px y causa mis-taps.
- **Corrección:** `min-h-[44px] min-w-[44px]`, padding, o `hitSlop` de al menos 8px por eje.

### 10. [UX-010] · WARNING · Icon-only button without an accessible name
- **Firma:** botón que renderiza solo un icono, sin `aria-label`, `title` ni texto visualmente oculto.
- **Impacto:** el lector de pantalla anuncia un botón sin nombre; el control queda inutilizable.
- **Corrección:** `aria-label` (preferido) o un span `sr-only`.

### 11. [UX-011] · INFO · Arbitrary font size outside the canonical type scale
- **Firma:** `text-[Npx]` con un valor fuera de la escala del design system.
- **Impacto:** deriva tipográfica — dos componentes renderizan el mismo tamaño semántico con valores distintos.
- **Corrección:** usar la escala canónica (`text-xs`, `text-sm`, `text-base`, `text-lg`) o promover el valor a token documentado.

### 12. [UX-012] · INFO · Clickable element without tactile feedback
- **Firma:** elemento con `onClick` y `cursor-pointer` sin transición de estado `active`/`hover`.
- **Impacto:** en touch no existe hover, así que el usuario no tiene ninguna confirmación de que el tap registró.
- **Corrección:** agregar estado active (`active:scale-[0.98]`, `active:bg-secondary`), idealmente con `transition`.

### 13. [UX-013] · INFO · Monetary value without tabular numerals
- **Firma:** montos renderizados por un formateador (`toLocaleString`, `Intl.NumberFormat`, formateador de moneda) sin `tabular-nums` ni fuente monoespaciada de datos.
- **Impacto:** los dígitos de ancho proporcional provocan micro-saltos horizontales al cambiar el valor.
- **Corrección:** aplicar `tabular-nums` (o el token monoespaciado del proyecto) en toda columna numérica.

---

## ✅ Checklist de aceptación pre-merge

- [ ] ¿Los inputs de texto/email tienen `autoCapitalize` y sanitización?
- [ ] ¿Los inputs numéricos usan `inputMode="decimal"` y parseo por locale?
- [ ] ¿El contenedor scrolleable tiene despeje suficiente contra la UI fija inferior (`pb-32` + safe area)?
- [ ] ¿Los elementos interactivos tienen un target efectivo de 44×44px?
- [ ] ¿Si hay drag, se ejecuta con `setPointerCapture` y aceleración GPU?
- [ ] ¿Las fechas con nombres de mes/día llevan locale explícito?
- [ ] ¿Los montos y columnas numéricas usan `tabular-nums`?
- [ ] ¿Todo botón de icono tiene nombre accesible?
- [ ] ¿La revisión manual detecta sobrecarga decorativa —gradientes y orbes de fondo, `backdrop-blur` apilado en varias superficies, sombras uniformemente grandes— que degrade el contraste del texto o aplane la jerarquía? Buscá el efecto acumulado sobre el texto y sobre los bordes de superficie, no la técnica aislada: el vicio aparece por repetición, y una técnica justificada en un plano se vuelve ruido en tres.
- [ ] ¿`node scripts/audit-ux-code.cjs --strict` sale en verde?

> [!NOTE]
> La sobrecarga decorativa **no tiene firma mecánica**: el mismo `backdrop-blur` es correcto en un sheet y es slop en cinco. Es un ítem de revisión manual, no un finding del runner. Si algún día se vuelve declarable, su firma debe agregarse primero a `scripts/ux-rules.json` y recién después documentarse acá.