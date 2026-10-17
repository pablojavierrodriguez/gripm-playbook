# Multi-Agent Team Playbook - Agile Autonomous Framework

This playbook establishes a collaborative, autonomous operating loop between specialized agent roles and human leads to build and maintain high-grade software products.

> **Source of truth for states:** the delivery status vocabulary and its transitions are defined once, in [STATE_MACHINE.md](STATE_MACHINE.md). This document references it and must never redefine the state table.

---

## 🚦 Dynamic Decision Matrix (System Autonomy)

The user should never have to manually specify when to trigger a sprint or which role to activate. The system automatically classifies incoming requests into one of three operating tracks:

| Operating Track | Typical Triggers | Roles Involved | Overhead / Documentation |
| :--- | :--- | :--- | :--- |
| **Mode 1: Surgical Focus** *(Fast-Track)* | Targeted bugfixes, calculations/invariants, copy/typo tweaks, linter fixes, failing unit tests. | **Principal Engineer** (direct, exclusive control). | **Zero bureaucracy.** No sprint doc. Atomic modification + verification (typecheck + tests). |
| **Mode 2: Tactical Duo** *(UX + Engineering)* | Component redesign, new modals/sheets, ergonomics & touch targets, visual charts. | **Product Designer** + **Principal Engineer** (+ QA check). | **Lightweight.** Plan outlined directly in chat. No sprint doc unless touching database schema. |
| **Mode 3: Full Sprint & Backlog Flow** | Major backlog feature, database schema migrations, complex business workflows. | Loop: **PM Orchestrator** ➔ **Designer** ➔ **Principal Engineer** ➔ **QA Auditor** ➔ **Release Management**. | **Formal.** Tracked via backlog task or sprint spec, verified through the Verification Pyramid and packaged by value. |

---

## 🤖 Sub-Agent Autonomy & The Verification Pyramid

The team decides when to spawn sub-agents (e.g. browser subagents, background jobs) under a golden rule:

> **"Atomic focus on domain logic; parallel hands on exploration and verification."**

### 🟢 When to Parallelize (Sub-Agents / Background Tasks):
1. **Auditing Visual Layouts (`browser_subagent`):**
   - Reserved **exclusively** for visual layout/CSS issues not deducible statically, complex viewport rendering, or upon explicit user request.
2. **Exploratory Research & Benchmarking (Market Researcher):**
   - Investigate industry references (Linear, Stripe, Notion, Obsidian) or analyze external API documentation without polluting the core technical context.
3. **Accessibility (a11y) & Static Code Audits:**
   - Execute contrast ratios, accessibility checks, or static UX scans (`npm run audit:ux`) asynchronously.

### 🔴 When to Keep STRICT ATOMIC FOCUS (Single-thread, No Sub-Agents):
1. **Domain Logic & State Invariants:**
   - Core business logic, central state stores, and data integrity require strict sequential reasoning. Fragmenting domain logic across parallel subagents risks race conditions and contradictory code.
2. **Database Schemas & Migrations:**
   - Schema foundations, migrations, and Row-Level Security (RLS) policies must be designed and validated by a single technical mind to guarantee idempotence.
3. **Core Architectural Refactoring & Backlog Parsers:**
   - Backlog sync engines, parsers, and global context providers require end-to-end coherence.

### 🔁 Subagent-Driven Development (SDD)

Un único hilo ejecutando un plan extenso sufre **fatiga de contexto**: olvida instrucciones tempranas, mezcla estados, reintroduce regresiones en tests que pasaban y empieza a parchear improvisando. SDD es el antidote para tareas de alta complejidad.

**1. Planes a prueba de contexto.** Desglosar el trabajo en pasos **hiper-atómicos e independientes**. Cada paso se redacta bajo Red-Green TDD con instrucciones explícitas y autocontenidas: un subagente sin historial debe poder ejecutarlo sin desviarse. El paso declara qué archivos toca, qué se espera que haga, y cómo se verifica.

