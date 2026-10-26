# Stack Pack: React

Optional skills for projects using **React**. Not installed by default: these are technology-specific implementation recipes, not part of the core agnostic framework.

## Included Skills

| Skill | Applies When |
| :--- | :--- |
| `forms-rhf-zod` | Creating or modifying forms with React Hook Form + Zod. |
| `ui-radix-tailwind` | Building UI components on top of Radix primitives styled with Tailwind CSS. |
| `recharts-reporting` | Building charts, analytics dashboards, or data visualization views with Recharts. |

## Installation

```bash
node scripts/sync-playbook.mjs --stack react
```

## Expected Dependencies

These skills assume your project already includes:

- `react` · `react-dom`
- `tailwindcss`
- `@radix-ui/*` (for `ui-radix-tailwind`)
- `react-hook-form` · `zod` · `@hookform/resolvers` (for `forms-rhf-zod`)
- `recharts` (for `recharts-reporting`)

> If your project uses an alternative UI primitive, forms library, or charting engine, **do not install this stack pack**: define your stack invariants in `.agents/rules/` instead.

## Backend Note

Integration examples illustrate client queries with row-level security or API clients. **Adapt them to your project's architecture**: the playbook does not dictate your backend.