# ⚡ Gripm Playbook

> **Autonomous multi-agent agile framework for modern software development: dynamic modes, decoupled releases, and a single-threaded execution model.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/pablojavierrodriguez/gripm-playbook/pulls)
[![Architecture: Multi--Agent](https://img.shields.io/badge/Architecture-Multi--Agent-purple.svg)]()
[![Focus: Zero--Bureaucracy](https://img.shields.io/badge/Focus-Zero--Bureaucracy-orange.svg)]()

---

## 🎯 The Dilemma: Chaos vs. Bureaucracy

When pair-programming with AI coding agents, teams usually hit one of two extremes:

1. **Cowboy Coding (Chaos):** The agent jumps straight to hacking code, skips architecture, breaks mobile responsiveness, introduces subtle type errors, and makes vague commits.
2. **Analysis Paralysis (Over-Engineering):** The agent asks questions at every step, opens a 10-page specification for a 2-line typo fix, and requires the user to act as an exhausted Scrum Master.

This framework resolves it with a self-governing system that dynamically selects the right gear per task complexity.

---

## 🧠 Under the Hood: Hub Orchestrator + Clean-Context Sub-Agents

A widespread misconception is that a "multi-agent team" requires either 5 uncoordinated background bots chatting in an open loop (CrewAI, AutoGen), or a single LLM thread pretending to wear 5 hats sequentially in the same context window.

Both extremes fail in real software engineering:

1. **Git & state collisions (Swarms).** Concurrent uncoordinated processes mutating the same codebase produce race conditions, overwritten code and 5 - 10x token bloat.
2. **Confirmation bias (Same-thread roleplay).** When the same context window that wrote the code pretends to be the QA Auditor two turns later, it inherits its own blind spots and rubber-stamps `ready`.

### The architecture: Hub Orchestrator (`pm-orchestrator`) + Isolated Sub-Agents (`invoke_subagent`)

```
                        ┌─────────────────────────────────────────┐
                        │        HOST AGENT (Active Model)        │
                        │   (Antigravity / Cursor / Claude Code)  │
                        └────────────────────┬────────────────────┘
                                             │
                    Assumes specialized operational "hats" on demand
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             ▼                               ▼                               ▼
  [ principal-engineer ]          [ rigorous-qa-auditor ]     [ worldclass-product-designer ]
  • Strict typing                 • Verification Pyramid      • Touch ergonomics ≥44px
  • Domain invariants             • tsc + headless tests      • Semantic token system
  • Sequential Git mutations      • Zero unrequested commits  • Micro-interactions
```

- **Default entry point (`pm-orchestrator`).** Unless you explicitly invoke another role directly, every conversation starts with the Orchestrator leading the Grilling Session and selecting the operating mode.
- **Skills are isolated operational contracts.** Each skill in `.agents/skills/` is loaded into a fresh sub-agent context when dispatched via `invoke_subagent`, keeping the main thread clean.
- **Sequential writer discipline.** Domain logic, schemas and Git mutations run sequentially (one active writer per scope, or isolated via `git worktree`) to prevent races.
- **Blind QA certification in a virgin context.** Transition T2 (`review` → `ready`) **never** runs in the coder's thread: a clean-context `rigorous-qa-auditor` sub-agent receives only the task ACs and the `git diff`, runs `npm run gate:qa <ID>` (`exit 0`), and audits the diff without confirmation bias.

### ⚖️ Swarms vs. Same-Thread Roleplay vs. This Playbook

| Dimension | Uncoordinated Swarms | Same-Thread Roleplay | Gripm Playbook (Hub + Sub-Agents) |
| :--- | :--- | :--- | :--- |
| **Entry point** | Multiple uncoordinated bots | Generic assistant | **`pm-orchestrator` by default** |
| **Context hygiene** | 🔴 High chatter bloat | 🟡 Degrades over long turns | 🟢 **Clean context window per sub-agent** |
| **Git & file safety** | 🔴 Race conditions | 🟢 Single thread | 🟢 **Sequential SDD + worktree isolation** |
| **QA independence** | 🟡 Ungrounded LLM chat | 🔴 **Zero (confirmation bias)** | 🟢 **Mechanical `gate:qa` + Blind QA sub-agent** |
| **Human governance** | 🔴 Opaque execution | 🟢 Human in loop | 🟢 **PO sovereignty over scope, commits & releases** |

---

## 🚦 Dynamic Decision Matrix (3 Operating Modes)

You never have to say *"activate the designer"* or *"open a sprint"*.

```
                          ┌─────────────────────────────────┐
                          │        DEVELOPER PROMPT         │
                          └────────────────┬────────────────┘
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
     [ MODE 1: FOCUS ]              [ MODE 2: DUO ]             [ MODE 3: SPRINT ]
    Surgical Fast-Track           Tactical UX + Code             Full Agile Loop
  ──────────────────────       ─────────────────────────      ──────────────────────
  • Targeted bugfixes          • Component redesign           • Strategic backlog epics
  • Invariant fixes            • Modals & sheets              • Database migrations
  • Linter & unit tests        • Touch targets (≥44px)        • Multi-step workflows
  ──────────────────────       ─────────────────────────      ──────────────────────
  Lead: Principal Eng.         Designer + Principal Eng.      Lead: PM Orchestrator
  Zero paperwork               Lightweight chat plan          Formal delivery pipeline
  Atomic verification          Quick visual QA                Verification Pyramid
```

---

## 🔄 The Agile Delivery Flow

Full specification, with actors and guards: **[`.agents/STATE_MACHINE.md`](.agents/STATE_MACHINE.md)**.

```
[ 1. Discovery & PM ] (pm-orchestrator)            refinement gate (R1)
              │
              ▼
[ 2. Research & Design ] (market-researcher + worldclass-product-designer)
              │
              ▼
[ 3. Dev Execution ] (principal-engineer) ────────► status: draft → doing → review
              │                                                ▲         │
              │                                                └─blocked─┘
              ▼
[ 4. QA Certification ] (rigorous-qa-auditor) ────► status: review → ready   ← formal handover (npm run gate:qa)
              │
              ▼
[ 5. Release & Prod ] (PO + Delivery Lead) ───────► status: ready → done     ← after a real deploy
```

**The canonical status vocabulary lives in [`.agents/STATE_MACHINE.md`](.agents/STATE_MACHINE.md): `ideas`, `draft`, `blocked`, `doing`, `review`, `ready`, `done`, `dismissed`.**

- **The backlog is a planning container, not a status.** Every item on disk starts in `draft` (or `ideas` for unrefined discovery); zero items exist without a status.
- **Refinement is an interactive gate (R1), not a state.** Requires a Grilling Session to resolve edge cases, fallbacks, empty states and tradeoffs before entering `doing` (`node scripts/gate-qa.mjs start <ID>`).
- **`blocked` requires `blocked_reason`.** Halts WIP inflation; unblocking (`T_unblock`) requires resolving the impediment or dependencies and is executed mechanically via `node scripts/gate-qa.mjs unblock <ID>`.
- **`dismissed` requires `dismissed_reason`.** Formal decision that an item will not exist; items in `ready` are never dismissed.
- **`ready` is the formal delivery of development.** Only the clean-context QA Auditor sub-agent can certify `review → ready`, where `npm run gate:qa <ID>` (exit code 0) mutates `status: ready` on disk; a developer never self-certifies.
- **Fundamental invariant:** no item can exist in production that is not `done`, and no item can be marked `done` without an actual release deploy.

**Sprints and releases are decoupled.** A release groups available `ready` items by delivered value, with or without an active sprint, historical or current.

**Sprint lifecycle is timeboxed.** If items finish early, the PO expands scope with refined backlog items. The agent **never** closes a sprint or runs a retrospective by deduction - only on explicit textual command.

---

## 🧩 The Two Layers

The framework is deliberately split so that installing it does not impose a stack.

### Core - always installed, stack agnostic

| Skill | Role |
| :--- | :--- |
| `pm-orchestrator` | Sprint leadership, refinement gate, PO sovereignty |
| `market-researcher` | Benchmarks and domain edge cases |
| `worldclass-product-designer` | Visual hierarchy, tokens, touch ergonomics, states |
| `principal-engineer` | Architecture, invariants, strict typing, performance |
| `rigorous-qa-auditor` | Verification Pyramid, a11y, certification authority |
| `code-level-ux-auditor` | 13 static UX signatures + the `audit-ux` CLI |

### Stack packs - installed on demand

| Pack | Skills |
| :--- | :--- |
| `react` | `forms-rhf-zod`, `ui-radix-tailwind`, `recharts-reporting` |
| `mobile` | `mobile-ux-design` |
| `pwa` | `pwa-assets-audit` |

The core layer is validated to contain **zero** references to any specific product or backend. `npm run validate` enforces this, so the promise cannot silently rot.

---

## 📂 Repository Anatomy

```text
├── .agents/
│   ├── TEAM_PLAYBOOK.md           # Role matrix, modes, sub-agent criteria, worktree isolation
│   ├── STATE_MACHINE.md           # Single source of truth for statuses & transitions
│   ├── rules/
│   │   └── git-workflow.md        # Commit governance & multi-agent worktree recipe
│   ├── skills/                    # CORE - stack agnostic, always installed
│   │   ├── pm-orchestrator/SKILL.md
│   │   ├── market-researcher/SKILL.md
│   │   ├── worldclass-product-designer/SKILL.md
│   │   ├── principal-engineer/SKILL.md
│   │   ├── rigorous-qa-auditor/SKILL.md
│   │   └── code-level-ux-auditor/SKILL.md
│   └── stacks/                    # OPTIONAL - installed with --stack <name>
│       ├── react/{STACK.md, skills/…}
│       ├── mobile/{STACK.md, skills/…}
│       └── pwa/{STACK.md, skills/…}
├── scripts/
│   ├── audit-ux-code.cjs          # Static UX auditor (generic engine + i18n support)
│   ├── gate-qa.mjs                # Executable QA certification gate runner
│   ├── gate-review-items.mjs      # CI entry point: gates all items in review
│   ├── ux-rules.json              # Rule catalog - single source of truth
│   ├── sync-playbook.mjs          # Installer / updater (with parity check)
│   └── validate-repo.mjs          # Self-consistency guardian
├── tests/                         # Test suite (node:test, 128 tests across 30 suites)
├── backlog/tasks/                 # Item pool, Backlog.md format (PLAY- prefix)
├── docs/
│   ├── BACKLOG.md                 # Backlog convention → items live in backlog/tasks/
│   ├── DOMAIN_TEMPLATE.md         # Canonical ubiquitous domain glossary template
│   └── sprints/SPRINT_SPEC_TEMPLATE.md
├── .playbook-manifest.json        # What gets installed where
├── AGENTS.md                      # Master project instructions (template)
├── package.json
├── LICENSE                        # MIT
└── README.md
```

---

## 🚀 Quickstart

### Option A - Project-level install (recommended)

```bash
git clone https://github.com/pablojavierrodriguez/gripm-playbook.git temp-playbook
cp -r temp-playbook/.agents temp-playbook/docs temp-playbook/AGENTS.md ./
cp temp-playbook/scripts/sync-playbook.mjs temp-playbook/scripts/audit-ux-code.cjs \
   temp-playbook/scripts/ux-rules.json temp-playbook/scripts/validate-repo.mjs scripts/ 2>/dev/null
rm -rf temp-playbook
```

Then open `AGENTS.md` and fill in the **Tech Stack** and **Language** placeholders.

Add stack packs only if you need them:

```bash
node scripts/sync-playbook.mjs --stack react --stack mobile
node scripts/sync-playbook.mjs --list-stacks
```

### Option B - Zero-clone sync into an existing repo

```bash
npx @gripm/playbook sync
```

Or, without `npx`:

```bash
node scripts/sync-playbook.mjs            # core only
node scripts/sync-playbook.mjs --stack react
```

**Safety guarantees of the sync:**

| Guarantee | Behaviour |
| :--- | :--- |
| Your `AGENTS.md` is never overwritten | Preserved, always. Created only with `--init-agents`. |
| Files a human owns are never silently lost | Detected, recorded in `.playbook-lock.json` under `customizations`, and protected on **every** subsequent run until `--force`. |
| Older canonical files are recognised, not blocked | With no lockfile, the sync asks the upstream history whether the local content is a published revision. If it is, it moves forward silently instead of reporting a false conflict. |
| Overwrites are reversible | Previous version stored under `.playbook-backups/<ref>/`. |
| Reproducible | Syncs from a pinned git ref, not a moving branch. |
| Auditable | `.playbook-lock.json` records a sha256 per file plus the customization list. |
| Moved files are surfaced | Framework files no longer in the install plan are reported as orphans. Nothing is deleted. |

Useful flags: `--dry-run`, `--tag <ref>`, `--adopt`, `--force`, `--no-history`, `--yes`, `--list-stacks`, `--no-manifest`.

**Migrating from a hand-installed copy.** The first sync has no lockfile, so it cannot tell an untouched v1 skill from an edited one. It resolves that by asking the upstream history. If you would rather not spend those requests, `--no-history` protects anything unrecognised, or `--adopt` keeps every differing file and records it as the baseline you want to keep updating from.

### Option C - Global installation

Copy `.agents/skills/*/SKILL.md` into your assistant's global skills directory (e.g. `~/.gemini/config/skills/`) to make them available in every workspace.

---

## 🧪 The Verification Pyramid (zero-waste testing)

Validate every change in strict order. Each step is cheaper than the next.

```
1. ✅  typecheck / repo consistency    npm run validate
2. ✅  headless tests                  npm test (unit + integration, no browser)
3. ✅  spec & backlog consistency      npm run gate:review
4. ✅  static UX audit                 npm run audit:ux:strict
5. ✅  production build (if applicable) npm run build
6. ⚠️  real browser (conditional)      ONLY for static-undeducible CSS/layout, or on explicit request
```

### Executable QA Gate - `npm run gate:qa <ID>`

Prose assertions are not gates. Transition T2 (`review` → `ready`) is enforced mechanically by `scripts/gate-qa.mjs`:
- Verifies task frontmatter, completed acceptance criteria (`- [x]`), dependencies resolution in `done`, and valid `blocked_reason`/`dismissed_reason`.
- Runs the Verification Pyramid headlessly. Exit code 0 is required to certify.
- In CI, `npm run gate:review` ensures every item in `review` satisfies the gate on every push.

> [!IMPORTANT]
> Invoking a browser sub-agent for logic, state, API contracts or persistence is **prohibited** - those are auditable headlessly in milliseconds. The browser is reserved for visual CSS/layout issues that cannot be deduced statically.

---

## 🔍 The static UX auditor

A generic engine plus a declarative rule catalog. No project names, no file names, no hardcoded paths.

```bash
node scripts/audit-ux-code.cjs                 # human report
node scripts/audit-ux-code.cjs --strict        # fail on WARNING too
node scripts/audit-ux-code.cjs --format json   # for CI
node scripts/audit-ux-code.cjs --list-rules    # inspect the catalog
node scripts/audit-ux-code.cjs --rule UX-006   # single signature
npm run audit:ux:baseline                      # snapshot what was already reviewed
```

**Every occurrence is reported, not one per file.** A codebase with 487 findings shows 487 - that is what a baseline is for. `audit-ux-baseline.json` records the observations already reviewed so a project can adopt the auditor without either silencing the gate or drowning in noise nobody will read. `ERROR` is never absorbed: a severity that breaks the build cannot be switched off by a file.

**13 signatures:** `UX-001` decimal comma blocker · `UX-002` keyboard shortcuts on touch · `UX-003` drag/scroll collision · `UX-004` date localisation leak · `UX-005` autocapitalise trap · `UX-006` fixed bottom UI occlusion · `UX-007` horizontal crowding · `UX-008` micro-Jank · `UX-009` sub-44px target · `UX-010` unnamed icon button · `UX-011` arbitrary font size · `UX-012` no tactile feedback · `UX-013` missing tabular numerals.

**Stack aware by construction.** Rules that depend on a library declare `requires.deps` and skip themselves when the dependency is absent, so a Go or Python project never gets React advice.

**Project configurable** via `.uxaudit.json`:

```json
{
  "src": "src",
  "disableRules": ["UX-011"],
  "exclude": ["src/legacy/**", "**/generated/*.tsx"],
  "rules": "audit-ux.local-rules.json"
}
```

### Extending it without forking

A project that needs its own signatures names a catalog of its own in `"rules"` and its rules run alongside the canonical ones:

```json
// .uxaudit.json
{ "src": "src", "rules": "audit-ux.local-rules.json" }
```

```json
// audit-ux.local-rules.json
{
  "version": 1,
  "rules": [{
    "id": "ENV-002",
    "title": "Truncated text in a dialog",
    "severity": "WARNING",
    "signature": "`truncate` inside a dialog component.",
    "impact": "The ellipsis hides the impact the user is being asked to confirm.",
    "fix": "Use `break-words leading-relaxed`.",
    "check": { "line": ["truncate"], "onlyFile": ["Modal", "Dialog"] },
    "message": "`truncate` in a dialog."
  }]
}
```

**`UX-NNN` is reserved.** A local rule using that pattern is rejected with an error, because one id has to mean one thing across every consumer - a project reading its own `UX-009` as "touch target" while the skill documents something else is how catalogs stop being trustworthy. Pick your own prefix.

**For anything the declarative catalog cannot express**, import the engine instead of copying it:

```js
const { auditProject } = require('@gripm/playbook/scripts/audit-ux-code.cjs');

const { findings, summary } = auditProject({ root: process.cwd() });
```

Importing the module does not run an audit; only executing it as a binary does. `auditProject` returns `{ rulesVersion, srcDir, summary, findings, unreadable, absorbed }` and never prints or exits, so you own the presentation. Also exported: `loadCatalog`, `loadConfig`, `loadRules`, `buildUnits`, `lineMatches`, `hasVisibleText`, `fingerprint`.

`exclude` supports `**` (any depth), `*` (within one segment) and `?`. Each pattern matches both as written, relative to the project root, and at any depth, so `src/legacy/**` and `**/src/legacy/**` are equivalent. Excluded files are dropped before the audit runs, so they never reach the report.

**Inline suppression:** `// ux-audit-ignore` or `// ux-audit-ignore UX-004`.

Adding a signature means editing `scripts/ux-rules.json` **and** documenting it in the `code-level-ux-auditor` skill. `npm run validate` fails if they drift apart.

---

## 🔌 Official MCP servers

| Role | Recommended MCP | Unlocks |
| :--- | :--- | :--- |
| **PM Orchestrator & Principal Engineer** | GitHub MCP | Read backlog issues, inspect PR diffs, draft releases from the repo |
| **Rigorous QA Auditor** | Chrome DevTools / Puppeteer MCP | Viewport resizing (375px), a11y auditing, console error detection |
| **Principal Engineer** | Postgres / Database MCP | Live schema inspection, migration verification, query tuning |
| **All roles** | Filesystem MCP | Fast traversal of large monorepos |

> [!TIP]
> Configure MCP servers in your **private local** client settings. Never commit access tokens, connection strings or private keys.

---

## 🛡️ Quality gates for this repo itself

The framework holds itself to its own standard:

```bash
npm run validate     # manifest ⇄ disk, fallback parity, rule catalog ⇄ skill docs, core purity, links, status vocabulary
npm test             # 128 tests over rule engine, sync layer, gate runner and repo validator
npm run gate:review  # verifies every item in review satisfies the executable gate
npm run check:all    # validate + test
```

---

## 📋 Where the work lives

| Artifact | Where | Holds |
| :--- | :--- | :--- |
| **Backlog** | [`backlog/tasks/`](backlog/tasks) | Every open item, Backlog.md format, `PLAY-` prefix |
| **Intake** | [GitHub Issues](https://github.com/pablojavierrodriguez/gripm-playbook/issues) | Where a defect is reported from outside |
| **Release log** | [`CHANGELOG.md`](CHANGELOG.md) | Only what has already shipped |
| **Conventions** | [`docs/BACKLOG.md`](docs/BACKLOG.md) | Item format, hygiene rules, status lifecycle |

> [!IMPORTANT]
> The changelog is a release log, not a work log. An item that has not shipped belongs in `backlog/tasks/`. `## [Unreleased]` stays empty on purpose.

---

## 🇪🇸 Resumen en Español

**Agentic Team Playbook** es un framework de gobernanza y delivery ágil para assistants de IA:

- **Autonomía sin burocracia:** clasificación dinámica entre *Foco Quirúrgico* (fixes directos), *Dúo Táctico* (UX + código) y *Sprint & Backlog Flow* (loop formal).
- **Orquestador por defecto + Subagentes de Contexto Limpio:** cada conversación inicia por defecto con el `pm-orchestrator` (salvo invocación directa de otro rol), quien conduce la Grilling Session y despacha subagentes aislados (`invoke_subagent`) con contratos explícitos para Research, Diseño, Ingeniería (SDD) y QA. Aislamiento multi-agente mediante `git worktree` y protocolo sincrónico de Peer Discovery (`claimed_by`).
- **Vocabulario canónico de estados:** `ideas`, `draft`, `blocked`, `doing`, `review`, `ready`, `done`, `dismissed`. **El backlog es el pool de planificación, no un status**, y el **refinamiento es un gate interactivo (R1)** (Grilling Session para despejar ambigüedades, apoyado en el glosario de dominio `DOMAIN.md`).
- **Estados `blocked` y `dismissed`:** motivos obligatorios y no vacíos (`blocked_reason` / `dismissed_reason`). Resolución estricta de dependencias comprobable mecánicamente con `gate-qa.mjs unblock <ID>`.
- **`ready` es la entrega formal con Doble Compuerta:** solo un subagente `rigorous-qa-auditor` en **ventana de contexto limpia** mueve `review → ready`, respaldado por exit code 0 de `npm run gate:qa` y una auditoría ciega del `git diff` contra las ACs. El hilo que escribió el código jamás se auto-certifica.
- **Disciplina senior (Ponytail):** diff mínimo viable, reutilización previa obligatoria, mapeo de blast radius y cierre honesto.
- **Filtro Anti-Slop:** higiene de comentarios, prohibición de evasión de tipos (`as unknown as`), receta Oxlint y Purpose Test en diseño y copy.
- **Invariante fundamental:** ningún ítem puede estar en producción sin estar en `done`, y marcar `done` sin deploy real es una mentira de estado.
- **Desacople Sprint ↔ Release:** los releases se arman por valor entregado con ítems en `ready`, con o sin sprint activo.
- **Pirámide de Verificación:** typecheck → tests headless → consistencia de spec/backlog → build → auditoría UX estática (con soporte de i18n y baselines portables POSIX). Browser subagents prohibidos para lógica, estado, API o persistencia.
- **Dos capas:** *core* agnóstico de stack (siempre instalado) + *stack packs* opcionales (`react`, `mobile`, `pwa`). El core se valida como libre de referencias a producto o backend.
- **Sync no destructivo:** `AGENTS.md` nunca se sobrescribe; las customizaciones locales se detectan por hash, se reportan como `[Protected]` y exigen `--force`; todo overwrite queda respaldado.

---

## 📜 License

MIT. Free for personal and commercial use.
Authored by [Pablo Javier Rodríguez](https://github.com/pablojavierrodriguez).