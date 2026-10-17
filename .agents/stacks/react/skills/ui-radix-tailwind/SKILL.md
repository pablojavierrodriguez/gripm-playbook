---
name: ui-radix-tailwind
description: Usar esta skill siempre que se construyan o modifiquen componentes de UI usando primitivos de Radix estilados con Tailwind, o cuando el usuario mencione design system, componentes accesibles, o patrones de UI reutilizables.
---

# UI: Radix + Tailwind

## Convención de carpeta

```
src/components/ui/
  button.tsx
  dialog.tsx
  select.tsx
```

Cada archivo envuelve un primitivo de Radix (que viene sin estilos) con clases de Tailwind, y se reusa en toda la app en vez de estilizar Radix "a mano" cada vez que se usa.

---

## Design System - Reglas de colores (obligatorio)

**Usar únicamente variables semánticas definidas en el proyecto:**
- `primary` / `primary-foreground`
- `accent` / `accent-foreground`
- `destructive` / `destructive-foreground`
- `muted` / `muted-foreground`
- `background`, `foreground`, `border`, `card`, `popover`

**Prohibido usar clases de color hardcodeadas** como `text-blue-500`, `bg-red-400`, `text-green-600`, etc. Rompe la coherencia del design system y dificulta el theming.

```tsx
// ✅ Correcto
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
// ❌ Prohibido
<button className="bg-blue-600 text-white hover:bg-blue-700">
```

**Gradiente:** usar clases de utilidad del proyecto como `gradient-primary` o tokens semánticos definidos en `index.css`. No inventar gradientes ad-hoc hardcodeados con hex sueltos.

---

## Permisos y Visibilidad Condicional en UI

Toda UI que depende de un permiso, rol o feature flag debe estructurarse mediante componentes de control declarativo o hooks de autorización:

```tsx
// ✅ Control declarativo por capacidades o flags
<FeatureGate feature="items:edit">
  <Button>Editar</Button>
</FeatureGate>

// ❌ Evitar verificación dispersa hardcodeada
{userRoles.includes('admin') && <Button>Editar</Button>}
```

Para verificaciones programáticas en manejadores de eventos o flujos:
```tsx
const { can } = usePermissions();
if (!can('items:delete')) return;
```

Favorecer siempre verificación basada en capacidades (`can('items:edit')`) antes que inspección acoplada a nombres de roles estáticos.

---

## Radix es unstyled - el estilo va en el wrapper

```tsx
// components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

export function Button({ asChild, className, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(baseStyles, className)} {...props} />;
}
```

## `asChild` para componer

Cuando se necesita que un primitivo de Radix (ej. `Dialog.Trigger`) renderice como otro componente (ej. tu `Button` custom) en vez de su tag por defecto, usar `asChild` en lugar de anidar elementos interactivos:

```tsx
<Dialog.Trigger asChild>
  <Button variant="outline">Abrir</Button>
</Dialog.Trigger>
```

---

## Variantes de estilo

Usar una librería de variantes (ej. `class-variance-authority`) en vez de condicionales de clases a mano, para mantener consistentes los componentes del design system:

```ts
const buttonVariants = cva(baseStyles, {
  variants: {
    variant: { primary: '...', outline: '...', ghost: '...' },
    size: { sm: '...', md: '...', lg: '...' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});
```

---

## No romper la accesibilidad que trae Radix

Radix ya maneja foco, teclado y ARIA correctamente. Reglas:

- No quitar `:focus-visible` sin poner un estilo de foco alternativo - Radix depende de esto para navegación por teclado.
- No agregar `onClick` a divs para simular botones cuando existe un primitivo Radix que ya resuelve eso (`Dialog`, `DropdownMenu`, etc.).

---

## Bugs mobile ya resueltos - no reincidir

### Scroll en Dialog / AlertDialog / Sheet

En pantallas pequeñas (mobile web y APK), el contenido puede desbordarse. Agregar siempre `overflow-y-auto` al contenedor del contenido:

```tsx
<DialogContent className="max-h-[90vh] overflow-y-auto">
  {/* contenido */}
</DialogContent>
```

