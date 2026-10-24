# Global Agent Instructions - Project Playbook

---

## Language & Communication

- Code, variables, functions, and technical comments: **in English**.
- Conversations, product documentation, and architecture decisions: **English** (or project-configured language).
- **Standard Hyphen Rule (Anti-Em-Dash / Anti-AI):** Never use em-dash (`—`) or en-dash (`–`) in browser titles, UI text, select options, release titles, release notes, `CHANGELOG.md`, `releases.json`, or documentation. Always use the standard hyphen `-` with spaces (` - `). The em-dash is an artificial AI cliché that degrades product craftsmanship.

---

## General Behavior & Operating Principles

1. **Plan before executing.** Present a clear plan before modifying code or architecture on any non-trivial task. Wait for confirmation. If the project lacks an established architecture for the module or subsystem, design boundaries and contracts before writing code.
2. **Ask when genuinely ambiguous.** Do not guess. If there are multiple viable interpretations, clarify first.
   - **Refinement by Inquiry, Not by Assumption.** An item enters `doing` only with its ambiguities explicitly resolved: edge cases, fallbacks, empty states, trade-offs, and negative scope, with all decisions recorded. Initial misalignment cannot be caught by QA, because QA validates against acceptance criteria born from the wrong premise. Detailed in skill [`pm-orchestrator`](.agents/skills/pm-orchestrator/SKILL.md) § Structured Refinement Interview.
   - **Domain Glossary.** If the project maintains a `DOMAIN.md`, consult it before naming a business concept: canonical terms replace paragraphs and prevent hallucinated vocabulary. Template in [`docs/DOMAIN_TEMPLATE.md`](docs/DOMAIN_TEMPLATE.md). It is opt-in; no project is required to have one.
3. **Simple solutions that scale.** Avoid over-engineering. The simplest solution that reliably solves the problem and can grow is the right one.
   - **Minimum Viable Diff.** The best line of code is the one that is never written. Before writing a helper or installing a package, inspect existing repository utilities and consider the standard library. Introducing a third-party dependency for a ten-line utility is a defect.
   - **Map Blast Radius Before Editing.** Identify callers, tests, fixtures, exports, and configuration affected *before* modifying code.
   - **Honest Scope & Residual Risk Declaration.** Every intervention concludes by declaring in one or two lines what was not tested, what was intentionally skipped, and what residual risk remains. Detailed in skill [`principal-engineer`](.agents/skills/principal-engineer/SKILL.md) § Honest Scope & Residual Risk Declaration.
4. **Document important decisions.** Record architectural deviations, patterns, and new standards in documentation.
5. **Never break what already works.** Understand full blast radius before refactoring.
6. **Agile Delivery Flow (Backlog [draft] ➔ Dev [doing] ➔ QA [ready] ➔ Release Management ➔ Prod [done]):**
   > The delivery status vocabulary lives in **[.agents/STATE_MACHINE.md](.agents/STATE_MACHINE.md)**. All items in the backlog reside in `draft` (or `ideas` for discovery). The delivery flow actively transitions: `draft` ➔ `doing` ➔ `review` ➔ `ready` ➔ `done`. **The backlog is a planning container, not a status value.** Refinement is a gate (R1) before entering `doing`.
   - **Default Entry Point (`pm-orchestrator`):** Unless the user explicitly invokes another role or skill directly, every conversation thread starts with the host agent operating as [`pm-orchestrator`](.agents/skills/pm-orchestrator/SKILL.md) - leading the Structured Refinement Interview, classifying the operating mode, and orchestrating specialized sub-agents.
   - **Dev (`doing` ➔ `review`):** Implements code and checks acceptance criteria (`- [x]`). At completion, transitions task to `review`.
   - **QA (`review` ➔ `ready` - Mandatory Clean-Context Sub-Agent):** Audits under the Verification Pyramid. Transitions to `ready` as the **formal handover of development (developer/agent finish line)**. This transition is exclusive to the QA role and **MUST run in an isolated sub-agent with a clean context window (`invoke_subagent`)** that receives only the task ACs, the `git diff`, and [`qa-auditor`](.agents/skills/qa-auditor/SKILL.md) + `node scripts/gate-qa.mjs <ID>`. The context that wrote the code NEVER self-certifies in the same thread, and NEVER marks `done`.
   - **Release Management (PO + Scrum/Delivery Lead):** Assembles releases by **delivered value** from all available `ready` items (historical or current).
   - **Production Deployment (`ready` ➔ `done`):** Deployed package items become `done`. Marking `done` without an actual deploy is a state lie.
   - **Fundamental Invariants:** **No item can exist in production that is not in `done`**, and **no item can be marked `done` without an actual release deploy**.
