# Multi-Agent Team Playbook - Agile Autonomous Framework

This playbook establishes a collaborative, autonomous operating loop between specialized agent roles and human leads to build and maintain high-grade software products.

> **Source of truth for states:** the delivery status vocabulary and its transitions are defined once, in [STATE_MACHINE.md](STATE_MACHINE.md). This document references it and must never redefine the state table.

---

## 🚦 Default Entry Point & Dynamic Decision Matrix

**Default Conversation Role:** Every conversation thread defaults to the **[`pm-orchestrator`](skills/pm-orchestrator/SKILL.md)** as the host agent talking to the user, **unless** the user explicitly invokes another role or skill directly (e.g., *"act directly as Principal Engineer"*).

The user never has to manually specify when to trigger a sprint or which sub-agent to spawn. The `pm-orchestrator` automatically classifies incoming requests into one of three operating tracks and dispatches the required sub-agents:

| Operating Track | Typical Triggers | Execution & Sub-Agent Topology | Overhead / Documentation |
| :--- | :--- | :--- | :--- |
| **Mode 1: Surgical Focus** *(Fast-Track)* | Targeted bugfixes, calculations/invariants, copy/typo tweaks, linter fixes, failing unit tests. | **Host Orchestrator** applies [`principal-engineer`](skills/principal-engineer/SKILL.md) rules directly (or via 1 focused sub-agent). If certifying a backlog item (`review` ➔ `ready`), spawns a clean-context [`rigorous-qa-auditor`](skills/rigorous-qa-auditor/SKILL.md) sub-agent. | **Zero bureaucracy.** No sprint doc. Atomic modification + verification (`typecheck` + tests). |
| **Mode 2: Tactical Duo** *(UX + Engineering)* | Component redesign, new modals/sheets, ergonomics & touch targets, visual charts. | **Host (`pm-orchestrator`)** dispatches clean-context sub-agents: **[`worldclass-product-designer`](skills/worldclass-product-designer/SKILL.md)** ➔ **[`principal-engineer`](skills/principal-engineer/SKILL.md)** ➔ **[`rigorous-qa-auditor`](skills/rigorous-qa-auditor/SKILL.md)**. | **Lightweight.** Plan outlined directly in chat. No sprint doc unless touching database schema. |
| **Mode 3: Full Sprint & Backlog Flow** | Major backlog feature, database schema migrations, complex business workflows. | **Host (`pm-orchestrator`)** orchestrates isolated sub-agents: **[`market-researcher`](skills/market-researcher/SKILL.md)** ➔ **[`worldclass-product-designer`](skills/worldclass-product-designer/SKILL.md)** ➔ **[`principal-engineer`](skills/principal-engineer/SKILL.md)** (SDD) ➔ **[`rigorous-qa-auditor`](skills/rigorous-qa-auditor/SKILL.md)** ➔ **Release Management**. | **Formal.** Tracked via backlog task or sprint spec, verified through the Verification Pyramid and packaged by value. |

---

## 🤖 Sub-Agent Context Isolation & Handoff Contracts

A single LLM thread that writes code and then "pretends" to be the QA Auditor in the same context window suffers from **confirmation bias**: it inherits its own assumptions, excuses, and blind spots. To eliminate roleplay theatre, this framework enforces **Context Isolation via Sub-Agents (`invoke_subagent`)**:

> **"Orchestrate from the hub; isolate execution and verification in clean sub-agent contexts."**

### 📋 Mandatory Sub-Agent Handoff Matrix

When the host `pm-orchestrator` delegates to a specialist via `invoke_subagent`, the sub-agent runs in a **fresh context window** and receives an explicit **Handoff Contract**:

| Sub-Agent Role | Skill Required to Read First | Clean Input Provided by Orchestrator | Mandatory Output Returned |
| :--- | :--- | :--- | :--- |
| **Market Researcher** | [`.agents/skills/market-researcher/SKILL.md`](skills/market-researcher/SKILL.md) | Problem statement + domain + specific UX/API questions. | `[RESEARCH]` brief: >= 3 product benchmarks, filtered domain edge-case table, and concrete recommendations. |
| **Product Designer** | [`.agents/skills/worldclass-product-designer/SKILL.md`](skills/worldclass-product-designer/SKILL.md) | Problem statement + ACs + Research brief + project design tokens. | `[DESIGN SPEC]`: semantic tokens, >= 44×44px touch targets, all 7 interactive states, Purpose Test verdicts, and copy veracity check. |
| **Principal Engineer** | [`.agents/skills/principal-engineer/SKILL.md`](skills/principal-engineer/SKILL.md) | Refined task (`doing`) + ACs + Design Spec + Architecture boundaries + files in scope + `.agents/rules/`. | Implemented modular code (< 1000 LOC per file, layers decoupled), checked ACs (`- [x]`), green local typecheck/tests, Ponytail honest close (what was not tested + residual risk), task in `review`. |
| **Rigorous QA Auditor** *(NEVER in the coder's thread)* | [`.agents/skills/rigorous-qa-auditor/SKILL.md`](skills/rigorous-qa-auditor/SKILL.md) & [`.agents/skills/code-level-ux-auditor/SKILL.md`](skills/code-level-ux-auditor/SKILL.md) | **Blind audit payload only:** Task file path (ACs) + `git diff` (or commit range) + command to run `npm run gate:qa <ID>`. Zero developer rationalization history. | `[QA MATRIX]`: mechanical `gate:qa` exit code + blind semantic audit of `git diff` vs. ACs + verdict (`APPROVED -> ready` or `REJECTED -> doing` with file:line findings). |

### 🟢 When to Parallelize (Sub-Agents / Background Tasks):
1. **Blind QA Certification (`rigorous-qa-auditor`):**
   - **Always isolated** in a fresh sub-agent context so verification is unbiased by the implementation conversation.
2. **Exploratory Research & Benchmarking (`market-researcher`):**
   - Investigate industry references (Linear, Stripe, Notion, Obsidian) or analyze external API documentation without polluting the core technical context.
3. **Accessibility (a11y) & Static Code Audits (`code-level-ux-auditor`):**
   - Execute contrast ratios, accessibility checks, or static UX scans (`npm run audit:ux`) asynchronously.
4. **Auditing Visual Layouts (`browser_subagent`):**
   - Reserved **exclusively** for visual layout/CSS issues not deducible statically, complex viewport rendering, or upon explicit user request.

### 🔴 When to Keep STRICT SEQUENTIAL WRITER FOCUS (One Active Mutator at a Time):
1. **Domain Logic & State Invariants:**
   - Core business logic, central state stores, and data integrity require strict sequential reasoning. Never spawn two concurrent coder sub-agents mutating the same domain store at the same time.
2. **Database Schemas & Migrations:**
   - Schema foundations, migrations, and Row-Level Security (RLS) policies must be designed and validated sequentially to guarantee idempotence.
3. **Core Architectural Refactoring & Backlog Parsers:**
   - Backlog sync engines, parsers, and global context providers require end-to-end coherence.

### 🔁 Subagent-Driven Development (SDD)

Un único hilo ejecutando un plan extenso sufre **fatiga de contexto**: olvida instrucciones tempranas, mezcla estados, reintroduce regresiones en tests que pasaban y empieza a parchear improvisando. SDD es el antídoto para tareas de alta complejidad.

**1. Planes a prueba de contexto.** El `pm-orchestrator` desglosa el trabajo en pasos **hiper-atómicos e independientes**. Cada paso se redacta bajo Red-Green TDD con instrucciones explícitas y autocontenidas: un subagente `principal-engineer` sin historial debe poder ejecutarlo sin desviarse. El paso declara qué archivos toca, qué se espera que haga, y cómo se verifica.

**2. Un subagente fresco por paso.** El orquestador **no** pica todo el código en el hilo principal. Despacha un subagente nuevo para el paso N, operando sobre el árbol o en un worktree aislado (ver § Workspace Isolation).

**3. Supervisión y consolidación secuencial.** El orquestador revisa el diff producido, corre la verificación headless, y **solo cuando pasa en verde** consolida y dispara el paso N+1. Un subagente constructor no se lanza en paralelo con el siguiente sobre los mismos archivos. Al completar todos los pasos y pasar a `review`, el orquestador despacha al subagente `rigorous-qa-auditor` en contexto limpio para certificar.

> [!CAUTION]
> SDD multi-paso es para **tareas de alta complejidad**. Para un bugfix puntual (Modo 1) es sobre-ingeniería: aplica el criterio Ponytail - la estructura existe para cuando el problema la amerita, no por defecto.

### 🔒 Workspace Isolation & Autonomous Inter-Agent Coordination (IACP)

When two or more agents or sub-agents work on the same repository at the same time, **each one operates in its own git worktree on its own branch**, and nobody runs `git checkout` in the main working tree. `.git/HEAD` and the working tree are shared filesystem state: a cross-checkout silently switches the other agent's branch *while it is writing*, and its next commit lands on the wrong branch.

#### 🤝 Dynamic Peer Discovery & Handshake Protocol

Para evitar que los agentes colisionen a ciegas o requieran que el usuario actúe como intermediario de información:

1. **Pre-Flight Concurrency Probe (Sincrónico y Obligatorio):**  
   Antes de editar código o alterar ramas, todo agente recién invocado consulta el backlog buscando ítems en `status: doing` y corre `git status --porcelain`.  
   - Si detecta un ítem en `doing` con un `claimed_by` distinto de su propia identidad, **descubre dinámicamente la presencia de su par**.
   - **Salvaguarda de Árbol Compartido:** Queda terminantemente prohibido ejecutar `git checkout .`, `git restore .` o `git clean` sobre un working tree con cambios en vuelo de otro agente.
2. **Dynamic Task Claiming Namespaced (`claimed_by`):**  
   Al mover un ítem a `status: doing`, el agente estampa atómicamente su identidad completa en el frontmatter YAML bajo el formato canónico `<provider_o_harness>:<session_or_agent_id>`:
   - `antigravity:7e5f1a7d-1f19-46fd-bb33-baa4c0394372`
   - `cursor:composer-b82f1...`
   - `claude-code:session_01...`
   - `copilot:run-4819...`
   - `human:pablo`  
   El ítem en `doing` es la única fuente de verdad (Single Source of Truth) del lease activo.
3. **Autonomous Peer Handshake & Cross-Harness Protocol:**  
   - **Intra-Harness (mismo proveedor, ej: `antigravity:` a `antigravity:`):** Emite un mensaje directo (`send_message` a `Recipient: claimed_by`) informando su presencia y alcance para coordinar o secuencializar autónomamente sin intermediación humana.
   - **Cross-Harness (proveedores heterogéneos, ej: Antigravity detecta `cursor:...` o `human:...`):** El agente reconoce la frontera de mensajería, omite llamadas RPC inviables, respeta el lease en curso, se auto-aísla inmediatamente en su propio `git worktree` y notifica al usuario en su canal de chat.
4. **Auto-Bifurcación en Worktree:**  
   Si las tareas tocan áreas disjuntas, el segundo agente **no toca el working tree principal**: crea automáticamente su worktree aislado (`git worktree add -b <branch> ../<repo>-<task>`) y consolida al finalizar.

> [!CAUTION]
> **A worktree isolates the working tree, not the content.** Two agents editing the same file still collide at merge time. Filesystem isolation is not an integration strategy: when several items touch the same documents (`AGENTS.md`, `TEAM_PLAYBOOK.md`, `STATE_MACHINE.md`, one shared `SKILL.md`, CI/CD pipelines o releases), sequence them or split the scope per file *before* parallelizing. Operational recipe and coexistence rules in [`.agents/rules/git-workflow.md`](rules/git-workflow.md) § Multi-Agent Parallelism.

---

## 🔄 The Agile Delivery Flow (The 5 Phases)

```
[ 1. Discovery & PM ] (PM Orchestrator / PO)          refinement gate (R1)
          │
          ▼
[ 2. Research & Design ] (Market Researcher + Product Designer)
          │
          ▼
[ 3. Dev Execution ] (Principal Engineer) ─────────► status: (pool) ➔ doing ➔ review
          │
          ▼
[ 4. QA Gate & Certification ] (Rigorous QA Auditor) ──► status: review ➔ ready (Formal Handover)
          │
          ▼
[ 5. Release Management & Prod ] (PO + Delivery Lead) ──► status: ready ➔ done (Deployed)
```

Transitions, actors and guards are specified in [STATE_MACHINE.md](STATE_MACHINE.md).

### Phase 1: Briefing & Alignment (PM Orchestrator / PO)
- **Input:** Backlog item or user requirement.
- **Action:** Initializes task or sprint spec using `docs/sprints/SPRINT_SPEC_TEMPLATE.md`. Refines the item until it passes the **refinement gate (R1)**: problem statement, scoped in/out, measurable ACs, priority, and architecture readiness (boundaries and contracts established if none exist).
- **Output:** Clear problem statement, target personas, and measurable acceptance criteria (ACs).

### Phase 2: Benchmarking & Experience Design (Researcher + Designer)
- **Action:** Analyzes world-class benchmarks (Linear, Notion, GitHub Projects) and specifies visual tokens, responsive behavior, and touch ergonomics (≥ 44px).
- **Output:** Populates design spec, interactive states, and edge-case handling.

### Phase 3: Dev Execution (`doing` ➔ `review`) (Principal Engineer)
- **Action:** Implements modular, strictly typed code adhering to domain invariants. **Architecture-First:** establishes module boundaries and public contracts before coding if undefined. **Strict Modularity:** enforces hard ceiling of < 1000 LOC per file (target 150 - 500 LOC) and separates presentation, business logic, and infrastructure (zero God-Files). Claims the item by moving it `(pool)` ➔ `doing` - only after the refinement gate passed.
- **Ticking ACs:** Checks off acceptance criteria in real-time (`- [x]`).
- **Output:** Passes the item to `status: review` upon completing implementation and local testing. **Cannot self-certify:** moving to `ready` is exclusive to the QA Auditor.

### Phase 4: QA Gate (`review` ➔ `ready`) - Formal Handover in a Clean-Context Sub-Agent (QA Auditor)
- **Mandatory Clean-Context Sub-Agent:** The thread that implemented the code **never** executes Phase 4. The `pm-orchestrator` spawns an isolated [`rigorous-qa-auditor`](skills/rigorous-qa-auditor/SKILL.md) sub-agent (`invoke_subagent`) with a clean context window, passing only the task path (ACs) and the `git diff`.
- **Action:** The QA sub-agent audits the item using the **Verification Pyramid (Zero-Waste Testing)** in strict sequence:
  1. ✅ `tsc --noEmit` / `npm run validate` (strict typing & repo consistency, 0 errors)
  2. ✅ Unit & integration tests (`npm test`, headless code 0)
  3. ✅ Backlog & spec consistency checks
  4. ✅ Production build (`npm run build`)
  5. ✅ `node scripts/audit-ux-code.cjs --strict` (static UX audit, headless)
- **Blind Semantic Diff Audit:** Beyond mechanical checks, the clean-context QA sub-agent verifies that every checked AC (`- [x]`) is genuinely implemented in the `git diff`, with no module-wide `vi.mock()` evasions, no `as unknown as` type escapes, strict modularity (zero files >= 1000 LOC, zero God-Files bundling multi-layer logic), and all mandatory headless audits satisfied.
- **Anti-Browser-Subagent Inefficiency:** Prohibited to invoke `browser_subagent` for logic, state, API contracts, or persistence that can be audited in milliseconds headlessly. Reserved strictly for static-undeducible CSS/layout issues or explicit user prompt.
- **Output:** Once both `npm run gate:qa <ID>` (`exit 0`) and the blind diff audit pass, moves the item to `status: ready`. On failure, records actionable findings (`file:line`) and moves it back to `doing` (transition T3).
- **`ready` is the formal delivery of development**: the item is validated and immediately eligible for packaging and deployment. A certified item is frozen: any post-QA code change invalidates the certification and requires a return to `doing`.

#### Double Gate: Mechanical Runner + Blind Sub-Agent

> **Neither prose nor same-thread roleplay is a gate.** An agent asked to "act as the QA Auditor" in the same turn that it wrote the code will tick the ACs by inertia and rationalize its own shortcuts. This playbook prevents both failure modes: `scripts/gate-qa.mjs` enforces the mechanical gate (**exit code 0**), and **context isolation (`invoke_subagent`)** enforces an unbiased semantic audit of the `git diff`.

```bash
npm run gate:qa TASK-ID                    # full mechanical gate
node scripts/gate-qa.mjs TASK-ID --no-run  # inspection only; exits 2, never certifies
```

The runner rejects, mechanically: an item not in `review`; any unchecked acceptance criterion; a `blocked_reason` that is missing, empty or whitespace on a `blocked` item (and a stray `blocked_reason` on an item that is not blocked); and any declared dependency that is missing from disk or not in `done`. It then runs the pyramid, and a step that cannot execute is reported `SKIPPED` - **a pyramid where nothing ran fails the gate rather than passing it**, because certification on an unexecuted gate is the exact theatre this runner exists to prevent.

Running the gate is necessary (`exit 0`) and the clean-context QA Auditor sub-agent issues the final verdict after auditing the `git diff` against the ACs.

#### `blocked`: registering an impediment

A task that cannot proceed is moved to `status: blocked` with a **non-empty `blocked_reason`** in its frontmatter, rather than being left to rot in `doing` where it inflates WIP and nobody remembers why it stopped. It returns to `doing` or `draft` only when the impediment is resolved or its blocking dependencies reach `done` or are explicitly unlinked. The invariant is enforced by the runner, not by discipline.

### Phase 5: Release Management & Prod Implementation (`ready` ➔ `done`)
- **Packaging by Delivered Value:** Release Management (PO + Scrum/Delivery Lead) groups available items in `ready` based on value delivered.
- **Decoupled Sprints & Releases:** Sprints and releases have no 1:1 coupling. Releases are created based on delivered value with any available `ready` items (historical or from the active sprint), with or without an active sprint.
- **Production Deployment (`done`):** Upon committing and pushing the release package to production (main cloud), the packaged items transition to `status: done`.
- **Fundamental Invariant:** **No item can exist in production that is not in `done`**.

---

## ⏱️ Sprint Lifecycle & PO Sovereignty

1. **Fixed Timebox:** A sprint concludes when its scheduled timebox expires (fixed duration), regardless of whether all planned items are finished. Incomplete items are replanned to the next sprint or returned to the backlog.
2. **Continuous Productivity:** If all items in a sprint are completed before the timebox expires, the PO expands the sprint scope by pulling in newly refined backlog items to maintain productivity. Sprints rarely conclude prematurely.
3. **No Autonomous Close or Retro:** The AI agent **NEVER** closes a sprint or executes a retrospective autonomously by deduction. Both actions require explicit, textual instructions from the PO (e.g., *"close the sprint"*, *"run the sprint retro"*).
4. **Mandatory Retro Outputs:** Update rules in `AGENTS.md`, refine skills, and create backlog tasks for all identified technical debt or process improvements.

---

## 🧠 Continuous Learning Protocol (Knowledge Feeder)

At the conclusion of each release or sprint:
1. **New UI or input discoveries:** Documented into relevant design/form skills.
2. **Superior architectural patterns:** Documented as an Architectural Decision Record (ADR).
3. **No bug or friction is solved twice:** Converted into a permanent project rule in `AGENTS.md`.
