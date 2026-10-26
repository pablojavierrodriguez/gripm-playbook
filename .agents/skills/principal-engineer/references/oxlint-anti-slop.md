# Anti-Slop Linter Reference (Oxlint / AST)

Deterministic static analysis rules to eradicate AI-generated slop, evasion patterns, and unsafe type coercions.

---

## 1. Oxlint Configuration (`.oxlintrc.json`)

For TypeScript/JavaScript projects consuming the playbook, the recommended deterministic linter is **Oxlint** (Rust-based AST analysis, 50-100x faster than classic ESLint), integrable as a deterministic gate in Step 1 of the Verification Pyramid:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": [
    "typescript",
    "unicorn",
    "oxc"
  ],
  "categories": {
    "correctness": "error",
    "suspicious": "warn"
  },
  "rules": {
    "typescript/no-explicit-any": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "eslint/no-constant-condition": "error",
    "eslint/no-debugger": "error",
    "eslint/no-duplicate-case": "error",
    "eslint/no-empty": ["error", { "allowEmptyCatch": false }],
    "unicorn/no-unnecessary-await": "error",
    "unicorn/prefer-ternary": "warn"
  },
  "ignorePatterns": [
    "dist/**",
    "build/**",
    "coverage/**",
    "node_modules/**"
  ]
}
```

---

## 2. Integration in `package.json`

```json
{
  "scripts": {
    "lint:anti-slop": "oxlint --deny-warnings --config .oxlintrc.json",
    "lint": "oxlint"
  },
  "devDependencies": {
    "oxlint": "^0.15.0"
  }
}
```

---

## 3. AST Evasion Detection Rules

For projects with additional ESLint/AST plugin support (`@typescript-eslint/eslint-plugin` or `dmmulroy/anti-slop`), enable:
- `@typescript-eslint/consistent-type-assertions`: `["error", { "assertionStyle": "as", "objectLiteralTypeAssertions": "never" }]`
- `@typescript-eslint/no-unnecessary-type-assertion`: `"error"`
- **`as unknown as` evasion detection:** block via AST analysis or static check any sequence matching `as\s+unknown\s+as|as\s+any\s+as`.

In CI, `npm run lint:anti-slop` must run with a blocking exit code 1 before headless tests.
