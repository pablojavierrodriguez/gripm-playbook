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
  Asegurar un margen inferior de al menos `pb-20` o `pb-24` en contenedores desplazables para que el contenido no quede oculto detrás de barras inferiores o botones flotantes de acción principal.

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

- **Hook de Instalación Centralizado (`usePWAInstall`):**
  - Capturar el evento `beforeinstallprompt` a nivel de ventana global y compartir el estado `isGuideOpen` y `promptAvailable` mediante un bus de listeners global para evitar instancias aisladas desincronizadas.
  - Ocultar **estrictamente** cualquier banner o prompt de instalación en pantallas de autenticación inicial o para usuarios no autenticados.
- **Diferenciación por Plataforma en el Modal de Ayuda:**
  - **Android (Chrome/Edge):** Indicar el menú superior de tres puntos (⋮) $\rightarrow$ *Instalar aplicación* / *Agregar a la pantalla principal*. Recordar que en entornos de desarrollo por IP (`192.168.x.x`), Chrome requiere habilitar el origen en `chrome://flags` (*Insecure origins treated as secure*) para compilar el WebAPK nativo en vez de un marcador web.
  - **iOS / iPadOS (Safari):** Indicar el botón Compartir $\rightarrow$ *Agregar al inicio*.
  - **macOS / Desktop:** Indicar el menú *Archivo* $\rightarrow$ *Agregar al Dock...* o el botón de instalación en la barra de direcciones.
- **Scroll Resiliente en Pantallas de Autenticación:**
  - En formularios móviles de acceso, asegurar `overflow-y-auto min-h-full pb-12` sin spacers rígidos ni `overscroll-y-none` para que el botón de submit siempre sea accesible cuando el teclado virtual esté desplegado.

---

## 8. Experiencia en Tablets (768px a 1024px) y Botoneras Simétricas

En dispositivos intermedios (iPads, tablets Android, pantallas con sidebar expandible):

### A. Desacople Estructural de Cabeceras (Zero-Truncate Rule)
- **Prohibido colocar `<Sheet>` envolviendo botones de acción:** Los componentes de diálogo/sheet deben vivir fuera del `<div>` que contiene los botones (`Button`, export dropdown). De lo contrario, rompen el flujo `flex-wrap` natural.
- **Evitar `truncate` en títulos `h1`:** Los títulos principales de vista deben fluir de manera natural para acomodarse en dos líneas si es necesario, sin truncarse con puntos suspensivos ("Gestión...", "Config...").

### B. Patrón Canónico de Botoneras Simétricas (`.btn-action-label`)
- **Problema:** Al expandir la barra lateral en tablet (768px), el sidebar roba 256px de ancho, apretando la cabecera. Si un botón de creación tiene texto largo (*"Crear Elemento"*) mientras los de Importar/Exportar son solo icono, el layout queda desbalanceado y asimétrico.
- **Solución Canónica:**
  1. Envolver el texto de todo botón de creación principal con `<span className="btn-action-label whitespace-nowrap">...</span>`:
     ```tsx
     <Button className="bg-primary text-primary-foreground shadow-md h-10 px-3.5">
       <Plus className="mr-1.5 h-4 w-4" />
       <span className="btn-action-label whitespace-nowrap">{t("common.create")}</span>
     </Button>
     ```
  2. En CSS, el selector reactivo del sidebar expandido en tablet colapsa automáticamente todas las etiquetas a modo icono cuadrado `40px × 40px` (`min-width: 2.5rem; height: 2.5rem;`) con icono perfectamente centrado (`margin: 0 !important;`):
     ```css
     @media (max-width: 1023px) {
       .peer[data-state="expanded"] ~ div .btn-action-label,
       body:has([data-state="expanded"]) .btn-action-label {
         display: none !important;
       }
       .peer[data-state="expanded"] ~ div button:has(.btn-action-label),
       body:has([data-state="expanded"]) button:has(.btn-action-label) {
         min-width: 2.5rem !important;
         height: 2.5rem !important;
         padding-left: 0.75rem !important;
         padding-right: 0.75rem !important;
       }
       .peer[data-state="expanded"] ~ div button:has(.btn-action-label) svg,
       body:has([data-state="expanded"]) button:has(.btn-action-label) svg {
         margin-right: 0 !important;
         margin-left: 0 !important;
       }
     }
     ```
  3. **Resultado:** Al expandir el sidebar, toda la botonera (*Crear (+)*, *Importar*, *Exportar*) adopta proporciones cuadradas idénticas y simétricas, y al colapsar el sidebar vuelven a mostrar sus etiquetas de texto completas sin romper el diseño.

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