### Inputs controlados - nunca `undefined`

Todo `<input>` o `<textarea>` conectado a React Hook Form o estado local debe tener un valor inicial definido. Usar `""` (string vacío) en lugar de `undefined` para evitar el warning de React "uncontrolled to controlled component":

```tsx
// ✅ Correcto
const [name, setName] = useState("");

// ❌ Provoca warning
const [name, setName] = useState<string>();
```

Inicializar siempre con string vacío evita que el input cambie de estado no-controlado a controlado durante el ciclo de vida del componente.

### Responsive mobile vs desktop

- Usar breakpoints de Tailwind para adaptar layouts: `hidden lg:flex`, `flex-1 min-w-0`, etc.
- En dispositivos móviles o pantallas reducidas, los filtros y barras de acción deben ser `flex-wrap` o reducirse a `icon-only` para evitar desbordamientos horizontales.
- Las barras de navegación fijas inferiores deben respetar las variables de entorno de safe area (`env(safe-area-inset-bottom)`) para no colisionar con controles nativos del sistema.

### `CardHeader` con padding simétrico

Usar `py-4` en lugar de `pb-3` en `CardHeader` para centrado vertical consistente de elementos en toolbars:

```tsx
<CardHeader className="py-4 flex-row items-center justify-between">
```

### Prevención de Flicker en Dialogs con Tabs

Al usar `Tabs` con contenido asíncrono (como gráficos o timelines) dentro de un `Dialog` que ajusta su altura de forma dinámica (`max-h-*`), el modal puede parpadear o redimensionarse abruptamente al cambiar de pestaña.
Para evitar esto:
1. Utilizar `forceMount` en los componentes `TabsContent`. Esto obliga a Radix a renderizar ambos paneles en el DOM desde el inicio, precargando la altura y anulando el flicker.
2. Controlar la visibilidad mediante clases de CSS (ej: `data-[state=inactive]:hidden`) para que los paneles inactivos no interfieran.
3. Asignar un contenedor scrollable (`overflow-y-auto`) a cada pestaña de forma independiente en lugar de asignar el scroll al Dialog global.

```tsx
<Tabs defaultValue="profile">
  <TabsList className="shrink-0">
    <TabsTrigger value="profile">Perfil</TabsTrigger>
    <TabsTrigger value="activity">Actividad</TabsTrigger>
  </TabsList>
  <TabsContent value="profile" forceMount className="overflow-y-auto data-[state=inactive]:hidden">
    {/* Contenido */}
  </TabsContent>
  <TabsContent value="activity" forceMount className="overflow-y-auto data-[state=inactive]:hidden">
    <ComponenteAsincrono />
  </TabsContent>
</Tabs>
```

### Scroll Horizontal en Tablas Móviles

El componente `ScrollArea` de Radix controla su propio viewport de scroll mediante Javascript, lo que interfiere con el scroll horizontal nativo (`overflow-x-auto`) cuando una tabla de múltiples columnas desborda la pantalla móvil.
Para tablas responsivas:
- Evitar envolver la tabla en `ScrollArea` si hay riesgo de desborde horizontal.
- En su lugar, utilizar un `div` contenedor nativo con clases `overflow-x-auto` y un contenedor hijo con `overflow-y-auto max-h-[500px]` para el scroll vertical.
- Asignar una propiedad de ancho mínimo (`min-w-[480px]`) a la `<Table>` para asegurar que el contenido mantenga espacio legible.
- **Al remover un import de `ScrollArea`, buscar todos los usos en el archivo antes de guardar.** El IDE no siempre reporta el error hasta el siguiente build.

---

## Patrón: Filtros Unificados en Popover (≥ 3 filtros)

Cuando una página de lista tiene **3 o más filtros**, nunca renderizarlos inline en el toolbar. Usar un único `Popover` con botón `"Filtros"` (con etiqueta en desktop y mobile) + badge contador de filtros activos. Este patrón aplica a todas las resoluciones.

