# Delivery Flow State Machine

> **Single source of truth for delivery status.** `AGENTS.md`, `TEAM_PLAYBOOK.md`, `README.md`, and sprint specifications reference this file. No other document redefines the state table: if you change a rule, you change it here.

---

## 1. Statuses and Flow Taxonomy

The work lifecycle consists of clearly typed, unambiguous statuses:

| Phase | Status | Meaning | Where it Lives | Assigned By |
| :--- | :--- | :--- | :--- | :--- |
| **Discovery** | `ideas` | Idea, hypothesis, or preliminary investigation. | Pool / Discovery | PO / Designer |
| **Backlog** | `draft` | **Formally specified task with ACs.** Ready for development. | Backlog (disk) | PO / Engineer upon task creation |
| **Delivery** | `blocked` | **Halted due to a declared external impediment.** Requires `blocked_reason`. | Backlog (disk) | PO / Engineer |
| **Delivery** | `doing` | In active development. The only status with code actively being written. | Working branch | Principal Engineer / Agent |
| **Delivery** | `review` | Implementation complete and local tests green. Awaiting certification. | Working branch | Principal Engineer / Agent |
| **Delivery** | `ready` | **Formal development delivery (developer/agent finish line).** Certified under Pyramid. | Branch / Staging | **QA Auditor / Test Suite** |
| **Production** | `done` | **Deployed to production.** Packaged and published in a release. | Production / Tag | **Release Management / Deploy** |
| **Out of Flow** | `dismissed` | **Dismissed.** The item will not exist: premise was false, scope was absorbed, or the PO decided it is no longer valuable. Not blocked or abandoned. | Backlog (disk) | **PO / Release Management** |

### Fundamental State Rules:

1. **The Backlog is not a status value:** It is the **planning dimension and container** for unstarted work. Every task in the Backlog holds the legitimate canonical status `draft` (or `ideas` if exploratory).
2. **Zero items without a status:** Every task created on disk is born with `status: draft`. Leaving tasks without a status or with an empty status breaks strict typing (`ItemStatus`) and corrupts view filters.
3. **`ready` is the developer finish line:** Development work for both human engineers and AI agents concludes formally upon certification into `ready`. An engineer or agent **NEVER** moves a task to `done` during development.
4. **`done` requires an actual deployment:** The `done` status is assigned exclusively when Release Management or the release pipeline packages the release and deploys it to production (the Release Assembler automatically promotes `ready` ➔ `done`). Marking `done` without an actual deploy is a state lie.
5. **`blocked` requires `blocked_reason`:** Every task moved to `blocked` **must** declare a non-empty `blocked_reason: "<reason>"` field in its YAML frontmatter. Without a reason, it is not a blockage; it is an abandoned task in `doing` distorting active WIP.
6. **`dismissed` requires `dismissed_reason`:** Identical to `blocked`, a dismissal without an explicit written reason is indistinguishable from an abandoned item. The field is mandatory. Distinguishing the two is vital: `blocked` is a temporary impediment with an expected resolution; `dismissed` is a deliberate decision that the item will not exist. A dismissed item **never** appears in release notes and **never** counts toward delivered capacity.

---

## 2. Refinement: A Gate, Not a Status

Refinement is an **entry condition**, not a workflow stage. It is modeled as a flag on the backlog item, not as a status token.

**Gate R1 - an item may enter `doing` only if:**
1. It has a clear **problem statement** (from the user perspective, not code internals).
2. It has a bounded scope **and** explicit out-of-scope boundaries.
3. It has measurable acceptance criteria (ACs). "Make it look nice" is not an acceptance criterion.
4. It has an assigned priority set by the Product Owner.
5. **Its ambiguities are explicitly resolved and recorded.** An item refined by agent assumption fails Gate R1: initial misalignment cannot be caught by QA, because QA validates against acceptance criteria born from the wrong premise. Refinement demands an explicit inquiry round covering edge cases, fallbacks, empty states, and trade-offs, with answers recorded on the item. Detailed in skill [`pm-orchestrator`](skills/pm-orchestrator/SKILL.md) § Structured Refinement Interview.

The flag is recorded in the project backlog:

```markdown
### [BACKLOG-001] Imperative task title
- **Refined:** yes (2026-10-04)   # or: no - missing: <details>
```

An unrefined item remains in `draft` (or `ideas` if discovery) in the backlog. It cannot transition to `doing` until Gate R1 passes.

---

## 3. Transitions

