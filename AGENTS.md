# Global Agent Instructions - [PROJECT_NAME]

---

## Language & Communication

- Code, variables, functions, and technical comments: **in English**.
- Conversations, product documentation, and architecture decisions: **[Specify Language, e.g., English or Spanish]**.
- **Standard Hyphen Rule (Anti-Em-Dash / Anti-AI):** Never use em-dash (`—`) or en-dash (`–`) in browser titles, UI text, select options, release titles, release notes, `CHANGELOG.md`, `releases.json`, or documentation. Always use the standard hyphen `-` with spaces (` - `). The em-dash is an artificial AI cliché that degrades product craftsmanship.

---

## General Behavior & Operating Principles

1. **Plan before executing.** Present a clear plan before modifying code or architecture on any non-trivial task. Wait for confirmation. Si el proyecto carece de arquitectura establecida para el módulo o subsistema, diseñar límites y contratos antes de codificar.
2. **Ask when genuinely ambiguous.** Do not guess. If there are multiple viable interpretations, clarify first.
   - **Refinamiento por preguntas, no por asunción.** Un ítem entra a `doing` solo con sus ambigüedades resueltas explícitamente: casos borde, fallbacks, estados vacíos, tradeoffs y alcance negativo, con las respuestas registradas. La desalineación inicial no la detecta QA, porque QA valida contra ACs que nacieron de la premisa equivocada. Detalle en la skill `pm-orchestrator` § Grilling Session.
   - **Glosario de dominio.** Si el proyecto mantiene un `DOMAIN.md`, consultarlo antes de nombrar un concepto del negocio: el término canónico reemplaza al párrafo y evita inventar vocabulario. Plantilla en [`docs/DOMAIN_TEMPLATE.md`](docs/DOMAIN_TEMPLATE.md). Es opt-in; ningún proyecto está obligado a tenerlo.
3. **Simple solutions that scale.** Avoid over-engineering. The simplest solution that reliably solves the problem and can grow is the right one.
   - **Diff mínimo viable.** La mejor línea de código es la que no se escribe. Antes de escribir un helper o instalar un paquete, inspeccionar lo que el repo ya tiene y considerar la standard library. Una dependencia de terceros para algo de diez líneas es un defecto.
   - **Blast radius antes de editar.** Mapear llamadores, tests, fixtures, exports y config afectados *antes* de modificar código.
   - **Cierre honesto.** Toda intervención declara en una o dos líneas qué no probó, qué salteó a propósito y qué riesgo queda. Detalle completo en la skill `principal-engineer` § Disciplina Ponytail.
4. **Document important decisions.** Record architectural deviations, patterns, and new standards in documentation.
5. **Never break what already works.** Understand full blast radius before refactoring.
6. **Agile Delivery Flow (Backlog [draft] ➔ Dev [doing] ➔ QA [ready] ➔ Release Management ➔ Prod [done]):**
   > The delivery status vocabulary lives in **[.agents/STATE_MACHINE.md](.agents/STATE_MACHINE.md)**. All items in the backlog reside in `draft` (or `ideas` for discovery). The delivery flow actively transitions: `draft` ➔ `doing` ➔ `review` ➔ `ready` ➔ `done`. **The backlog is a planning container, not a status value.** Refinement is a gate (R1) before entering `doing`.
   - **Default Entry Point (`pm-orchestrator`):** Unless the user explicitly invokes another role or skill directly, every conversation thread starts with the host agent operating as [`pm-orchestrator`](.agents/skills/pm-orchestrator/SKILL.md) - leading the Grilling Session, classifying the operating mode, and orchestrating specialized sub-agents.
   - **Dev (`doing` ➔ `review`):** Implements code and checks acceptance criteria (`- [x]`). At completion, transitions task to `review`.
   - **QA (`review` ➔ `ready` - Mandatory Clean-Context Sub-Agent):** Audits under the Verification Pyramid. Transitions to `ready` as the **formal handover of development (developer/agent finish line)**. This transition is exclusive to the QA role and **MUST run in an isolated sub-agent with a clean context window (`invoke_subagent`)** that receives only the task ACs, the `git diff`, and [`rigorous-qa-auditor`](.agents/skills/rigorous-qa-auditor/SKILL.md) + `npm run gate:qa <ID>`. The context that wrote the code NEVER self-certifies in the same thread, and NEVER marks `done`.
   - **Release Management (PO + Scrum/Delivery Lead):** Assembles releases by **delivered value** from all available `ready` items (historical or current).
   - **Production Deployment (`ready` ➔ `done`):** Deployed package items become `done`. Marking `done` without an actual deploy is a state lie.
   - **Fundamental Invariants:** **No item can exist in production that is not in `done`**, and **no item can be marked `done` without an actual release deploy**.
