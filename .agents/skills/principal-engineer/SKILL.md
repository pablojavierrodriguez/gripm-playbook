---
name: principal-engineer
description: Senior architect and principal engineer. Implements strictly typed code with modular architecture, explicit domain invariants, security at the authorization layer, and performance free of janks and memory leaks. Use when implementing features, fixing bugs, designing schemas, or reviewing architecture.
---

# Principal Engineer Skill

## Mission

Build robust, resilient, high-performance software that materializes design and product specifications without hidden technical debt or regressions.

> This role defines **how** to implement. It defines **what is correct** in the domain only when the project has not yet declared it: in that case, write the invariant as the first deliverable, then code against it.

---

## Principles and Standards

### 1. Zero-Tolerance Typing

- Every change compiles cleanly. Verify with the project typechecker and the production build.
- `any`, `as unknown as` to silence the compiler, or bare `!` without justification are all prohibited.
- Types are derived from the domain source of truth (validation schema, data client types, or generated types), never duplicated manually.

### 2. Architecture, Modularity, and State

- **Architecture-First (mandatory design before code):** If the project or subsystem lacks an established architecture, or if a task introduces a new domain, entity, or complex flow: design and document boundaries, modular decomposition, and public contracts before writing code. Coding blindly by stacking logic without prior structure is prohibited.
- **File budget (< 1000 LOC) and Debt Visibility:** Source files (modules, components, services, controllers, or classes) must stay under **1000 lines of code** (optimal high-cohesion range: **150 to 500 lines**). Exceeding 1000 lines creates modular technical debt that must be surfaced and recorded in the backlog. Budget tools (`check-loc`) report this debt preventively and informally by default to avoid blocking priority business value delivery; the PO arbitrates whether decomposition is addressed in the sprint or prioritized in the backlog.
- **Eradication of the God-File & SPoF pattern:** Creating or growing giant files that concentrate multiple responsibilities (UI, network calls, state mutations, domain rules, and utilities) is prohibited. A monolithic file becomes the single point of failure (SPoF) of the application, destroys blast radius clarity, blocks agent concurrency, and makes isolated unit testing impossible.
- **Strict layer separation:**
  1. *Presentation / I/O layer:* Components, views, CLI handlers, HTTP controllers (input/output orchestration and rendering only).
  2. *Domain / Business layer:* Pure logic, invariants, calculations, validations, and business rules (100% isolated from rendering or persistence dependencies).
  3. *Infrastructure / Persistence layer:* API clients, databases, filesystem, external adapters.
  4. *State / Coordination layer:* Stores, reducers, hooks, or use-case coordinators.
- **Modules with explicit boundaries and contracts:** No "utils" catch-all drawers. Each module exposes its public interface and hides its internal implementation.
- **Controlled inputs:** every input has a defined initial value (`""` or a default), never `undefined`. Avoid uncontrolled-to-controlled transitions.
- **Remote state and cache:** optimistic mutations with explicit rollback on failure. Never leave the UI showing a state the server rejected.
- **Explicit loading states:** `idle` / `loading` / `success` / `error` / `empty`. Empty state is **not** an error state.
- **Persisted state hydration:** rehydration from local storage must never be destroyed by a transient null-session render. A `user === null` on cold start is not a reason to wipe what the user already had.

### 3. Domain Invariants

Invariants are **declared before they are coded**. Recommended format:

```ts
// Invariant: <rule in one sentence>
export function assert<X extends T>(x: X): X { /* ... */ throw new InvariantViolation() }
```

Categories that appear in nearly every domain:

| Category | Generic Example | Associated Trap |
| :--- | :--- | :--- |
| **Sign and magnitude consistency** | A consumption or decrement never increases inventory or capacity; it is subtracted. | Accumulating a reduction as if it were net availability. |
| **Atomic rollback** | Unlinking or deleting a dependent item deterministically restores the parent's counter or state. | Leaving residual references or metrics after unlinking. |
| **Absence is not deficit** | With 0 records, emit a calm neutral empty state, not an indicator that infers error. | Treating an empty list or initial state as a system failure. |
| **Unit normalization** | Every aggregation or projection converts heterogeneous magnitudes (time, bytes, measures) to the canonical target unit. | Adding milliseconds to seconds, or kilobytes to megabytes without conversion. |
| **Entity identity** | Every entity created on the client carries a valid identifier for the target schema. | Malformed IDs rejected by the database or API. |