| # | From → To | Actor | Guard |
| :--- | :--- | :--- | :--- |
| T0 | `draft` → `doing` | Principal Engineer | **Gate R1 approved** + prioritized by PO + **all `dependencies:` in `done`** + atomic registration of `claimed_by: "<provider>:<session_or_agent_id>"` (e.g., `antigravity:<id>`, `cursor:<id>`, `claude-code:<id>`, `human:<id>`) in frontmatter + branch/worktree ready. |
| T1 | `doing` → `review` | Principal Engineer | Code implemented, ACs checked (`- [x]`), and Pyramid steps 1 - 2 green locally (`typecheck` + tests). |
| T2 | `review` → `ready` | **QA Auditor (Isolated Sub-Agent)** | Complete Verification Pyramid green, **`npm run gate:qa` exit code 0**, and **blind diff audit executed in an isolated clean-context sub-agent (`invoke_subagent`)**. Neither prose nor the coding thread may self-certify. |
| T3 | `review` → `doing` | QA Auditor (Isolated Sub-Agent) | Rejected, with actionable findings (`file:line`) recorded in the QA Matrix. |
| T4 | `ready` → `done` | Release Management | Package deployed to production. |
| T5 | `doing` → `draft` | PO | Sprint timebox expired, or explicitly deprioritized. |
| T_block | `draft` → `blocked` | PO / Dev | External impediment identified. Mandatory `blocked_reason`. |
| T_block | `doing` → `blocked` | PO / Dev | External impediment identified. Mandatory `blocked_reason`. |
| T_unblock | `blocked` → `doing` / `draft` | PO / Dev | Impediment resolved **or** all `dependencies:` reached `done` or were **explicitly unlinked from the array**. A dependency missing on disk is not unlinked: it remains declared. Verified with `node scripts/gate-qa.mjs unblock <id>`. |
| T_dismiss | `ideas` / `draft` / `doing` → `dismissed` | PO / Release Management | Mandatory `dismissed_reason`. Allowed only from `ideas`, `draft`, or `doing`: **never from `ready`**, because a certified item is delivered or reverted to `doing`, never dismissed. |
| T_revive | `dismissed` → `draft` | PO | Dismissal was made in error, or premise evolved. Returns to the pool **retaining its prior refinement**, consistent with any return to the pool. |

---

## 4. Invariants

1. **Production ⊆ `done`.** No item can exist in production without being in `done`. Violating this is a process incident, not a bookkeeping detail.
2. **Developers Never Self-Certify (Mandatory Context Isolation).** Transition T2 (`review` → `ready`) is exclusive to the QA Auditor running in an **isolated clean-context sub-agent (`invoke_subagent`)**. The thread or sub-agent that implemented the code never promotes its own item to `ready`.
3. **`ready` is immutable.** Once certified, code is not modified without returning to `doing`. A post-QA fix **invalidates certification**: the item returns to `doing` and must traverse full T1/T2 cycles again.
4. **T4 requires an actual deployment.** Marking `done` without deploying is a state lie.
5. **Sprints and retrospectives never close by deduction.** Both require explicit, textual commands from the Product Owner.
6. **Refinement is never lost.** An item returning to the backlog pool retains its refinement record; it is not re-refined from scratch.
7. **`ready` is earned via Double Gate (Mechanical Runner + Blind Sub-Agent).** Transition T2 requires exit code 0 from `npm run gate:qa` **plus** an independent review of the `git diff` against acceptance criteria in a clean QA sub-agent without developer bias. An agent simulating QA in the coding thread violates this invariant, regardless of intent.
8. **Dependencies are never assumed.** An item cannot enter `doing` or certify into `ready` while any task in its `dependencies:` array is not in `done`. Unlinking a dependency requires an explicit modification of the array, never a silent omission.
9. **Pre-Flight Concurrency Probe & Dynamic Claiming:** No agent starts code changes or creates branches without first running the synchronous concurrency probe (`status: doing` in backlog and `git status`). Upon claiming a task, it atomically stamps `claimed_by: "<provider>:<session_or_agent_id>"` (e.g., `antigravity:<id>`, `cursor:<id>`, `claude-code:<id>`, `human:<id>`) in the frontmatter. If an item in `doing` is claimed by another actor, **it is strictly prohibited to execute `git restore .`, `git checkout .`, or `git clean` on the shared working tree**. Coordination across peer agents proceeds autonomously: if sharing a harness (e.g., `antigravity:` to `antigravity:`), communicate via `send_message`; if across heterogeneous providers (`cursor:`, `claude-code:`, `human:`), recognize the messaging boundary, respect the active lease without attempting failing RPC calls, and self-isolate mechanically via `git worktree`.

---

## 5. Decoupled Release Management

- Sprints and releases have **no 1:1 coupling**.
- A release is assembled by grouping items in `ready`, whether from the active sprint or historical backlog.
- Grouping criteria is **delivered value**, not arbitrary calendar dates.
- The release `CHANGELOG` lists all included items by their canonical backlog ID.

---

## 6. Sprint Specification Representation

The `Status:` field in `docs/sprints/SPRINT-XXX.md` or task frontmatter uses **exactly** one of these lowercase canonical values:

```
ideas | draft | blocked | doing | review | ready | done | dismissed
```

Tasks in `blocked` or `dismissed` declare their reason in the YAML frontmatter:

```markdown
---
id: TASK-ID
status: blocked
blocked_reason: "Blocked: upstream service does not yet expose an idempotent retry contract"
---

---
id: TASK-ID
status: dismissed
dismissed_reason: "Dismissed: premise was invalid; module is deprecated in architecture"
---
```

And record the transition in task notes when applicable:

```markdown
- **Status:** `review`
- **Last transition:** `review` → `ready` by QA Auditor (2026-10-04)
```