7. **Decoupled Sprints & Releases:** Sprints and releases have no 1:1 coupling. Releases are created based on delivered value with any available `ready` items, with or without an active sprint.
8. **Sprint Lifecycle & PO Sovereignty:** Sprints are fixed timeboxes. If items complete before the timebox expires, the PO expands scope with refined backlog items to prevent idle gaps. Sprints rarely conclude prematurely. The agent NEVER closes a sprint or triggers a retrospective by deduction; only upon explicit textual command from the PO.
9. **Dynamic Operating Modes:** The user should never need to manually specify what role or framework to trigger. The `pm-orchestrator` dynamically classifies requests between:
   - *(a) Mode 1: Surgical Focus / Fast-Track:* Direct [`principal-engineer`](.agents/skills/principal-engineer/SKILL.md) intervention for targeted bugfixes, invariants, and minor tweaks (zero sprint paperwork; if certifying a backlog task `review` ➔ `ready`, still requires `gate:qa` + clean-context QA sub-agent).
   - *(b) Mode 2: Tactical Duo:* [`worldclass-product-designer`](.agents/skills/worldclass-product-designer/SKILL.md) + [`principal-engineer`](.agents/skills/principal-engineer/SKILL.md) sub-agents + clean-context [`rigorous-qa-auditor`](.agents/skills/rigorous-qa-auditor/SKILL.md) for component/modal redesigns.
   - *(c) Mode 3: Full Backlog & Sprint Flow:* Full agile delivery loop orchestrated by [`pm-orchestrator`](.agents/skills/pm-orchestrator/SKILL.md) across isolated role sub-agents for backlog features or structural changes.
   See [.agents/TEAM_PLAYBOOK.md](.agents/TEAM_PLAYBOOK.md) for the role matrix, handoff contracts, and sub-agent criteria.
10. **Sub-Agent Autonomy & Context Isolation:** Golden rule: *"Orchestrate from the hub; isolate execution and verification in clean sub-agent contexts"*. The host `pm-orchestrator` dispatches sub-agents (`invoke_subagent`) with explicit skill paths and contracts for research, UX spec, SDD implementation steps, and blind QA certification, while keeping domain rules, schemas, and state invariants strictly sequential (one active writer at a time).

---

## Tech Stack & Architecture

> Configure your project stack below:

- **Frontend:** [e.g., React / Next.js / Vue / Svelte]
- **Backend / DB:** [e.g., PostgreSQL / MySQL / Node.js / Go / Python]
- **Styling:** [e.g., Tailwind CSS / CSS Modules]
- **Forms & Validation:** [e.g., React Hook Form + Zod]
- **Testing:** [e.g., Vitest / Jest / Playwright]

---

## Non-Negotiable Best Practices

- **The Verification Pyramid (Zero-Waste Testing):**
  Validate every code change in strict order:
  1. Strict typechecking (e.g. `tsc --noEmit`, 0 errors).
  2. Headless unit & integration tests (e.g. `npm test`, fast headless verification).
  3. Spec & backlog consistency checks.
  4. Production build (e.g. `npm run build`).
  > [!CAUTION]
  > **Anti-Browser-Subagent Inefficiency:** Prohibited to invoke `browser_subagent` for logic, state, API contracts, or persistence that can be audited headlessly in milliseconds. Reserved strictly for static-undeducible visual CSS/layout issues or explicit user requests.
