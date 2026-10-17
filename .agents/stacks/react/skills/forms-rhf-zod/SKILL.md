---
name: forms-rhf-zod
description: Usar esta skill siempre que se cree o modifique un formulario - esquemas de validación con Zod, configuración de React Hook Form, manejo de errores, o integración con componentes Radix UI. También cuando el usuario mencione formularios, validación, "form", inputs, o mensajes de error de campos.
---

# Formularios: React Hook Form + Zod

Patrón estándar para todos los formularios del proyecto.

## Patrón base

1. Definir el schema de Zod (fuente de verdad de la validación).
2. Inferir el tipo TS del schema (`z.infer<typeof schema>`) - nunca declarar el tipo del formulario a mano por separado, para que no se desincronice del schema.
3. Conectar con `useForm` + `zodResolver`.

```ts
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  email: z.string().email({ message: 'errors.emailInvalid' }),
  name: z.string().min(2, { message: 'errors.nameTooShort' }),
});

type FormValues = z.infer<typeof schema>;

const { register, control, handleSubmit, formState: { errors } } =
  useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '' },  // ← siempre inicializar con ""
  });
```

---

## Inputs siempre controlados - nunca `undefined`

**Regla crítica**: inicializar siempre todos los campos con `defaultValues` en `useForm`. Usar `""` (string vacío) para strings, nunca `undefined`.

Si un campo puede ser nulo desde la base de datos, usar `?? ''` al asignar:

```ts
defaultValues: {
  name: entity?.name ?? '',
  email: entity?.email ?? '',
  phone: entity?.phone ?? '',
}
```

**Por qué**: React lanza el warning "A component is changing an uncontrolled input to be controlled" cuando el valor pasa de `undefined` a un string tras la carga inicial de datos. Inicializar siempre con string vacío previene re-renders innecesarios y warnings en consola.

---

## Integración con Radix UI

Los primitivos de Radix (`Select`, `Checkbox`, `RadioGroup`, etc.) no son `<input>` planos y no funcionan bien con `register()` directo. Para esos casos usar `Controller`:

```tsx
<Controller
  control={control}
  name="country"
  render={({ field }) => (
    <Select.Root value={field.value} onValueChange={field.onChange}>
      {/* ... */}
    </Select.Root>
  )}
/>
```

Para `<input>`, `<textarea>` nativos, `register()` alcanza y es más simple.

---

## Mensajes de error e i18n

Los mensajes en el schema de Zod deben ser **claves de traducción**, no texto plano. Usar el namespace `errors` del `es.json`:

```tsx
// En el schema:
z.string().email({ message: 'errors.emailInvalid' })

// Al mostrar el error:
{errors.email && <span>{t(errors.email.message)}</span>}
```

Coordinar con la skill `i18next-namespaces` para verificar que la clave exista en `src/locales/es.json` bajo el namespace `errors`.

---

## Errores de servidor y APIs

Si el backend devuelve un error de validación que no captura Zod (ej. "email ya registrado" o conflicto de unicidad), mapear al campo específico con `setError`:

```ts
// En el catch del submit:
if (error.status === 409 || error.code === 'CONFLICT') {
  setError('email', { type: 'server', message: 'api_errors.emailTaken' });
} else {
  setError('root', { type: 'server', message: 'api_errors.generic' });
}
```

No usar errores genéricos de formulario cuando se puede mapear a un campo específico - mejora sustancialmente la UX.

---

## Objetos anidados y estructuras compuestas

Para campos de objetos anidados (como metadatos o configuraciones estructuradas), guardar los campos con acceso por punto y proteger contra `undefined`:

```ts
// ✅ Correcto - guardar contra undefined en defaultValues
defaultValues: {
  metadata: {
    website: entity?.metadata?.website ?? '',
    notes: entity?.metadata?.notes ?? '',
  }
}
```

Garantizar siempre que las propiedades anidadas inicialicen con fallback para evitar warnings de reactividad cuando los datos provienen de fuentes asíncronas.

---

## Inputs numéricos y valores decimales localizados

En aplicaciones con formato regional hispanohablante o europeo, los valores numéricos y métricas suelen presentarse con separador de miles por punto (`.`) y decimales por coma (`,`).

**Regla de Oro:** Nunca usar `<input type="number">` para valores con decimales o importes si se pretende admitir decimales en español o separador de miles, ya que el navegador móvil/desktop fuerza la notación anglosajona (`.`) y rechaza comas.

### Patrón canónico con `formatThousandsInput` / `parseThousandsInput`

1. Mantener en el estado/RHF el string formateado visible para el usuario (`1.500,00`).
2. Sanitizar al parsear en Zod usando `z.preprocess` o convertir con `parseThousandsInput` al enviar al backend:

```ts
import { z } from 'zod';
import { formatThousandsInput, parseThousandsInput } from '@/lib/utils';

// Schema Zod para valores numéricos localizados
export const amountSchema = z.preprocess(
  (val) => (typeof val === 'string' ? parseThousandsInput(val) : val),
  z.number().positive({ message: 'El valor debe ser mayor a 0' })
);
```

```tsx
// Input controlado para valores numéricos con auto-formateo en blur o cambio
<input
  type="text"
  inputMode="decimal"
  placeholder="0,00"
  value={displayAmount}
  onChange={(e) => {
    // Permitir dígitos y coma/punto
    setDisplayAmount(e.target.value);
  }}
  onBlur={() => {
    const numeric = parseThousandsInput(displayAmount);
    if (!isNaN(numeric)) {
      setDisplayAmount(formatThousandsInput(numeric));
      setValue('amount', numeric);
    }
  }}
  className="font-mono text-right"
/>
```

