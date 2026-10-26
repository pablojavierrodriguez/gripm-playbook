# Git Workflow & Commit Governance

Strict rules governing Git operations to prevent unintentional code loss or vague commit histories.

---

## Explicit Verbal Authorization Required

> [!CAUTION]
> **NEVER execute git commits or pushes without explicit, verbal permission from the user for EACH action.**

- **Never Infer Permissions:** Previous approval of a commit or push NEVER grants tacit approval for subsequent actions.
- **Task Words Are NOT Commit Permission:** Words like *"looks good"*, *"ok"*, *"proceed"*, *"go ahead"*, or *"done"* mean **implement or edit the code only**, NEVER run `git commit` or `git push`.
- **Explicit Keyword Rule:** Every commit and every push requires an individual message containing the explicit word *"commit"* or *"push"*.

---

## Descriptive and Structured Commit Messages

- **Mandatory English Rule:** All commit messages, branch names (`feat/...`, `fix/...`, `refactor/...`, `chore/...`), git tags (`vX.Y.Z`), and Pull Request titles/descriptions **must be 100% in imperative English** following Conventional Commits.
- **Agent Translation Duty:** Even if the backlog task, ticket title, or conversation with the user is in Spanish (e.g. `[PLAY-047] Regla de git commits en ingles`), the agent has the methodological obligation to translate the commit header and body to English when committing (e.g. `feat(git-workflow): enforce english commits and commit-msg hook`). Never write commit messages in Spanish (e.g. `feat: agrega regla...` or `fix: corrige error...`).
- **No Generic Messages:** Vague commits (e.g., *"fix bugs"*, *"update files"*, *"wip"*) are strictly forbidden.
- **Structured Commit Anatomy:**
  - **Header:** Meaningful title following Conventional Commits (`feat(...)`, `fix(...)`, `refactor(...)`, `docs(...)`, `test(...)`, `chore(...)`).
  - **Body:** When a commit touches multiple areas, include a structured bulleted summary detailing the exact scope of changes so anyone outside the team understands what was changed and why.
- **Mechanical Hook Enforcement:** Playbook provides `scripts/validate-commit-msg.mjs` (invocable via `playbook commit-msg <file>`) to mechanically reject non-conventional formats or Spanish terms in the header before git completes the commit.

---

## Multi-Agent Parallelism via git worktree

> [!CAUTION]
> **Never run `git checkout` in a shared repository while another agent is working.** The working tree and `.git/HEAD` represent shared filesystem state, not per-session isolation. A `checkout` run by one agent silently switches the other agent's branch **while it is actively writing**.

The two failure modes this causes:

1. **Commits on the wrong branch.** Agent A runs `git commit` after Agent B switched branches, landing A's changes on top of B's work.
2. **Unstaged changes blocking or corrupting the other agent's checkout.**

### Rule & Discovery Protocol (Pre-Flight Concurrency Probe)

Before running any Git command or modifying files:
1. **Synchronous Probe:** The agent inspects the backlog (`status: doing`) and runs `git status --porcelain`. If it detects an item in `doing` with a `claimed_by` different from its own namespaced identity (`<provider>:<id>`), or uncommitted changes (`A `, `M `) in `git status --porcelain` not authored by the active session, it **dynamically discovers an active peer or foreign in-flight state**.
2. **Shared Tree Safeguard:** Prohibited to run `git checkout .`, `git restore .`, or `git clean`. The agent assumes uncommitted changes belong to its peer.
3. **Autonomous Handshake & Cross-Harness Protocol:**
   - **Intra-Harness (same runtime, e.g., `antigravity:`):** Issues a `send_message` to the `claimed_by` recipient of the active task to coordinate priorities.
   - **Cross-Harness (different provider, e.g., `cursor:`, `claude-code:`, `human:`):** Respects the lease without attempting unviable RPC calls, notifies the user in chat, and proceeds directly to worktree isolation.
4. **Worktree Isolation:** When two or more agents operate simultaneously on the same repository, or foreign uncommitted changes are present in the working tree, **each agent or parallel task operates in its own worktree**. Never struggle with a dirty shared index: isolate via worktree. No agent changes branches in the primary working tree.

### Recipe

