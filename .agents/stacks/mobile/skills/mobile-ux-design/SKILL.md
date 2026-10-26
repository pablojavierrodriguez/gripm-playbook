---
name: mobile-ux-design
description: Usar esta skill siempre que se diseñen, modifiquen o auditen interfaces móviles, vistas responsivas, modales/sheets en mobile, comportamiento con teclado virtual, touch targets, safe areas o integración PWA.
---

# Mobile UX & Responsive Design Standards

Guía de estándares para garantizar que la aplicación ofrezca una experiencia táctil y fluida de clase mundial tanto en navegadores móviles como en pantallas táctiles y Progressive Web Apps (PWA).

---

## 1. Ergonomía Táctil y Touch Targets

- **Tamaño mínimo de toque:** Todo botón, switch, enlace o elemento interactivo debe tener un área táctil mínima de **44×44px** (o padding suficiente que garantice la facilidad de toque).
- **Adiós al Hover exclusivo:** En mobile no existe el cursor `hover`. Toda interacción debe responder con feedback táctil inmediato (`active:scale-[0.98]`, `active:bg-muted/40` o transiciones de opacidad).
- **Patrón `.icon-only-mobile`:**
  En toolbars y cabeceras de pantallas estrechas (`< 640px`), ocultar textos largos y dejar el icono centrado y reconocible:
  ```tsx
  <Button variant="outline" size="sm" className="h-10 px-3 icon-only-mobile">
    <Download className="h-4 w-4" />
    <span className="btn-label hidden sm:inline">{t("common.export_btn")}</span>
  </Button>
  ```

---

## 2. Safe Areas y Layout Nativo (Capacitor / Android / iOS)

- **Notch y Barra de Gestos:** Utilizar variables seguras de CSS para no chocar con la barra de estado o la barra de gestos del sistema:
  ```css
  padding-top: max(1rem, env(safe-area-inset-top));
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
  ```
- **Botones Flotantes (FAB) y Bottom Bar:**
  Asegurar un margen inferior de al menos `pb-32` más `env(safe-area-inset-bottom)` (o `pb-[calc(8rem+env(safe-area-inset-bottom))]`) en contenedores desplazables con barras inferiores fijas o FAB para garantizar que el último contenido nunca quede oculto detrás del footer (conforme a la regla `UX-006`).

---

## 3. Modales, Sheets y Formularios Móviles

- **Drawer / Bottom Sheet:**
  En mobile, preferir que los formularios y vistas de edición se abran como **Bottom Sheets** (deslizables verticalmente desde la base) en lugar de modales pequeños flotantes.
- **Acciones fijas en formularios:**
  Los botones de "Guardar" y "Cancelar" deben ubicarse en un footer fijo (`sticky bottom-0 bg-background/95 backdrop-blur-md border-t p-4`) con ancho mínimo (`min-w-[140px]`) para que el usuario siempre pueda guardar sin tener que hacer scroll hasta el final del formulario.
- **Prevención de Zoom no deseado:**
  Todos los `<input>`, `<textarea>` y `<select>` deben tener un `font-size` de al menos `16px` (`text-base` o `text-sm sm:text-xs`) en mobile para evitar que iOS/Android hagan zoom automático al enfocar el campo.

---

## 4. Patrón Canónico "Table to Cards"

En pantallas móviles (`< 768px`), las tablas de datos **deben transformarse en tarjetas apiladas**:

```tsx
{/* 1. Vista Mobile: Cards apiladas */}
<div className="block md:hidden divide-y divide-border/40">
  {filtered.map((item) => (
    <div 
      key={item.id} 
      className="p-4 space-y-3 active:bg-muted/30 transition-colors"
      onClick={() => openDetails(item)}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-foreground">{item.name}</span>
        <Badge variant="outline">{item.status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
    </div>
  ))}
</div>

{/* 2. Vista Desktop: Tabla completa */}
<div className="hidden md:block">
  <Table>
    {/* ... Thead, Tbody ... */}
  </Table>
</div>
```

### 4.1. Jerarquía Vertical de Tarjetas (Anti-Hacinamiento)
En pantallas de 375px a 390px de ancho, evitar sobrecargar una sola fila horizontal con múltiples datos heterogéneos (icono + título + badges + métricas o valores + fechas).
- **Nivel 1 (Identidad y Dato Principal):** `flex items-start justify-between`. A la izquierda: Icono/avatar (36x36px) y bloque de texto con `min-w-0 flex-1` (título `truncate` + subtítulo `truncate`). A la derecha: Dato principal o cifra con `font-mono` grande y alineado.
- **Nivel 2 (Contexto y Metadatos):** `flex flex-wrap items-center gap-1.5`. Chips sutiles para fecha, estado o categoría.
- **Nivel 3 (Acciones y Footer):** `flex items-center justify-between pt-2 border-t`. Estado general y acciones táctiles.

### 4.2. Control de Saturación de Acciones (`Action Creep Rule`)
- Nunca exponer 3 o 4 botones chicos seguidos en una fila en mobile.
- Si una entidad tiene más de 1 acción (ej: editar, archivar, reasignar, borrar), mantener **1 botón de acción directa** (ej: `+` o `Continuar`) y condensar el resto en un `DropdownMenu` accesible activado por un botón `MoreVertical` de mínimo 36-40px.

---

## 5. Teclados Virtuales e Inputs Específicos