7. **Decoupled Sprints & Releases:** Sprints and releases have no 1:1 coupling. Releases are created based on delivered value with any available `ready` items, with or without an active sprint.
8. **Sprint Lifecycle & PO Sovereignty:** Sprints are fixed timeboxes. If items complete before the timebox expires, the PO expands scope with refined backlog items to prevent idle gaps. Sprints rarely conclude prematurely. The agent NEVER closes a sprint or triggers a retrospective by deduction; only upon explicit textual command from the PO.
9. **Dynamic Operating Modes:** The user should never need to manually specify what role or framework to trigger. The `pm-orchestrator` dynamically classifies requests between:
   - *(a) Mode 1: Surgical Focus / Fast-Track:* Direct [`principal-engineer`](.agents/skills/principal-engineer/SKILL.md) intervention for targeted bugfixes, invariants, and minor tweaks (zero sprint paperwork; if certifying a backlog task `review` ➔ `ready`, still requires `gate:qa` + clean-context QA sub-agent).
   - *(b) Mode 2: Tactical Duo:* [`product-designer`](.agents/skills/product-designer/SKILL.md) + [`principal-engineer`](.agents/skills/principal-engineer/SKILL.md) sub-agents + clean-context [`qa-auditor`](.agents/skills/qa-auditor/SKILL.md) for component/modal redesigns.
   - *(c) Mode 3: Full Backlog & Sprint Flow:* Full agile delivery loop orchestrated by [`pm-orchestrator`](.agents/skills/pm-orchestrator/SKILL.md) across isolated role sub-agents for backlog features or structural changes.
   See [.agents/TEAM_PLAYBOOK.md](.agents/TEAM_PLAYBOOK.md) for the role matrix, handoff contracts, and sub-agent criteria.
10. **Sub-Agent Autonomy & Context Isolation:** Golden rule: *"Orchestrate from the hub; isolate execution and verification in clean sub-agent contexts"*. The host `pm-orchestrator` dispatches sub-agents (`invoke_subagent`) with explicit skill paths and contracts for research, UX spec, SDD implementation steps, and blind QA certification, while keeping domain rules, schemas, and state invariants strictly sequential (one active writer at a time).

---

## Tech Stack & Architecture

> Configure your project stack below (replace with project-specific choices):

- **Frontend:** React / Next.js (or configured framework)
- **Backend / DB:** Node.js / PostgreSQL (or configured backend)
- **Styling:** Tailwind CSS
- **Forms & Validation:** React Hook Form + Zod
- **Testing:** Vitest / Node.js test runner

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
> **Prohibited to run `git checkout` or `git restore` in the primary working tree while another agent is working in the same repository.** The working tree and `.git/HEAD` represent shared filesystem state: checking out a branch silently switches the other agent's branch while it is writing, landing its subsequent commit on the wrong branch.

- **Pre-Flight Concurrency Probe:** Before modifying files or running Git commands, check the backlog (`status: doing`) and `git status --porcelain`. If an item is in `doing` with a foreign `claimed_by` (format `<provider>:<id>`, e.g., `antigravity:<id>`, `cursor:<id>`, `human:<id>`) or `git status --porcelain` reveals uncommitted changes (`A `, `M `) not created by the active session, **never revert or clean the shared working tree**, and immediately self-isolate in a worktree.
- **Autonomous Handshake & Cross-Harness Protocol:** If agents share a runtime (e.g., `antigravity:`), contact the peer directly via `send_message(Recipient: claimed_by)`. If from heterogeneous providers, respect the lease, avoid failing RPC calls, and immediately self-isolate in a worktree, notifying the user in chat.
- **Auto-Worktree:** Each agent or parallel task operates in its own isolated worktree on its own branch. Recipe and coexistence rules in [`.agents/rules/git-workflow.md`](.agents/rules/git-workflow.md) § Multi-Agent Parallelism.

```bash
git worktree add -b <branch> ../<repo>-<task>
# ... isolated task work ...
git fetch . <branch>:dev          # consolidate without branch switching
git worktree remove ../<repo>-<task>
```

> The `-b` flag is mandatory: without it Git fails with `invalid reference` if the branch does not exist, and creating it would require the checkout forbidden by this rule.

> Working tree isolation does not isolate conflicting lines: two agents editing the same file will still conflict upon merge. For tasks touching the same files, sequence execution or split the scope.