**2. Un subagente fresco por paso.** El orquestador **no** pica todo el código en el hilo principal. Despacha un subagente nuevo para el paso N, operando en un worktree aislado (ver § Workspace Isolation).

**3. Supervisión y consolidación secuencial.** El orquestador revisa el diff producido, corre la verificación headless, y **solo cuando pasa en verde** consolida y dispara el paso N+1. Un subagente no se lanza en paralelo con el siguiente sobre el mismo trabajo.

> [!CAUTION]
> SDD es para **tareas de alta complejidad**. Para un bugfix puntual es sobre-ingeniería: el costo de coordinar el contexto no se recupera. Aplica el criterio Ponytail - la estructura existe para cuando el problema la amerita, no por defecto.

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
- **Action:** Initializes task or sprint spec using `docs/sprints/SPRINT_SPEC_TEMPLATE.md`. Refines the item until it passes the **refinement gate (R1)**: problem statement, scoped in/out, measurable ACs and priority.
- **Output:** Clear problem statement, target personas, and measurable acceptance criteria (ACs).

### Phase 2: Benchmarking & Experience Design (Researcher + Designer)
- **Action:** Analyzes world-class benchmarks (Linear, Notion, GitHub Projects) and specifies visual tokens, responsive behavior, and touch ergonomics (≥ 44px).
- **Output:** Populates design spec, interactive states, and edge-case handling.

### Phase 3: Dev Execution (`doing` ➔ `review`) (Principal Engineer)
- **Action:** Implements modular, strictly typed code adhering to domain invariants. Claims the item by moving it `(pool)` ➔ `doing` - only after the refinement gate passed.
- **Ticking ACs:** Checks off acceptance criteria in real-time (`- [x]`).
- **Output:** Passes the item to `status: review` upon completing implementation and local testing. **Cannot self-certify:** moving to `ready` is exclusive to the QA Auditor.

### Phase 4: QA Gate (`review` ➔ `ready`) - Formal Handover of Development (QA Auditor)
- **Action:** Audits the item using the **Verification Pyramid (Zero-Waste Testing)** in strict sequence:
  1. ✅ `tsc --noEmit` (strict typing, 0 errors)
  2. ✅ Unit & integration tests (`npm test`, headless code 0)
  3. ✅ Backlog & spec consistency checks
  4. ✅ Production build (`npm run build`)
  5. ✅ `node scripts/audit-ux-code.cjs --strict` (static UX audit, headless)
- **Anti-Browser-Subagent Inefficiency:** Prohibited to invoke `browser_subagent` for logic, state, API contracts, or persistence that can be audited in milliseconds headlessly. Reserved strictly for static-undeducible CSS/layout issues or explicit user prompt.
- **Output:** Once verified, moves the item to `status: ready`. On failure, records actionable findings and moves it back to `doing` (transition T3).
- **`ready` is the formal delivery of development**: the item is validated and immediately eligible for packaging and deployment. A certified item is frozen: any post-QA code change invalidates the certification and requires a return to `doing`.

#### The gate is executable, not a promise

> **Prose is not a gate.** An agent asked to "act as the QA Auditor" can perform the role in the same turn that it wrote the code, tick the ACs by inertia, and promote the item on discourse alone. This playbook ships the gate as a program so that T2 is satisfied by **exit code 0**, not by an assertion.

```bash
npm run gate:qa TASK-ID                    # full gate
node scripts/gate-qa.mjs TASK-ID --no-run  # inspection only; exits 2, never certifies
```

The runner rejects, mechanically: an item not in `review`; any unchecked acceptance criterion; a `blocked_reason` that is missing, empty or whitespace on a `blocked` item (and a stray `blocked_reason` on an item that is not blocked); and any declared dependency that is missing from disk or not in `done`. It then runs the pyramid, and a step that cannot execute is reported `SKIPPED` - **a pyramid where nothing ran fails the gate rather than passing it**, because certification on an unexecuted gate is the exact theatre this runner exists to prevent.

Running the gate is not the verdict: the QA Auditor still issues it. The runner is the evidence, not the judge.

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