```bash
# create isolated worktree and its branch in a single command
git worktree add -b <branch> ../<repo>-<task>

# navigate into worktree
cd ../<repo>-<task>
# ... complete task with its own branch and isolated working tree ...

# consolidate changes BEFORE removing the worktree
# (executed from main worktree, with integration in flight)
git fetch . <branch>:dev          # integrates into dev without branch switching
git worktree remove ../<repo>-<task>
```

> [!CAUTION]
> **`-b` is not optional.** `git worktree add ../<repo>-<task> <branch>` fails with `fatal: invalid reference` if the branch does not already exist, and creating it requires `git checkout -b` in the primary working tree - the exact operation this rule forbids. The isolation recipe cannot be followed without violating the rule it serves.
>
> Consolidation uses `git fetch . <branch>:dev` **precisely to avoid `git checkout`**: running `git checkout dev && git merge <branch>` contradicts the prohibition against switching branches in the primary working tree.

Audit & cleanup:

```bash
git worktree list                 # inspect active worktrees
git worktree prune                # clean references to manually deleted worktrees
```

### Coexistence Rules

- **One branch per worktree.** Git does not permit two worktrees to share the same branch: this is a core design constraint, not a preference.
- **The primary worktree stays on `dev` during development.** It serves as the active integration trunk. Feature branches and parallel interventions isolate in worktrees. The single controlled exception to this rule is the formal Release Deployment Protocol below.
- **`git worktree remove` does not delete uncommitted changes.** If an agent terminates without consolidating, manually remove the worktree only after verifying no uncommitted work is lost.
- **Parallel sub-agents:** if multiple sub-agents touch overlapping files, each operates in its own worktree. Working tree isolation **does not** isolate conflicting lines: two agents editing the same file will still conflict upon merge. See `.agents/TEAM_PLAYBOOK.md`.

---

## Release Deployment Protocol & Anti-Dev-Production Invariant

> [!CAUTION]
> **Anti-Dev-Production-Deploy Invariant:** Prohibited to execute production deployment commands (`vercel --prod`, cloud release CLIs, or production publish commands) from the `dev` branch. Production releases must originate physically and mechanically from the canonical trunk `main`. Marking `ready` ➔ `done` on items deployed from `dev` constitutes an infrastructure state lie.

### Canonical Release Deployment Flow

When all items for a release are verified and certified in `ready`:
1. **Verification on `dev`:** Ensure `npm test` and `npm run validate` pass with 0 errors on `dev`.
2. **Promote certified items to `done`:** Update task files from `ready` to `done` on disk and regenerate `BACKLOG.md`.
3. **Commit release on `dev`:** Create the release commit (`chore(release): vX.Y.Z`).
4. **Fast-forward merge into `main`:**
   ```bash
   git checkout main
   git merge dev --ff-only
   ```
5. **Execute production deploy from `main`:**
   - **For Automated CI/CD Pipelines (e.g. GitHub Actions `ci.yml`):**
     Push directly to trunk `main`. Automated CI takes over: runs test matrix, publishes to registry with provenance, and atomically generates the annotated tag and GitHub Release upon success.
     ```bash
     git push origin main
     ```
     > [!CAUTION]
     > **Anti-Premature-Tagging Rule:** In automated CI release pipelines, manual tag creation (`git tag vX.Y.Z`) or manual GitHub Release creation is strictly prohibited. Tagging before CI completes induces race conditions, triggers redundant workflows, and exposes unverified releases on GitHub when tests fail.
   - **For Manual / CLI-Driven Pipelines (e.g. `vercel --prod` without publish bot):**
     Execute deploy from `main`, then tag and push:
     ```bash
     vercel --prod
     git tag -a vX.Y.Z -m "Release vX.Y.Z"
     git push origin vX.Y.Z
     ```
6. **Return primary worktree to `dev`:**
   ```bash
   git checkout dev
   ```

---

## Consolidated Task Commits & Clean Releases

- **Consolidated Cadence:** 1 verified task in `ready` = 1 clean, atomic commit including the code and its associated task specification file (e.g. `[TASK-ID] - slug.md` or issue link). Do not create noisy micro-commits during scratch work or exploration.
- **Pre-Commit Enforcement:** Ensure pre-commit verification hooks pass cleanly (typecheck, tests, backlog sync) before completing commits.
- **No Stealth Commits:** Never chain hidden or stealth commits. Maintain explicit task ID in commit title (`feat([TASK-ID]): ...` or `fix([TASK-ID]): ...`).
