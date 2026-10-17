---
name: recharts-reporting
description: Usar esta skill siempre que se construyan gráficos, dashboards, reportes o vistas de estadísticas con Recharts, o cuando el usuario mencione charts, gráficos, reportes visuales o visualización de datos.
---

# Recharts: convenciones de reportes

## Contenedor responsivo obligatorio

Todo chart va envuelto en `ResponsiveContainer` con altura fija en el padre (Recharts no puede calcular altura automática):

```tsx
<div style={{ width: '100%', height: 320 }}>
  <ResponsiveContainer>
    <LineChart data={data}>{/* ... */}</LineChart>
  </ResponsiveContainer>
</div>
```

**En móvil**: usar `width: '100%'` en el contenedor externo también para el eje X - los contenedores que no respetan esto generan scroll horizontal involuntario en vistas móviles o embebidas.

---

## Forma de los datos

Formatear los datos ANTES de pasarlos al chart (no dentro del render de cada `<Line>`/`<Bar>`): array de objetos planos, una clave por serie.

```ts
const data = rows.map(r => ({
  name: formatDate(r.date),      // ya formateado para eje X
  metrica: r.metricCount,
  promedio: r.average,
}));
```

**Advertencia**: no recrear el array de datos dentro del render del componente. Si los datos provienen de un contexto o hook de estado global, no re-mapearlos en cada render sin `useMemo`:

```ts
const chartData = useMemo(() => 
  rows.map(r => ({ name: formatDate(r.date), value: r.count })),
  [rows]
);
```

---

## Colores y tema

Usar los mismos tokens de color que Tailwind (no hardcodear hex sueltos en cada chart). Definir una paleta compartida en un solo archivo (`chartColors.ts`) y reusarla en todos los reportes, para consistencia visual y para poder cambiarla en un solo lugar.

Evitar depender solo del color para distinguir series (accesibilidad) - combinar con patrones de línea, íconos en la leyenda, o labels directos cuando el chart tiene pocas series.

---

## Performance

- `useMemo` para la transformación de datos si el dataset es grande o el componente padre re-renderiza seguido.
- No pasar el array de datos recreado en cada render (rompe memoización interna de Recharts).
- Si el backend ofrece endpoints o funciones de agregación precalculadas, aprovecharlas en lugar de realizar cómputos pesados en el hilo principal del cliente.

---

## Tooltips y formato

Formatear números/fechas en el `formatter` del `<Tooltip>`, no en el dato crudo (así el eje puede seguir ordenando/calculando sobre el valor numérico real).

**Locale del proyecto**: usar formato regional estándar (`es-ES`, `es-AR` o el locale activo):

```tsx
<Tooltip formatter={(value: number) => value.toLocaleString('es-ES')} />
```

```tsx
// Eje X de fechas:
<XAxis
  dataKey="name"
  tickFormatter={(date) => new Date(date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
/>
```

---

## Labels en filtros de rango

Al implementar pills/tabs de rango de tiempo (7d, 30d, 3m, etc.), usar labels cortos para que no desborden el viewport en mobile:

```tsx
// ✅ Correcto
['7d', '30d', '3m', '6m', '1a']

// ❌ Desborda en mobile
['Última semana', 'Último mes', 'Últimos 3 meses']
```

Mantener los chips breves previene saltos de línea involuntarios y saturación visual en pantallas estrechas.

---

## Patrón de Sparklines y KPIs

- Las tarjetas métricas (KPI cards) pueden complementar el valor principal con sparklines (mini `LineChart` o `AreaChart` sin ejes ni tooltips) para reflejar tendencias inmediatas de manera limpia.
