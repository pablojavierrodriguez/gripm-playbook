---
name: forms-rhf-zod
description: Best practices and patterns for forms using React Hook Form + Zod: schema validation, controlled inputs, error handling, Radix UI integration, and localized numeric formatting.
---

# Forms: React Hook Form + Zod

Standard patterns for robust, type-safe forms across the project.

## Base Pattern

1. Define the Zod validation schema (single source of truth for validation).
2. Infer the TypeScript type from the schema (`z.infer<typeof schema>`) - never declare form types manually to avoid drift.
3. Wire with `useForm` + `zodResolver`.

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
    defaultValues: { email: '', name: '' },  // always initialize with empty string
  });
```

---

## Always Controlled Inputs - Never `undefined`

**Critical Rule:** Always initialize all fields in `defaultValues` within `useForm`. Use `""` (empty string) for strings, never `undefined`.

If a field can be null from a remote API or database, use `?? ''`:

```ts
defaultValues: {
  name: entity?.name ?? '',
  email: entity?.email ?? '',
  phone: entity?.phone ?? '',
}
```

**Why:** React triggers the warning *"A component is changing an uncontrolled input to be controlled"* when value transitions from `undefined` to a string after initial fetch. Initializing with empty strings avoids unnecessary re-renders and console noise.

---

## Radix UI Integration

Radix primitives (`Select`, `Checkbox`, `RadioGroup`) are composite components, not raw `<input>` elements. Use `Controller` from `react-hook-form`:

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

For native `<input>` and `<textarea>`, direct `register()` is simpler and fully sufficient.

---

## Error Messages and Internationalization (i18n)

In internationalized projects, Zod error messages should be translation keys rather than hardcoded text:

```tsx
// In the schema:
z.string().email({ message: 'errors.emailInvalid' })

// When rendering the error:
{errors.email && <span>{t(errors.email.message)}</span>}
```

If the project uses an i18n library (e.g., `react-i18next`), ensure translation keys exist under the appropriate namespace (e.g., `errors` or `validation`). In non-internationalized projects, clear literal strings can be passed directly.

---

## Server and API Errors

When the backend returns a domain validation error not caught client-side (e.g., unique email conflict), map to the specific field via `setError`:

```ts
if (error.status === 409 || error.code === 'CONFLICT') {
  setError('email', { type: 'server', message: 'api_errors.emailTaken' });
} else {
  setError('root', { type: 'server', message: 'api_errors.generic' });
}
```

Mapping errors to specific fields dramatically improves UX over generic top-level error banners.

---

## Nested Objects and Composite Structures

For nested object fields (such as metadata or structured settings), map dot-notation keys and protect against `undefined`:

```ts
defaultValues: {
  metadata: {
    website: entity?.metadata?.website ?? '',
    notes: entity?.metadata?.notes ?? '',
  }
}
```

---

## Localized Numeric Inputs and Decimal Values

In regional applications (e.g., European or Latin American numbering), numbers often format with `.` as thousands separator and `,` as decimal separator.

**Golden Rule:** Avoid `<input type="number">` for localized currency or decimal amounts. Browsers force Anglo-Saxon decimal dots (`.`) and reject localized comma notation. Use `<input type="text" inputMode="decimal">` with explicit format/parse helpers.

### Canonical Pattern with Self-Contained Helpers

```ts
import { z } from 'zod';

// Standalone formatting and parsing utilities
export function parseThousandsInput(value: string): number {
  if (typeof value === 'number') return value;
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(normalized);
}

export function formatThousandsInput(value: number, locale = 'es-ES'): string {
  if (isNaN(value)) return '';
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

// Zod schema with preprocess
export const amountSchema = z.preprocess(
  (val) => (typeof val === 'string' ? parseThousandsInput(val) : val),
  z.number().positive({ message: 'Value must be greater than 0' })
);
```

```tsx
// Controlled input with onBlur auto-formatting
<input
  type="text"
  inputMode="decimal"
  placeholder="0,00"
  value={displayAmount}
  onChange={(e) => setDisplayAmount(e.target.value)}
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