- Usar siempre el `type` e `inputMode` semánticos adecuados:
  - **Teléfonos:** `type="tel"` con componente `PhoneInput`.
  - **Números / Edades / Códigos:** `type="text" inputMode="numeric" pattern="[0-9]*"`.
  - **Emails:** `type="email" autoCapitalize="none" autoCorrect="off"`.
  - **Búsquedas:** `type="search" enterKeyHint="search"`.

---

## 6. Feedback Táctil y Haptics

Cuando se realicen acciones críticas (eliminación destructiva, guardado confirmado), integrar feedback háptico si la plataforma lo soporta:

```ts
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Acción exitosa
export const triggerSuccessHaptic = async () => {
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
};

// Acción destructiva o advertencia
export const triggerWarningHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
};
```

---

## 7. PWA Universal & Experiencia de Instalación (WebAPK / iOS / Desktop)

Para permitir que los usuarios instalen la aplicación como una Progressive Web App (PWA) independiente:

- **Centralized PWA Installation Event Handling:**
  - Capture the `beforeinstallprompt` event at the window level using a shared hook or context provider to keep install prompt availability reactive across views.
  - Never trigger install banners or modal prompts during unauthenticated screens or critical onboarding flows.
- **Platform-Specific Help Guides:**
  - **Android (Chrome/Edge):** Point users to the top menu (⋮) -> *Install app* / *Add to Home screen*.
  - **iOS / iPadOS (Safari):** Point users to the Share icon -> *Add to Home Screen*.
  - **macOS / Desktop:** Point users to the browser install pill in the address bar or File -> *Install*.
- **Scroll Resiliency on Authentication Screens:**
  - For mobile login/signup forms, ensure `overflow-y-auto min-h-full pb-12` without rigid vertical spacers or `overscroll-y-none`, so the submit button remains visible when the virtual keyboard is open.

---

## 8. Tablet Experience (768px - 1024px) & Symmetric Action Toolbars

In intermediate viewports (tablets, collapsible sidebar layouts):

### A. Structural Decoupling of Headers (Zero-Truncate Rule)
- **Do not wrap action buttons in `<Sheet>` components inside the flex row:** Modals and Sheets must live outside the action button container to prevent breaking natural `flex-wrap` layout.
- **Avoid `truncate` in main `h1` titles:** Let titles wrap naturally into two lines when constrained, rather than truncating with ellipses ("Manage...", "Config...").

### B. Responsive Action Toolbars and Collapsible Button Labels
- **Problem:** On intermediate viewports or when a sidebar expands, horizontal header space shrinks. If primary action buttons hold long text while secondary actions are icon-only, toolbars become asymmetrical and cause horizontal overflow.
- **Canonical Pattern:**
  1. Use responsive utility classes to collapse text labels on intermediate viewports while keeping an accessible label for screen readers:
     ```tsx
     <Button className="h-10 px-3.5 bg-primary text-primary-foreground shadow-sm flex items-center gap-1.5" aria-label={createLabel}>
       <Plus className="h-4 w-4 shrink-0" />
       <span className="hidden xl:inline whitespace-nowrap">{createLabel}</span>
     </Button>
     ```
  2. For icon-only states, ensure the tap target remains strictly $\ge 40 \times 40\text{px}$ (ideally $\ge 44 \times 44\text{px}$) with centered icons.
  3. **Outcome:** Symmetric, predictable action rows that adapt smoothly across viewports without fragile DOM-coupled CSS selectors.

---

## 9. Viewports Móviles Estrechos (375px) & Resiliencia en Modales

Para garantizar que ningún elemento quede cortado o inaccesible en teléfonos compactos:

### A. Regla de Altura Segura en Diálogos y Modales
- **`max-h-[85dvh] overflow-y-auto` obligatorio:** Todo `DialogContent` que contenga formularios, instrucciones o listas debe incluir `max-h-[85dvh] overflow-y-auto`. Esto previene que los diálogos se corten con la barra de navegación del navegador, notches o con el teclado virtual desplegado.

### B. Footers de Acciones Responsivos (Modales de Detalle y Formularios)
- En mobile (`< 640px`), los footers con múltiples acciones nunca deben forzarse en una sola fila (`flex-row`). Deben usar `flex-col-reverse sm:flex-row` con `grid grid-cols-1 sm:flex` para que botones como *Acciones secundarias*, *Descartar* o *Confirmar* nunca queden fuera del viewport visible.

### C. Consistencia Temática (Light/Dark Tokens)
- **Prohibido hardcodear fondos oscuros (`bg-slate-900`, `text-white`):** Todo componente flotante, banner o modal debe utilizar tokens temáticos de Tailwind (`bg-card/95 text-foreground border-border/80 bg-muted/40`) para que cambie armoniosamente al alternar entre modo claro y modo oscuro.

### D. Agrupación de Filtros y Switches en Mobile
- En matrices o listas de switches (como Notificaciones en Perfil), usar anchos compactos (`w-12 sm:w-20` y `gap-2 sm:gap-6`) para que los títulos de categoría no se compriman en líneas partidas antiestéticas.
- En selectores temporales de Dashboard o barras de categorías (Logs), envolver siempre en `w-full sm:w-auto overflow-x-auto no-scrollbar` con etiquetas responsivas compactas (`sm:hidden` / `hidden sm:inline`).


