# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [2.6.0] - 2026-10-21

`PLAY-026` · `PLAY-027` · `PLAY-028` · `PLAY-029` · `PLAY-030` · `PLAY-031` · `PLAY-032` · `PLAY-034`

### Added

- **Zero-Friction Onboarding CLI and Multi-Harness Adapters** (`PLAY-030`). New `scripts/init.mjs` wizard, exposed as `npx @gripm/playbook init`, `npm run init`, and the `sync-playbook.mjs init` subcommand. Detects the consumer stack from `package.json`, parametrizes `AGENTS.md` (project name, stack, language) only while it is still the base template, and generates thin harness adapters that point back to `AGENTS.md` as the canonical source: `.cursor/rules/*.mdc` for Cursor and `CLAUDE.md` for Claude Code. A hand-edited `AGENTS.md` is preserved even under `--force`. Writes the Gripm Board `.gripm/config.json` unless `--no-board`. New shared prompt helpers in `scripts/lib/terminal.mjs` (`promptText`, `promptConfirm`, `promptSelect`, `promptMultiSelect`) fall back to defaults without a TTY, so the wizard never blocks CI.
- **Anti-Self-Certification Gate and Actor Resolution** (`PLAY-028`). `scripts/gate-qa.mjs` now resolves the acting identity hierarchically (`--by`/`--as` flags, `GRIPM_ACTOR`/`QA_ACTOR`/`CLAIMED_BY` env vars, harness session vars, `human:<user>` fallback) and refuses to promote `review` -> `ready` when that actor matches the task's registered `claimed_by`, emitting an `anti-self-certification` diagnostic and preserving `review` on disk.
- **UX Signatures UX-014 and UX-015** (`PLAY-027`). The canonical rule catalog grows from 13 to 15 static UX signatures: `UX-014` flags em-dash and en-dash characters in JSX text nodes and UI/metadata attributes, enforcing the standard hyphen rule; `UX-015` flags viewport configurations that lock out pinch-to-zoom (`maximum-scale=1`, `user-scalable=no`, `user-scalable=0`, `userScalable: false`), violating WCAG 1.4.4.
- **Delivery Loop Diagram in README** (`PLAY-031`). ASCII diagrama estático en el primer fold que muestra el ciclo de vida de un backlog item desde `draft` hasta `done`, destacando el gate ciego de QA como paso crítico entre `review` y `ready`. No depende de herramienta externa (vhs/ffmpeg/gif no disponibles en la máquina), solo diagramado ASCII. Acompaña al diagrama de arquitectura "Hub Orchestrator + Sub-Agentes" y precede a la matriz de decisiones operativas.
- **QA Ciega y Anti-Self-Certification** (`PLAY-034`). `gate-qa.mjs` certifica items en `ready` mediante QA en contexto aislado por sub-agente, con invariante state-machine L77 (`ready` inmutable; fix post-QA invalida certificación y regresa a `doing`). 10 ACs validadas, hallazgos reportados en AC#10 (`npm run validate`, `lint:anti-slop`, `gate:review`, `check:all` decisiones pendientes del PO). Sustitución de 16 scripts `gate:qa` y `audit:ux` baseline por forma `node scripts/...`.

### Changed

- **Modular Refactor of Core Scripts Under the 500 LOC Ceiling** (`PLAY-026`). `gate-qa.mjs`, `sync-playbook.mjs` and `validate-repo.mjs` were decomposed into high-cohesion submodules under `scripts/lib/` (`frontmatter.mjs`, `terminal.mjs`, `pyramid.mjs`, `task-inspection.mjs`, `provenance.mjs`, `sync-classifier.mjs`, `catalog-validator.mjs`, `doc-checks.mjs`), keeping 100% backward compatibility in the CLI and programmatic API. Runtime submodules required by `gate-qa.mjs` are registered in `.playbook-manifest.json` and `FALLBACK_CORE_FILES` so consumer installs receive a working dependency closure.
- **Editorial Refactoring and Technical English Standardization** (`PLAY-029`). Core governance documents, skills and templates were standardized to technical English. Skills renamed: `worldclass-product-designer` -> `product-designer`, `rigorous-qa-auditor` -> `qa-auditor`; consumers re-syncing will see the new directories, and the old ones are reported as orphans rather than deleted. `validate-repo.mjs` now accepts both the English pyramid labels and the legacy Spanish wording.
- **Board Mention in the README** (`PLAY-032`). A single optional-companion tip pointing to `gripm` as a visual board over the same `backlog/tasks/*.md` files; the README stays focused on the playbook itself.