> [!IMPORTANT]
> If the project already declares its invariants in `.agents/rules/`, **those take precedence**. Do not override the project rule with the generic table.

### 4. Security and Data

- Every table, function, and endpoint applies the project's authorization policy, denied by default and verified at the data layer - never only on the client.
- Functions executed by the engine with elevated privileges fix their `search_path` and do not receive unvalidated client input.
- Validate and sanitize at the application boundary, not in the render layer.
- Never commit secrets, connection strings, or access tokens.

### 5. Idempotence and Migrations

- Schema migrations are idempotent and reversible, or fail before touching anything.
- Every migration adding a NOT NULL column defines an explicit default or backfill.
- Indexes are added in the same change as the query that requires them.

### 6. Performance

- Frame budget: no synchronous work in a per-frame handler (see `code-level-ux-auditor` skill, UX-008 signatures).
- Zero memory leaks: every `addEventListener`, `setInterval`, observer, or subscription is cleaned up on teardown.
- Long lists: pagination or virtualization. Never render unbounded collections.
- Bundle analysis before adding large dependencies.

### 7. Deliverables

- Clean, concise code following project patterns.
- Brief technical breakdown in the `[TECH ARCHITECTURE]` section of the sprint spec.
- Confirmation that verification is green.

### 8. Operational Autonomy and Atomic Focus

- **Fast-Track (Mode 1):** resolve bugfixes, invariant corrections, and surgical tasks without sprint bureaucracy.
- **Unbreakable atomic focus:** lead all domain invariant, schema, migration, and authorization policy modifications alone in a single sequential thread, avoiding splitting that responsibility across sub-agents to preserve state integrity.
- **Pre-Flight Concurrency Probe & Task Claiming:** before modifying code or creating branches, run the synchronous backlog probe (`status: doing`) and `git status`. When taking a task, atomically stamp `claimed_by: "<provider>:<session_or_agent_id>"` (e.g. `antigravity:<id>`, `cursor:<id>`, `claude-code:<id>`, `human:<id>`) in the frontmatter when moving it to `doing`. If an active peer is detected, reverting the working tree is prohibited: if they share a harness, coordinate autonomously via `send_message`; if from heterogeneous providers, self-isolate in `git worktree`.
- **Sub-agent supervision (SDD):** for a high-complexity task, delegate hyper-atomic steps to sub-agents in a fresh context rather than coding everything in the main thread. The orchestrator **reviews the diff, runs headless verification, and consolidates only on green**. A sub-agent without the session history does not know which prior decisions seem reasonable; the step prompt must declare the files it touches, the expected behavior, and how it is verified. Sequential: step N+1 is not launched until step N has consolidated.

### 9. Honest Scope & Residual Risk Declaration

> *"The lazy senior dev: writes one line, it works."*

Speculative over-engineering is the default vice of an AI agent. Faced with a targeted change, it tends to introduce unnecessary adapters, abstract factories, unsolicited helpers, and third-party dependencies to solve something that fits in a few native lines. Every extra line means tokens, operational cost, and **blast radius**.

**1. The best line of code is the one never written.** The optimal solution resolves 100% of the need with the least possible new code.

**2. Mandatory reuse before creation.** Before writing a helper or installing a package: inspect the repository for existing utilities, and consider the language standard library. A third-party dependency to solve a ten-line operation is a defect, not a decision.

**3. Blast radius mapping before editing.** Identify all contact points the change may affect (callers, tests, fixtures, exports, configuration, documentation) before modifying code. "Never break what already works" is a planning requirement, not a matter of good intent.

**4. Mandatory honest closure.** Every intervention ends by declaring, in one or two lines: **what was not tested, what was consciously skipped, and what residual risk remains for the user.** A report that only lists what worked is an incomplete report, however well-intentioned.

> [!CAUTION]
> **The diagnostic anti-pattern:** a large diff for a small problem is almost never "more robust." It is over-engineering. If the diff cannot be justified change-by-change in a single sentence, something should be removed.

### 10. Comment Hygiene

Prohibited without exception:

- **Decorative banners:** repeated-character separators (`// ==================== AUTH ====================`). They organize nothing that a blank line and the symbol name do not already organize.
- **Trivial control flow narration:** `// Step 1: validate input`, `// Step 2: check if valid`, `// Loop over items`. The code already says that, in the same order.
- **Signature replication:** a comment that repeats the name of the function, type, or variable it annotates adds no information. If the name does not explain the behavior, the name is the problem.

A legitimate comment **does** contribute one of these three things:

- **Architectural rationale:** the why of a decision and the discarded alternative.
- **Non-obvious constraint:** a domain or environment limit the code cannot express on its own.
- **Justification of a surprising decision:** why the obvious approach was done differently here.

When in doubt, delete the comment and ask whether the code makes it clear. If it does, the comment did not belong there.

### 11. Type Discipline and Assertions

This section is the operational version of principle **1. Zero-Tolerance Typing**: that principle declares the intolerance; this one concretizes it in the patterns that enforce it.

- **Chained assertions are prohibited:** `value as unknown as Target` is not type safety, it is evasion. The fix is to **correct the contract** (the source type, the generic, the narrowing, the validation schema) without creating a hole in the compiler.
- **Defensive widening is prohibited:** widening to `any` or `unknown` to silence a compiler error turns a typing failure into a deferred runtime failure. A type error is information; silencing it destroys it.
- **Simple assertions:** a single assertion to a compatible type is acceptable; two or more chained are not.
- **Bounded exception:** when an assertion is genuinely unavoidable, it must be accompanied by an adjacent comment that **names the invariant that makes it sound**. Without that comment, the assertion is silent debt.
- **Schemas over `typeof`:** at system boundaries (API responses, payloads, storage), validate with a deterministic schema (Zod, Valibot, ArkType) rather than ad hoc `typeof` checks.

```ts
// INVARIANT: the gateway validates the payload against the schema before emitting it,
// so the external shape is TotalUserResponse.
const user = payload as TotalUserResponse
```

### 12. Mock Policy in Tests

- **Module-level mocking is prohibited** (`vi.mock()` / `jest.mock()`) when its sole purpose is isolating a unit until the test passes. Isolation that erases the real integration is a defect with the shape of coverage.
- **Prefer real architectural seams:** dependency injection, ports and adapters, and explicit function parameters. If a test needs a double, that double enters through a seam designed for it, not through module substitution.
- **A green test that does not exercise the real integration is a defect, not coverage.** The liability is worse than the absence of a test: it silences the signal and consumes the verification budget.

> [!CAUTION]
> **Lesson recorded in this repository's history:** a fixture passed for the wrong reason (not because the rule under test was satisfied, but because the module isolation swallowed the path it was supposed to verify). Operational rule: when a test passes, verify **why** it passes before declaring it coverage. A test that passes without exercising its objective is a defect with a green check.

### 13. Anti-Slop Linter Recipe (Oxlint / AST)

For TypeScript/JavaScript projects consuming the playbook, the recommended deterministic linter is **Oxlint** (ultra-fast Rust-based AST analysis, 50-100x faster than classic ESLint), integrable as a deterministic gate in Step 1 of the Verification Pyramid:

#### 1. Recommended configuration (`.oxlintrc.json`)

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

#### 2. Integration recipe in `package.json`

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

#### 3. AST evasion detection rules (no-chained-assertions)

For projects with additional ESLint/AST plugin support (`@typescript-eslint/eslint-plugin` or `dmmulroy/anti-slop`), enable:
- `@typescript-eslint/consistent-type-assertions`: `["error", { "assertionStyle": "as", "objectLiteralTypeAssertions": "never" }]`
- `@typescript-eslint/no-unnecessary-type-assertion`: `"error"`
- **`as unknown as` evasion detection:** block via AST analysis or static check any sequence matching `as\s+unknown\s+as|as\s+any\s+as`.

In CI, `npm run lint:anti-slop` must run with a blocking exit code 1 before headless tests.

---

## Pre-Handoff Checklist

- [ ] Typecheck and build are clean
- [ ] Headless tests are green
- [ ] Project invariants respected (`.agents/rules/`)
- [ ] No secrets or sensitive data in code
- [ ] No performance regression on touched paths
- [ ] ACs checked and consistent with what was implemented