```tsx
// ✅ Correcto - Popover unificado con label y contador
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm" className={cn("h-10 px-3",
      hayFiltrosActivos && "border-primary bg-primary/5"
    )}>
      <SlidersHorizontal className="h-4 w-4 mr-2" />
      <span className="text-xs font-bold">{t("common.filters")}</span>
      {cantidadFiltros > 0 && (
        <span className="ml-1.5 h-4 w-4 rounded-full bg-primary text-[9px] font-black text-primary-foreground flex items-center justify-center">
          {cantidadFiltros}
        </span>
      )}
    </Button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-80 p-4 space-y-4 z-50">
    {/* filtros agrupados por sección con label uppercase */}
  </PopoverContent>
</Popover>

// ❌ Prohibido - filtros inline en toolbar con 3+ filtros
<div className="hidden md:flex items-center gap-2">
  <Select .../>
  <Select .../>
  <Select .../>
  <Input type="date" .../>
  <Input type="date" .../>
</div>
```

**Reglas del Popover de filtros:**
- El botón usa `size="sm"` con `px-3` (no `size="icon"`). Mismo diseño en desktop y mobile.
- El `PopoverContent` tiene `w-80 p-4 space-y-4 z-50`.
- Cada filtro dentro del Popover lleva su label `text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70`.
- Incluir siempre un botón `"Limpiar todo"` visible solo cuando hay filtros activos.
- El badge contador es inline dentro del botón (no absoluto), con `ml-1.5`.

---

## 🎛️ Patrón: Matrices de Configuración y Canales (Heurísticas de Nielsen)

Para pantallas de preferencias, permisos o canales (ej. `/profile` notificaciones, matrices de roles/notificaciones):

