# Gripm Playbook

**Deterministic delivery governance for AI coding agents.**

One command configures your repository. Work scales dynamically from surgical bugfixes to full sprints, a mechanical gate verifies every deliverable, and the agent that wrote the code never certifies itself.

[![npm version](https://img.shields.io/npm/v/@gripm/playbook.svg)](https://www.npmjs.com/package/@gripm/playbook)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-slate.svg)](LICENSE)

---

## Quickstart

Initialize the playbook in any repository:

```bash
npx @gripm/playbook init
```

```text
  gripm · Playbook Onboarding
  ✔ Detected stack: react (Next.js + Tailwind + Zod)
  ✔ Installed 6 core skills + 3 react stack skills (.agents/)
  ✔ Installed mechanical gates (gate-qa, audit-ux, check-loc)
  ✔ Configured native harness adapters (AGENTS.md, CLAUDE.md, .cursor/rules/)
  ✔ Recorded sha256 baseline in .playbook-lock.json
```

Keep an existing installation up to date without overwriting local customizations:

```bash
npx @gripm/playbook sync
```

---

## Why Gripm Playbook

Most agentic workflows fail at one of two extremes: **unbounded autonomy** (agents jump straight to mutating code, skip architecture, and introduce regressions) or **static bureaucracy** (forcing a 10-page specification for a two-line fix).

Gripm Playbook treats agent orchestration as a **systems engineering problem** governed by three invariants:

1. **Same-thread QA is confirmation bias.** When the same context window that wrote the code acts as the reviewer two turns later, it inherits its own blind spots. In Gripm Playbook, transitions from `review` to `ready` require an isolated `qa-auditor` sub-agent running in a clean context window that receives only the task acceptance criteria and the `git diff`.
2. **Prose rules are advisory; exit codes are law.** Markdown prompts alone cannot stop a premature promotion. The executable gate ([`scripts/gate-qa.mjs`](scripts/gate-qa.mjs)) enforces frontmatter integrity, checked acceptance criteria (`- [x]`), resolved dependencies, file budgets, and a green test suite (`exit 0`) before mutating task state on disk.
3. **Process scales with blast radius.** The host orchestrator (`pm-orchestrator`) classifies every request automatically across three operational gears, avoiding ceremony on trivial changes while enforcing strict design and refinement on structural work.

| Architectural Dimension | Single-Thread Prompting | Unbounded Agent Swarms | Gripm Playbook |
| :--- | :--- | :--- | :--- |
| **Default Entry Point** | Generic chat assistant | Uncoordinated background loop | **`pm-orchestrator` hub** |
| **Context Hygiene** | Degrades over long sessions | High token bloat & drift | **Fresh context window per sub-agent** |
| **Workspace Safety** | Single-thread edits | Race conditions on shared tree | **Sequential SDD + `git worktree` isolation** |
| **QA Certification** | Self-certified in same thread | Ungrounded conversational review | **Mechanical `gate-qa` + blind QA sub-agent** |
| **Human Authority** | Manual micromanagement | Opaque autonomous execution | **Product Owner sovereignty over scope & releases** |

---

## Architecture & Delivery Flow

### 1. Adaptive Operating Modes

You never need to manually invoke roles or ceremony. The orchestrator selects the execution mode based on task complexity:

| Mode | Scope & Triggers | Active Sub-Agents | Governance Overhead |
| :--- | :--- | :--- | :--- |
| **Mode 1 - Surgical Focus** | Bugfixes, type errors, isolated refactors | `principal-engineer` (+ `qa-auditor` if certifying a task) | Zero sprint paperwork; atomic verification |
| **Mode 2 - Tactical Duo** | UI components, modals, touch ergonomics | `product-designer` ➔ `principal-engineer` ➔ `qa-auditor` | Lightweight chat plan + 7-state UX spec |
| **Mode 3 - Delivery Loop** | Backlog features, schema migrations, epics | `market-researcher` ➔ `product-designer` ➔ `principal-engineer` ➔ `qa-auditor` | Full refinement gate (R1) + formal spec |

### 2. The Delivery State Machine

Every work item lives as a plain Markdown file in [`backlog/tasks/`](backlog/tasks) and progresses through a deterministic pipeline defined in [`.agents/STATE_MACHINE.md`](.agents/STATE_MACHINE.md):

```text
  ┌───────┐   ┌───────┐   ┌────────┐   ┌───────┐   ┌──────┐
  │ draft │ → │ doing │ → │ review │ → │ ready │ → │ done │
  └───────┘   └───────┘   └────────┘   └───────┘   └──────┘
      │           ▲            │           │
   Gate R1:    T0: start    T1: dev     T2: gate-qa (exit 0)
  Refinement   (claimed)   checks ACs   + clean-context QA sub-agent
```

- **Canonical statuses:** `ideas`, `draft`, `blocked`, `doing`, `review`, `ready`, `done`, `dismissed`. The backlog is a planning container, never a status value.
- **Refinement Gate (R1):** Ambiguities, edge cases, empty states, fallbacks, and negative scope are resolved before an item enters `doing`.
- **Explicit Impediment Tracking:** Moving to `blocked` or `dismissed` requires a non-empty `blocked_reason` or `dismissed_reason`. Unblocking (`gate-qa unblock <ID>`) mechanically verifies that all upstream `dependencies` are `done`.
- **Decoupled Releases & Anti-State-Lie Invariant:** Sprints and releases are independent. Releases assemble delivered value from any available `ready` items. An item transitions to `done` exclusively after a verified physical deployment from `main`.

---

## Two-Layer Modular Design

Installing the framework never imposes a technology stack on your repository.

### Core Layer (Stack-Agnostic, Always Installed)

Enforced by CI (`npm run validate`) to contain zero references to specific frameworks, products, or backends:

| Skill | Responsibility | Core Enforcement |
| :--- | :--- | :--- |
| [`pm-orchestrator`](.agents/skills/pm-orchestrator/SKILL.md) | Delivery Hub | Structured Refinement Interview (R1), mode routing, PO sovereignty |
| [`market-researcher`](.agents/skills/market-researcher/SKILL.md) | Domain Intelligence | Competitive benchmarks (>= 3 references) and edge-case matrices |
| [`product-designer`](.agents/skills/product-designer/SKILL.md) | Interface Architecture | Semantic tokens, >= 44x44px touch targets, 7 interactive states, Purpose Test |
| [`principal-engineer`](.agents/skills/principal-engineer/SKILL.md) | Systems Engineering | Modularity (< 1000 LOC ceiling), minimum viable diff, blast-radius mapping |
| [`qa-auditor`](.agents/skills/qa-auditor/SKILL.md) | Release Certification | Verification Pyramid execution, blind diff audit, exclusive `review ➔ ready` authority |
| [`code-level-ux-auditor`](.agents/skills/code-level-ux-auditor/SKILL.md) | Static UX Analysis | 15 declarative AST/source signatures via the zero-dependency `audit-ux` engine |

### Optional Stack Packs

Installed automatically during `init` or on demand via `npx @gripm/playbook sync --stack <name>`:

- **`react`** - `forms-rhf-zod` (controlled inputs, schema validation), `ui-radix-tailwind` (accessible primitives, focus management), `recharts-reporting` (responsive data visualization).
- **`mobile`** - `mobile-ux-design` (viewport safety, gesture collision prevention, virtual keyboard handling).
- **`pwa`** - `pwa-assets-audit` (manifest integrity, maskable icons, service worker lifecycle).

---

## CLI & Mechanical Gates

All tools run on Node.js (`>= 18`) with zero external runtime dependencies:

| Command | Purpose |
| :--- | :--- |
| `npx @gripm/playbook init` | Interactive onboarding wizard, stack detector, and multi-harness adapter generator |
| `npx @gripm/playbook sync` | Non-destructive updater with sha256 customization tracking and rollback backups |
| `node scripts/gate-qa.mjs <ID>` | Mechanical transition gate (`start`, `submit`, `unblock`, and `review ➔ ready` certification) |
| `node scripts/audit-ux-code.cjs` | Static UX auditor (`--strict`, `--format json`, `--rule UX-NNN`, `--update-baseline`) |
| `node scripts/check-loc.mjs` | Modularity monitor flagging files approaching the 500 LOC warning or 1000 LOC ceiling |

<details>
<summary><strong>Non-Destructive Sync & Customization Protection</strong></summary>

Upgrading the framework never overwrites human-authored instructions or local skill adaptations:

- **`AGENTS.md` is sacred:** Never overwritten during `sync`, and preserved even when running `init --force`.
- **Cryptographic lockfile (`.playbook-lock.json`):** Every installed file is fingerprinted with `sha256`. Locally modified files are automatically classified under `customizations` and protected on every subsequent sync.
- **Reversible updates:** Whenever a canonical file is updated, its previous revision is archived under `.playbook-backups/<ref>/`.
- **Key flags:** `--dry-run`, `--tag <ref>`, `--stack <name>`, `--adopt` (record current disk state as baseline), `--force`.
</details>

<details>
<summary><strong>Static UX Auditor & Custom AST Rules (<code>.uxaudit.json</code>)</strong></summary>

The static UX engine scans source files against 15 built-in signatures (`UX-001` through `UX-015`, covering decimal comma blockers, sub-44px touch targets, fixed bottom occlusion, missing icon button labels, layout jank, and viewport zoom locks).

Configure exclusions, disable specific signatures, or attach project-specific rules in `.uxaudit.json`:

```json
{
  "src": "src",
  "disableRules": ["UX-011"],
  "exclude": ["src/legacy/**", "**/generated/*.tsx"],
  "rules": "audit-ux.local-rules.json"
}
```

Local rules support JSX ancestor scoping via `withinComponent` (e.g. `"withinComponent": ["Modal", "Dialog.Content"]`) and path scoping via `onlyFile`. You can also invoke the engine programmatically:

```js
const { auditProject } = require('@gripm/playbook/scripts/audit-ux-code.cjs');
const { findings, summary } = auditProject({ root: process.cwd() });
```
</details>

<details>
<summary><strong>Polyglot Repositories (Python, Go, Rust, Make)</strong></summary>

Gripm Playbook governs any language toolchain through lightweight proxy scripts in a minimal `package.json`:

```json
{
  "name": "service-repo",
  "private": true,
  "scripts": {
    "validate": "golangci-lint run",
    "test": "go test ./...",
    "build": "go build -v ./..."
  }
}
```

`gate-qa.mjs` delegates execution to these scripts, bringing Subagent-Driven Development, worktree isolation, and blind QA certification to non-Node stacks without modification.
</details>

---

## The Verification Pyramid

Every change is validated in strict order of execution cost:

1. **Static & Type Integrity (`npm run validate`):** Typechecking, link validation, and manifest parity.
2. **Headless Test Suite (`npm test`):** Fast unit and integration tests with zero browser overhead.
3. **Spec & Backlog Gate (`npm run gate:review`):** Mechanical verification of acceptance criteria and dependencies.
4. **File Budget & Modularity (`npm run check:loc`):** Guard against monolithic God-Files (< 1000 LOC).
5. **Static UX Audit (`npm run audit:ux:strict`):** Automated verification of the 15 UX and accessibility signatures.
6. **Production Build (`npm run build`):** Clean compilation verification when applicable.

> [!IMPORTANT]
> Browser automation is reserved strictly for visual CSS or layout diagnosis that cannot be deduced statically. Invoking a browser sub-agent to verify business logic, state transitions, or API contracts is prohibited.

---

## Documentation & Ecosystem

- **[Team Playbook & Role Matrix](.agents/TEAM_PLAYBOOK.md)** - Handoff contracts, sub-agent dispatch rules, and parallel `git worktree` recipes.
- **[Delivery State Machine](.agents/STATE_MACHINE.md)** - Canonical status vocabulary, transition guards, and production invariants.
- **[Git Workflow & Concurrency](.agents/rules/git-workflow.md)** - Commit discipline, peer discovery (`claimed_by`), and release ceremony.
- **[Backlog Specification](docs/BACKLOG.md)** - Task frontmatter schema and hygiene rules in `backlog/tasks/`.
- **[Contributing Guide](CONTRIBUTING.md)** - Repository self-validation (`npm run check:all`), test standards, and rule authoring.
- **[Gripm Visual Board](https://github.com/pablojavierrodriguez/gripm)** - Optional web companion that renders and manages the same `backlog/tasks/*.md` files in real time.

---

## License

MIT. Authored by [Pablo Javier Rodríguez](https://github.com/pablojavierrodriguez).