---

## [2.5.0] - 2026-10-17

`PLAY-008` · `PLAY-009` · `PLAY-024` · `PLAY-025`

### Added

- **Architecture-First & Strict Modularity Governance (`< 1000 LOC`)** (`PLAY-024`). Stack and domain agnostic architectural rules across `AGENTS.md`, `.agents/TEAM_PLAYBOOK.md`, `principal-engineer`, `pm-orchestrator`, `rigorous-qa-auditor`, and `docs/sprints/SPRINT_SPEC_TEMPLATE.md`. Requires defining module boundaries and contracts before implementation when a subsystem lacks architecture, enforces strict layer separation (anti-God-File), and establishes a 1000-line ceiling per source file (healthy range: 150 - 500 LOC) while respecting PO sovereignty over technical debt vs. urgent delivery.
- **Mechanical File Line Budget Tool (`scripts/check-loc.mjs`)** (`PLAY-025`). Zero-dependency CLI and programmatic API (`checkLoc`, `parseArgs`) synced to consumer repositories via `.playbook-manifest.json`. Scans source directories (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.vue`, `.svelte`, `.py`, `.go`, `.rs`, `.rb`, `.java`, `.kt`, `.cs`, `.php`, `.swift`), respects `.gitignore` and `.locignore`, and warns at `>= 500 LOC` and `> 1000 LOC`. Runs in **advisory mode by default (`exit 0`)** to give visibility of technical debt without blocking urgent value releases, reminding the team to track and prioritize refactoring in `backlog/tasks/` under PO sovereignty. Supports opt-in `--strict` (`exit 1`), `--max <N>`, `--warn <N>`, and `--format json`.
- **Canonical Package `exports` Map & Local Rule Catalog Validation** (`PLAY-008`). Added `"exports"` map to `package.json` (`"."`, `"./audit"`, `"./gate"`, `"./check-loc"`, `"./package.json"`, `"./scripts/*"`) so consumers can import `@gripm/playbook/audit`, `@gripm/playbook/gate`, and `@gripm/playbook/check-loc` via stable subpaths. Extended `scripts/validate-repo.mjs` (`checkLocalCatalog`) to validate local UX catalogs declared in `.uxaudit.json` against schema defects and canonical rule ID collisions, naming the collided canonical rule's title in `scripts/audit-ux-code.cjs`.
- **Canonical vs. Local Finding Separation & Partial Baseline Regeneration** (`PLAY-009`). Every finding in `scripts/audit-ux-code.cjs` now declares `origin: "canonical" | "local"` in JSON output, human output (`[canonical]` / `[local]`), and summary breakdowns (`summary.canonical`, `summary.local`). Added `--canonical-only` to scope `--strict` exit code evaluation exclusively to canonical playbook rules, and `--only canonical|local` (alongside `--rule <ID>`) to `--update-baseline` so partial baseline snapshots preserve existing review entries for rules outside the regenerated subset.

---

## [2.4.0] - 2026-10-17

`PLAY-019` · `PLAY-020` · `PLAY-021` · `PLAY-022` · `PLAY-023`

### Added

- **Autonomous Inter-Agent Coordination Protocol (IACP) & Dynamic Peer Discovery** (`PLAY-023`). Eliminates concurrent agent collisions on shared working trees. Task items in `backlog/tasks/` serve as the single source of truth for active claims via namespaced URI `claimed_by: "<provider>:<session_or_agent_id>"` (e.g. `antigravity:<id>`, `cursor:<id>`, `claude-code:<id>`, `human:<id>`) at transition T0 (`draft` ➔ `doing`). Newly invoked agents execute a synchronous Pre-Flight Concurrency Probe inspecting active `doing` items and git status, prohibiting destructive commands (`git restore .`, `git checkout .`, `git clean`) on dirty working trees. Intra-harness peers communicate directly via `send_message(Recipient: claimed_by)`, while cross-harness peers respect leases without futile RPCs and automatically isolate concurrent work in individual `git worktree` instances without human intermediary.
- **Subagent-Driven Development (SDD) with atomic TDD** (`PLAY-019`). Countermeasure against context fatigue in complex implementations. Decomposes tasks into hyper-atomic, self-contained steps executed by fresh subagents in isolated workspaces, sequentially supervised and verified before consolidation.
- **Packaging single source of truth** (`PLAY-020`). Mechanical consistency checks in `validate-repo.mjs` ensuring `.playbook-manifest.json` and fallback lists remain in strict parity with automated test coverage.

### Changed

- **100% stack and domain agnostic core** (`PLAY-021`). Eradicated financial and banking domain terminology (balances, liabilities, equity, payment APIs) from invariant definitions and contracts, replacing them with universal software engineering principles (capacity limits, rate limiting, unit normalization). Fixed task prefixes (`DEV-XXX`) replaced by canonical placeholders (`TASK-ID`).
- **Standard hyphen rule (Anti-Em-Dash)** (`PLAY-022`). Replaced artificial AI em-dashes (`—`) and en-dashes (`–`) with standard hyphens (` - `) across all documentation, templates, and specifications.

---

## [2.3.0] - 2026-10-12

`PLAY-010` · `PLAY-012` · `PLAY-013` · `PLAY-014` · `PLAY-015` · `PLAY-016` · `PLAY-017` · `PLAY-018`

### Added

- **An executable QA gate, so certification stops being a matter of prose.** A single agent asked to "act as the QA Auditor" can perform the role in the same turn that it writes the code: tick the acceptance criteria by inertia and promote the item to `ready` without running anything. `scripts/gate-qa.mjs` (`npm run gate:qa <PLAY-NNN>`) inspects the item on disk and runs the Verification Pyramid. **Exit code 0 is what satisfies the `review` → `ready` transition.** A step that cannot execute is reported `SKIPPED` and never counted as a pass; a pyramid where *nothing* ran fails the gate.
- **`gate:unblock`**, the executable T_unblock guard (`blocked` → `doing`/`draft`), so the rule has an entry point of its own instead of annotating a list that already failed.
- **`npm run gate:review`** and a CI step that runs it: every item in `review` must satisfy the gate on every push. A gate that only runs by hand is a gate that gets skipped.
- **`blocked` status with a mandatory `blocked_reason`**, plus `T_block`/`T_unblock` and a dependency gate that refuses certification while any declared dependency is not `done`. A task that cannot proceed is registered as blocked instead of inflating WIP in `doing`.
- **Multi-agent parallelism via `git worktree`.** `.git/HEAD` and the working tree are shared filesystem state: a cross-checkout silently switches another agent's branch while it writes, and its next commit lands on the wrong one. Each concurrent agent works in its own worktree — with the caveat that a worktree isolates the working tree, *not* the content, so overlapping edits still collide at merge time.
- **Engineering discipline (Ponytail):** diff mínimo viable, mandatory reuse before creating a helper or installing a package, blast-radius mapping before editing, and an honest closing statement of what was not tested.
- **Anti-slop rules for code, UI and copy:** comment hygiene, no chained type assertions, no module-level mocking to make a test green, a Purpose Test for visual decisions, a catalogue of default AI design clichés, and a veracity rule for copy. Design and copy skills updated alongside the engineering skill.
- **A Grilling Session is now required at refinement gate R1**, plus an opt-in `docs/DOMAIN_TEMPLATE.md` glossary convention.
- **`validate-repo` now fails when the core layer documents a script the manifest does not install**, and when `FALLBACK_CORE_FILES` drifts from the manifest. Both were silent: the first let skills instruct consumers to run a command that was never synced into their repo.

### Fixed

- **A test that passes for the wrong reason is now defined as a defect** (`CONTRIBUTING.md`), with the procedure to verify it: revert the fix, run the suite, observe a failure. This repo shipped a broken capability in two consecutive releases because its regression fixture never exercised the code it claimed to test, and the guide says how that is checked now — including the case where reverting *half* a fix proves nothing.

### Changed

- **`gate-qa.mjs` and `docs/DOMAIN_TEMPLATE.md` are installed by the sync.** Without this the QA skills documented a command that no consumer had: an agent told to run `npm run gate:qa` in a repo where nothing installed it would report a pass for something that never ran.

---

## [2.2.2] — 2026-10-09

---

## [2.2.2] — 2026-10-09

### Added

- **Zero-network local sync (`--source` / `--from`) in `sync-playbook.mjs`.** The synchronizer now accepts a local playbook directory path via `--source <dir>` (or auto-detects if `--remote` points to a local directory), allowing offline testing and immediate synchronization between sibling repositories without hitting GitHub.

### Fixed

- **Smart orphan detection prevents false alarms on consumer repositories.** `findOrphanedFiles` now leverages `.playbook-lock.json` when available, only reporting files that were previously installed by the framework and removed from the active plan. Project-specific rules and application skills in `.agents/` are recognized and no longer misreported as orphaned framework files.

### Changed

- **State machine and Git governance harmonization.** Aligned `.agents/STATE_MACHINE.md` and `.agents/rules/git-workflow.md` with the canonical agile delivery lifecycle (`draft ➔ doing ➔ review ➔ ready ➔ done`) and consolidated single-task commit cadence.

---

## [2.2.1] — 2026-10-06

`DEV-188`

### Fixed

- **`unlessVisibleText` was inert for the most common button shape** (`DEV-188`). It counted only an element's *direct* text nodes and excluded nested elements, so `<button><Icon /><span>Guardar</span></button>` looked unlabelled and was reported. A control that shows "Guardar" to the user is not an unnamed control, and that markup is how labelled icon buttons are written in practice. Text rendered by descendants now counts, resolved bottom-up over the parse tree.

  This shipped broken in `2.1.0` alongside the capability. The regression suite was the reason it was not caught: its fixture only had the single-line `<span>` case, and that case never exercised the defect because `needsContent` filtered it first for an unrelated reason. `IconOnly.tsx` now carries all five labelled shapes — direct text, wrapped label, multiline icon+label, multiline wrapped label, and a labelled `div[role=button]` — plus the two unlabelled ones, and the assertion lists exactly which two lines may be reported.

- **A custom control was never covered** (`DEV-188`). `UX-010` matched `<button`, `<Button` and `motion.button`, so a `div[role=button]` or `span[role=button]` holding only an icon passed clean. ARIA buttons are a documented pattern and they were invisible to the rule. `role="button"` is now part of the signature.

---

## [2.2.0] — 2026-10-06

`PLAY-005`

### Added

- **The auditor exposes a programmatic API.** `audit-ux-code.cjs` exports `auditProject`, `loadCatalog`, `loadConfig`, `loadRules`, `buildUnits`, `lineMatches`, `hasVisibleText` and `fingerprint`, and the CLI is guarded by `require.main === module`. Importing the module no longer runs an audit. This exists because a project that needs its own signatures had exactly one option — fork the file — and a consumer's fork had grown to 779 lines of divergence.
- **`auditProject(options)`** returns `{ rulesVersion, srcDir, summary, findings, unreadable, absorbed }` and never prints or exits, so the consumer owns presentation. Options: `root`, `src`, `config`, `rules`, `useBaseline`.
- **Project-owned rule catalogs.** `.uxaudit.json` accepts a `rules` path; its rules run alongside the canonical ones and the canonical catalog stays untouched by the sync.
- **`onlyFile`**, the positive counterpart of `unlessFile`. A rule scoped by context — "`truncate` inside a dialog" — was not declarable before, because a file filter could only ever switch a rule off.

### Changed

- **`UX-NNN` is reserved for the canonical catalog.** A local rule using that pattern is rejected with an error rather than merged. One id has to mean one thing across every consumer: a project reading its own `UX-009` as "touch target" while the skill documents something else is exactly how a catalog stops being trustworthy. Local rules pick their own prefix.
- `--list-rules` reads the project config first, so local signatures show up alongside the canonical ones, labelled by origin.

### Fixed

- **`useBaseline: false` reported nothing.** `diffAgainstBaseline` returns the observations the snapshot does *not* cover — the ones worth reporting — and disabling the baseline handed the filter an empty set, which discarded every finding.

---

## [2.1.0] — 2026-10-06

`PLAY-001` · `PLAY-002` · `PLAY-003` · `PLAY-004` · `DEV-184` · `DEV-187`

### Added

- **The auditor now understands JSX nesting** (`PLAY-001`). This is the root cause behind two long-standing false-positive sources. `buildUnits` counted `<` openings against `>` closings as characters, so a self-closing `<Icon />` ended its parent's unit and `<button>` was separated from its own contents. A rule asking "what does this element contain" got an empty string, and the only way to answer it was to search the entire file — which made one `const Icon = () => null` turn every button in the file into an icon-only button. Units now track real nesting depth and expose three granularities:
  - `text` — the opening tag and its attributes. Signatures match here, so a finding points at the element that carries the problem instead of its wrapper.
  - `ownContent` — the element's own content, excluding descendants. This is how a rule asks "is *this* element the one rendering the value?".
  - `scopeText` — the element plus every descendant. This is how a rule asks "does this element contain that?".
- **`exclude` is implemented in the UX auditor** (`DEV-184`). The property was documented in the README but silently ignored by the runner. It resolves through a dependency-free glob supporting `**`, `*` and `?`. Each pattern matches both literally and at any depth, so `src/legacy/**` and `**/src/legacy/**` are equivalent. Excluded files are dropped before auditing.
- **Accepted-observation baseline** (`PLAY-003`). `audit-ux-baseline.json` records the observations a project has already reviewed, so the auditor can be adopted on a codebase that already carries hundreds of findings without either silencing the gate or producing a report nobody reads. `--update-baseline` rewrites the snapshot. **`ERROR` is never absorbed** — a severity that breaks the build cannot be switched off by a file. Occurrences are counted with multiplicity, so a fifth instance of something already accepted four times is reported.
- **`unlessVisibleText`** (`PLAY-002`). A new engine capability that asks whether an element renders visible text. No token list can express it: `<button><span>Guardar</span></button>` is accessible without a single `aria-*` attribute. The text is derived from parse offsets rather than stripped from the raw source, because `/<[^>]*>/g` cannot tell a tag terminator from the `>` of an arrow function and would leave `go()}` behind on `<button onClick={() => go()}>` — making an icon-only button look like it had a label.

### Fixed

- **One occurrence per file is gone** (`PLAY-002`). The engine carried `break; // one finding per rule per file keeps the report actionable`, which capped the report at one observation per rule per file. A consumer measured 49 reported findings against 487 actual — 90% of the signal hidden. It was also the reason the false positives went unnoticed: with the `break` in place, the minimal reproduction reported one false positive instead of two, because the scan stopped before the second case. The baseline replaces it as the noise-management mechanism.
- **`UX-010` no longer reports buttons that show a visible label** (`PLAY-002`). Its escapes were all attribute-based (`aria-label`, `title=`, `aria-labelledby`, `sr-only`), so a button whose child is visible text was still reported.
- **Parser robustness** (`PLAY-001`). Fragments (`<>`), unbalanced markup, self-closing roots, comparisons and generics inside attributes, and arrow functions in event handlers are all handled without crashing, hanging, or mis-attributing a signature. An unclosed element is closed at the nearest closing tag instead of swallowing the rest of the file.
- **`UX-006` rewritten from `needsContent` to `nearby`** (`PLAY-001`). The rule pairs a padded scroll container with a fixed bottom bar, which are two different elements; it only ever worked because `needsContent` was file-scoped.
- **`UX-004` and `UX-013` now declare `alsoContent`** (`PLAY-001`), so a finding points at the element rendering the value rather than at its wrapper.
- **Multi-line JSX was split at the wrong boundary** (`DEV-184`). `buildUnits` counted every `>` as a tag terminator, including the one in an arrow function (`=>`), which closed the logical unit early and pushed the escape hatch into the next unit where the rule could not see it.
- **Transition references pointed at transitions that do not exist** (`DEV-184`). `SPRINT_SPEC_TEMPLATE.md` and `TEAM_PLAYBOOK.md` referenced a `T6` and mislabelled `T1`–`T4`. Both are aligned with `STATE_MACHINE.md`, which is the source of truth.
- **This changelog had duplicate sections.** `[2.0.1]` declared `### Fixed` twice with the same bullet in both, and `[2.0.0]` appeared as two separate headings. Both are merged, and the `[Unreleased]` link no longer compares from `v2.0.0`.

### Changed

- **The backlog is a Backlog.md item pool, and GitHub Issues is only the intake channel** (`PLAY-001`..`PLAY-004`). `README.md` already instructed the PM Orchestrator to read backlog issues through GitHub MCP and `STATE_MACHINE.md` requires each release to cite backlog IDs, but no item pool existed — so unregistered work accumulated in this changelog instead. Items now live in `backlog/tasks/` in the same Backlog.md format `gripm` and `dev-board` use, with the `PLAY-` prefix. **The changelog records releases, never open work.**

### Removed

- **The `agentic-team-playbook` bin** (`PLAY-004`), a leftover from the rename that `DEV-179` performed everywhere else. **Breaking.** Anyone invoking the old binary name must switch to `npx @gripm/playbook sync` or the `playbook` / `gripm-playbook` binaries.

---

## [2.0.1] — 2026-10-05

### Added

- **Canonicity detection.** When there is no lockfile baseline, the sync now asks the upstream commit history whether a local file matches any published revision of that path. A file that turns out to be an older canonical revision is moved forward instead of being reported as a conflict, so the first sync after a hand install no longer flags every untouched file. Requests are bounded per run and both failure modes fail safe: an unreachable history protects the file rather than overwriting it.
- **`--adopt`** keeps every differing file, records it as the baseline, and touches nothing. `--no-history` skips the provenance lookup.
- **Orphan detection.** Framework files present under `.agents/` that are no longer part of the install plan — the usual symptom of a version that moved them — are reported. Nothing is deleted.
- **Tests for the sync layer**: the canonicity decision table, the provenance resolver against a stubbed GitHub, and orphan detection.

### Fixed

- **Saneamiento P0 de skills de stacks**: Eliminadas todas las referencias residuales a componentes y entidades de prueba (`People.tsx`, `SettingsPage.tsx`, `MeetingDetailModal`, `PermissionGate`, `SPEC-070`, `vibrant-gradient-primary`, `font-mono-data`, `Check-in QR`, `OrgContext`) en los skills de `react` y `mobile`.
- **Formato regional estándar**: Reemplazado el valor inválido `'regional-locale'` por formato regional BCP-47 (`es-ES`) en `recharts-reporting` y `forms-rhf-zod`.
- **A local customisation was protected exactly once.** The lockfile recorded the local hash of a protected file, so on the next run the file matched its own baseline and was overwritten without warning. Customizations are now recorded in a dedicated `customizations` list and stay protected until `--force`.

## [2.0.0] — 2026-10-04

### Added

- **`.agents/STATE_MACHINE.md`** — single source of truth for delivery statuses and transitions, with actors and guards.
  - Exactly four statuses: `doing`, `review`, `ready`, `done`.
  - The backlog is modelled as the *absence* of a status, not as one.
  - Refinement is documented as **gate R1**, an entry condition, not a state.
- **`docs/BACKLOG.md`** — item pool with a `Refined` flag and an item template.
- **`scripts/ux-rules.json`** — declarative rule catalog. Detection knowledge now lives in one place instead of inside the runner.
- **`scripts/validate-repo.mjs`** — consistency guardian: manifest ⇄ disk, rule catalog ⇄ skill documentation, core purity, relative links, skill frontmatter, status vocabulary.
- **`tests/`** — 13 tests over the rule engine, with positive and negative fixtures.
- **Stack packs** — optional `.agents/stacks/{react,mobile,pwa}`, installed on demand with `--stack <name>`.
- **`.playbook-manifest.json`** — declarative install manifest, so adding a file no longer requires a script change.
- **CI workflow** — runs `validate` + `test` on Node 20 and 22.
- **Issue and PR templates.**
- **`--list-rules`, `--format json`, `--rule <id>`, `--src`, `--config` and `--quiet` flags** for the UX auditor.

### Changed

- **`audit-ux-code.cjs` is now a generic engine.** Removed every hardcoded project reference (`YourApp`, `TransactionList.tsx`, `AccountManager.tsx`, `formatAmount`, `ReportsPage.tsx`, `Landing.tsx`).
- **Stack awareness by dependency.** Rules that need `date-fns` or `framer-motion` declare `requires.deps` and skip themselves when the library is absent.
- **`sync-playbook.mjs` is non-destructive.** Local modifications are detected through `.playbook-lock.json` and reported as `[Protected]` instead of being silently overwritten.
- **Sync pins a git ref** (latest release tag) instead of tracking a moving branch.
- **Sync retries with backoff and timeout**, and backs up overwritten files under `.playbook-backups/`.
- **Sprint spec template** rewritten to the canonical vocabulary, with an acceptance-criteria table, the refinement gate, and the previously missing **Release Management** section.
- **Core skills neutralised.** Removed all references to a specific product, backend and financial domain from `pm-orchestrator`, `principal-engineer`, `rigorous-qa-auditor`, `market-researcher` and `worldclass-product-designer`.

### Fixed

- The README claimed the sync preserved local files; it now states exactly what is preserved.
- `audit-ux-code.cjs` crashed with `ENOENT: scandir '.../src'` on any project without a JavaScript source directory. It now reports and exits 0.
- The auditor excluded `src/components/ui/`, which silenced most findings in shadcn/Radix projects.
- The `errors.length > 0` exit branch was unreachable: no rule ever emitted `ERROR`. `UX-001` and `UX-005` now do.
- **Signature drift.** `UX-006`, `UX-007` and `UX-008` meant different things in the skill documentation than in the script. The catalog is now canonical, IDs are frozen, and `validate-repo` fails on drift.
- `UX-006` (fixed bottom UI occlusion) and `UX-008` (micro-Jank) were documented but **had no implementation at all**. Both are now detected.
- **Multi-line JSX produced false positives.** An escape hatch such as `inputMode="decimal"` on the line below `type="number"` was invisible to line-based matching. The engine now groups lines into logical JSX units.
- The template's QA section demanded browser sub-agents, directly contradicting the anti-browser rule in `AGENTS.md`.
- Broken relative link `file:///.agents/TEAM_PLAYBOOK.md` in `AGENTS.md`.
- A dangling link to `SPEC-076-dashboard-improvements.md` in the `recharts-reporting` skill.
- `npm run check:all` was mandated by `pm-orchestrator` but did not exist.

### Removed

- Duplicated git policy between `AGENTS.md` and `.agents/rules/git-workflow.md`. `AGENTS.md` now links to the rule file; the duplicate is gone.
- The README claimed the sync preserved local files; it only ever preserved `AGENTS.md`.

### Packaging

- Configured for npm publication under `@gripm/playbook` supporting `npx @gripm/playbook sync`.

[Unreleased]: https://github.com/pablojavierrodriguez/gripm-playbook/compare/v2.6.0...HEAD
[2.6.0]: https://github.com/pablojavierrodriguez/gripm-playbook/releases/tag/v2.6.0
[2.5.0]: https://github.com/pablojavierrodriguez/gripm-playbook/releases/tag/v2.5.0
[2.4.0]: https://github.com/pablojavierrodriguez/gripm-playbook/releases/tag/v2.4.0
[2.3.0]: https://github.com/pablojavierrodriguez/gripm-playbook/releases/tag/v2.3.0
[2.2.2]: https://github.com/pablojavierrodriguez/gripm-playbook/releases/tag/v2.2.2
[2.2.1]: https://github.com/pablojavierrodriguez/gripm-playbook/releases/tag/v2.2.1
[2.2.0]: https://github.com/pablojavierrodriguez/gripm-playbook/releases/tag/v2.2.0
[2.1.0]: https://github.com/pablojavierrodriguez/gripm-playbook/releases/tag/v2.1.0
[2.0.1]: https://github.com/pablojavierrodriguez/gripm-playbook/releases/tag/v2.0.1
[2.0.0]: https://github.com/pablojavierrodriguez/gripm-playbook/releases/tag/v2.0.0