1. **Evitar etiquetas repetitivas por fila (Heurística #8 - Minimalismo)**:
   - **Prohibido** repetir dentro de cada fila "pills" o cajitas con los nombres de canal (*"Campana en la app: Switch"*, *"Alerta al dispositivo: Switch"*).
   - Usar una **cabecera unificada por categoría** con columnas fijas (`[ Evento ] | [ 🔔 App ] | [ 📱 Push ]`).
2. **Microcopy conciso y monosilábico (Heurística #8)**:
   - Títulos de columna breves: usar **"App"** y **"Push"** en lugar de frases largas.
   - Envolver el texto de la cabecera en `whitespace-nowrap` con un ancho fijo de columna (`w-20`) y `gap` homogéneo con los switches inferiores para evitar que el texto se quiebre en dos líneas.
3. **Anclaje visual con Iconografía Semántica (Heurística #6 - Reconocimiento)**:
   - Cada fila de configuración debe incluir un contenedor de ícono a la izquierda (`h-8 w-8 rounded-lg`) con su color semántico de fondo y texto (`bg-blue-500/10 text-blue-600` para tareas, `bg-indigo-500/10 text-indigo-600` para reuniones, etc.). Esto evita la monotonía visual y facilita el escaneo rápido en Z/F.
4. **Visibilidad y Deshabilitación Contextual (Heurística #1)**:
   - Si un canal depende de permisos de hardware/navegador (ej. Push), los switches correspondientes deben deshabilitarse si el permiso no está otorgado, acompañados de un tooltip o banner de estado claro.

---

## Componente `DateRangePicker`

Existe el componente reutilizable `src/components/ui/date-range-picker.tsx` para seleccionar un rango de fechas. Usar **siempre** este componente en lugar de dos `<input type="date">` separados.

```tsx
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

<DateRangePicker date={dateRange} setDate={setDateRange} />
```

**Para filtrar datos con el rango:**
```tsx
// En filtrado en memoria
if (dateRange?.from) {
  matchesDate = matchesDate && item.date >= dateRange.from.toISOString();
}
if (dateRange?.to) {
  const toDate = new Date(dateRange.to);
  toDate.setHours(23, 59, 59, 999);
  matchesDate = matchesDate && item.date <= toDate.toISOString();
}

// En query de base de datos / cliente remoto (ej. Supabase, Prisma, TypeORM)
if (dateRange?.from) query = query.gte("starts_at", dateRange.from.toISOString());
if (dateRange?.to) {
  const toDate = new Date(dateRange.to);
  toDate.setHours(23, 59, 59, 999);
  query = query.lte("starts_at", toDate.toISOString());
}
```

**Reglas:**
- `numberOfMonths={1}` dentro de Popovers (2 meses no entra en el ancho estándar de 320px).
- El componente usa `react-day-picker` en modo `range` con `locale={es}` de `date-fns/locale`.
- El placeholder por defecto es `"Seleccionar fechas"`.
- `date-fns` y `react-day-picker` ya están en `package.json` - no instalar alternativas.

---

## Gotcha: JSX nesting mal anidado → blank page

Al refactorizar bloques JSX grandes, un `div` que debe ser **hermano** puede quedar accidentalmente como **hijo** de otro `div`. React no lanza error en consola pero el árbol de renderizado queda roto y la página aparece en blanco.

**Señales de alerta:**
- Blank page sin error visible en consola del navegador.
- TypeScript compila sin errores (`tsc --noEmit` sale limpio).

**Verificación rápida:** al refactorizar un toolbar o sección de header con estructura `flex-row`, confirmar que los elementos `flex-col` (título) y `flex-row` (acciones) sean hijos directos del mismo contenedor padre.

---

## 🏛️ Estándar Oficial de Modales de Detalle (ReadOnly / Info)

Todos los modales de consulta o visualización de entidades (vistas de detalle, paneles informativos, etc.) **deben compartir una arquitectura coherente y tokens visuales consistentes**:

```tsx
<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
  <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 rounded-2xl border-none shadow-2xl bg-background overflow-hidden">
    {/* 1. Barra de Acento */}
    <div className="h-1.5 w-full shrink-0 bg-primary/80" />

    {/* 2. Cabecera Estática */}
    <DialogHeader className="p-6 pb-4 shrink-0">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-muted/40">
            {categoryBadge}
          </Badge>
          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
            {statusBadge}
          </Badge>
        </div>
        <DialogTitle className="text-2xl font-black leading-tight text-foreground">{title}</DialogTitle>
      </div>
    </DialogHeader>

    {/* 3. Cuerpo Scrolleable */}
    <div className="overflow-y-auto px-6 pb-6 space-y-4 flex-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoRow icon={<Calendar className="h-4 w-4 text-primary" />} label="Fecha / Horario" value={formattedDate} />
        <InfoRow icon={<MapPin className="h-4 w-4 text-primary" />} label="Ubicación" value={location} />
      </div>

      {/* 4. Tarjeta de Notas / Descripción */}
      {notes && (
        <div className="p-3 rounded-xl border border-border/40 bg-muted/5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">Notas</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{notes}</p>
        </div>
      )}

      {/* 5. Botonera Inferior Fija */}
      <div className="flex flex-col sm:flex-row items-center gap-2 pt-3 border-t border-border/40 w-full shrink-0">
        <Button variant="outline" className="w-full sm:w-auto sm:px-4 h-10 text-xs font-semibold" onClick={onClose}>
          Cerrar
        </Button>
        <div className="flex items-center gap-2 w-full sm:flex-1 justify-end">
          {/* Acciones principales alineadas a la derecha */}
          <Button className="h-10 px-3 text-xs font-semibold bg-primary text-primary-foreground shadow-md shrink-0" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
          </Button>
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

### Componente `InfoRow` Oficial
```tsx
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-muted/5">
    <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 mb-0.5">{label}</p>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{value}</div>
    </div>
  </div>
);
```

---

## 🛡️ Checklist Anti-Blank Obligatorio (Antes de dar una tarea por terminada)

1. **Ejecutar `npx tsc --noEmit`**: 0 errores de tipado o imports faltantes.
2. **Revisar cierre de JSX**: Ningún tag o bloque cortado (`}`, `</div>` o snippets residuales dentro del render).
3. **Validar subconsultas y relaciones**: Usar tipado estricto y defensivo con fallback en cliente si la relación puede retornar nulos.
4. **Verificar ciclo de vida de modales anidados**: Si un modal abre otro secundario (ej. modal de confirmación o flujo anidado), nunca cerrar o desmontar el padre en el trigger del hijo si coexisten en el mismo árbol de render.

