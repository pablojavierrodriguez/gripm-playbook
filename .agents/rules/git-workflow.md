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

- **No Generic Messages:** Vague commits (e.g., *"fix bugs"*, *"update files"*, *"wip"*) are strictly forbidden.
- **Structured Commit Anatomy:**
  - **Header:** Meaningful title following Conventional Commits (`feat(...)`, `fix(...)`, `refactor(...)`, `docs(...)`).
  - **Body:** When a commit touches multiple areas, include a structured bulleted summary detailing the exact scope of changes so anyone outside the team understands what was changed and why.

---

## Multi-Agent Parallelism via git worktree

> [!CAUTION]
> **Nunca hacer `git checkout` en un repositorio compartido mientras otro agente trabaja.** El working tree y `.git/HEAD` son estado de sistema de archivos compartido, no por sesión. Un `checkout` de un agente cambia la rama del otro **en silencio, mientras escribe**.

Los dos fallos que produce:

1. **Commits en la rama equivocada.** El agente A corre `git commit` después de que B cambió de rama, y sus cambios quedan asentados sobre el trabajo de B.
2. **Cambios no stageados bloquean o corrompen el checkout del otro.**

### Regla

Cuando dos o más agentes operan en simultáneo sobre el mismo repositorio, **cada agente o tarea paralela trabaja en su propio worktree**. Ningún agente cambia de rama en el working tree principal.

### Receta

```bash
# crear el worktree aislado para la tarea
git worktree add ../<repo>-<task> <branch>

# trabajar ahí dentro
cd ../<repo>-<task>
# ... la tarea completa, con su propia rama y su propio working tree

# consolidar los cambios antes de retirar el worktree
git checkout dev && git merge <branch>

# limpiar al concluir
git worktree remove ../<repo>-<task>
```

Auditoría y limpieza:

```bash
git worktree list                 # qué worktrees están vivos
git worktree prune                # limpiar referencias de worktrees ya borrados a mano
```

### Reglas de convivencia

- **Una rama por worktree.** Git no permite que dos worktrees compartan el mismo branch: es una restricción del diseño, no una preferencia.
- **El worktree principal se queda en `dev`.** Es el punto de integración. Los agentes no hacen checkout ahí.
- **`git worktree remove` no borra cambios sin commitear.** Si el agente terminó sin consolidar, remové el worktree a mano solo si verificaste que no hay trabajo perdido.
- **Sub-agentes en paralelo:** si varios sub-agentes van a tocar archivos superpuestos, cada uno va en su worktree. El aislamiento de working tree **no** aísla líneas en conflicto: dos agentes que editan el mismo archivo se mergearán igual y entrarán en conflicto. Ver `.agents/TEAM_PLAYBOOK.md`.

---

## Consolidated Task Commits & Clean Releases

- **Consolidated Cadence:** 1 verified task in `ready` = 1 clean, atomic commit including the code and its associated `DEV-XXX` task markdown file. Do not create noisy micro-commits during scratch work or exploration.
- **Pre-Commit Enforcement:** Ensure pre-commit verification hooks pass cleanly (typecheck, tests, backlog sync) before completing commits.
- **No Stealth Commits:** Never chain hidden or stealth commits. Maintain explicit task ID in commit title (`feat(DEV-XXX): ...` or `fix(DEV-XXX): ...`).