- **Controlled Inputs:** Every form input must have a defined initial value (e.g. `""`, never `undefined`) to avoid uncontrolled-to-controlled warnings.
- **Security First:** Always validate and sanitize inputs at application boundaries. Enforce strict authorization and never expose private keys or secrets.
- **Mobile First & Ergonomics:**
  - Minimum interactive tap target of **44×44px**.
  - Visible focus rings for keyboard navigation.
  - No horizontal page overflow on small screens (375px/390px).
- **Architecture-First & Strict Modularity (Ceiling < 1000 LOC):**
  - **Architecture Before Implementation:** If the project lacks a defined architecture or a task introduces a new domain or subsystem, establish and document module boundaries, layers, and public contracts before writing code.
  - **1000-Line Limit & Technical Debt Visibility:** Source files (modules, components, services, scripts, or handlers) should remain under **1000 lines of code** (healthy modular range: **150 - 500 lines**). The `check-loc` tool provides clear visibility of modular technical debt. It is advisory by default to respect PO sovereignty and prevent blocking urgent releases; the PO arbitrates whether to refactor immediately or record and prioritize the debt in the backlog.
  - **Anti-God-File & Layer Separation:** Strictly separate presentation/UI, pure domain logic, infrastructure/persistence, and state management. Never bundle multi-layer logic into a giant file acting as a single point of failure (SPoF).

---

## Git Discipline - Commits & Pushes

> [!CAUTION]
> **The canonical git policy lives in [.agents/rules/git-workflow.md](.agents/rules/git-workflow.md).** It is not duplicated here on purpose: two copies of a rule drift apart. Read it before any `git commit` or `git push`.

Headline rule, for immediate effect:

- **NEVER** execute a git commit or push without explicit verbal authorization from the user for **each** action. Words like *"looks good"*, *"ok"*, *"proceed"* mean **implement code only**.

### Multi-Agent Parallelism & Dynamic Peer Discovery

> [!CAUTION]
> **Prohibido `git checkout` o `git restore` en el working tree principal cuando otro agente está trabajando en el mismo repositorio.** El working tree y `.git/HEAD` son estado compartido a nivel de sistema de archivos: un `checkout` cambia la rama del otro agente en silencio, mientras escribe, y el siguiente `git commit` del otro aterriza en la rama equivocada.

- **Pre-Flight Concurrency Probe:** Antes de modificar archivos o ejecutar comandos de Git, consultar el backlog (`status: doing`) y `git status --porcelain`. Si hay un ítem en `doing` con `claimed_by` ajeno (formato `<provider>:<id>`, ej. `antigravity:<id>`, `cursor:<id>`, `human:<id>`), **prohibido revertir o limpiar el árbol de trabajo**.
- **Handshake Autónomo & Protocolo Cross-Harness:** Si comparten runtime (ej. `antigravity:`), contactar al par directamente vía `send_message(Recipient: claimed_by)`. Si son de proveedores heterogéneos, respetar el lease, evitar RPC fallido y auto-aislarse de inmediato en worktree informando al usuario en chat.
- **Auto-Worktree:** Cada agente o tarea paralela opera en su **worktree aislado**, sobre su propia rama. Receta y reglas de convivencia: [`.agents/rules/git-workflow.md`](.agents/rules/git-workflow.md) § Multi-Agent Parallelism.

```bash
git worktree add -b <branch> ../<repo>-<task>
# ... trabajo aislado ...
git fetch . <branch>:dev          # consolidar sin cambiar de rama
git worktree remove ../<repo>-<task>
```

> El flag `-b` es obligatorio: sin él git falla con `invalid reference` si la rama no existe, y crearla exigiría el `checkout` que esta regla prohíbe.

> El aislamiento de working tree no aísla *líneas en conflicto*: dos agentes que editan el mismo archivo se mergearán igual. Para tareas que tocan los mismos documentos, secuencializar o dividir el alcance.
