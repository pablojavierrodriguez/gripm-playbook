# Contributing

Thanks for taking the time to improve the Agentic Team Playbook.

## The rule that matters most

**This repository is held to its own Verification Pyramid.** Before opening a PR:

```bash
npm run check:all
```

That runs `npm run validate` and `npm test`. Both must pass.

## Architecture you need to know

The repo has two layers, and mixing them is the most common mistake:

| Layer | Location | Constraint |
| :--- | :--- | :--- |
| **Core** | `.agents/skills/`, `.agents/*.md`, `.agents/rules/` | Stack and product agnostic. No `YourApp`, no `admin-portal`, no prescribed backend. Enforced by `validate-repo`. |
| **Stack packs** | `.agents/stacks/<tech>/` | Vertical recipes for one technology. Installed on demand. |

If your change would make the core depend on a framework, it belongs in a stack pack instead.

## Where things live

| You want to… | Edit |
| :--- | :--- |
| Add or change a UX signature | `scripts/ux-rules.json` **and** `.agents/skills/code-level-ux-auditor/SKILL.md` |
| Certify an item (`review` → `ready`) | `npm run gate:qa <PLAY-NNN>` must exit 0 |
| Add a canonical file | `.playbook-manifest.json` |
| Change a status or transition | `.agents/STATE_MACHINE.md` only — never redefine statuses elsewhere |
| Change git governance | `.agents/rules/git-workflow.md` only — `AGENTS.md` links to it |
| Add a core skill | `.agents/skills/<name>/SKILL.md` |
| Add a vertical skill | `.agents/stacks/<tech>/skills/<name>/SKILL.md` |

## Invariants `validate-repo` enforces

1. Every file in the manifest exists on disk.
2. Every `UX-0NN` exists in the catalog **and** is documented in the skill with the same title and severity, and vice versa.
3. `UX-001`…`UX-008` keep their historical IDs. Never renumber. Append from `UX-009`.
4. The core contains no product or backend references.
5. Every relative Markdown link resolves.
6. Every `SKILL.md` has frontmatter whose `name` matches its folder.
7. Status vocabulary matches `STATE_MACHINE.md`, and the backlog is not modelled as a status.

Separately, `npm run gate:qa <PLAY-NNN>` is the executable gate for the `review` → `ready` transition. It enforces what the prose cannot: that the item is really in `review`, that every acceptance criterion is checked, that every declared dependency is `done`, and that the verification pyramid actually ran. A step that cannot run is reported `SKIPPED`, never assumed green.

## A test that passes for the wrong reason is a defect

`npm test` proves 46 cases are green. It does **not** prove those 46 cases would fail if the thing they claim to protect broke. Both are different claims, and only one of them gets tested by default.

> This rule exists because the defect reached production **twice**. `UX-010` shipped with a single labelled fixture — `<button><span>Guardar</span></button>`. It had no icon, so `needsContent Icon` filtered it out before `unlessVisibleText` ever evaluated. The test asserted the capability without ever exercising it. The conclusion "it works" was defensible for the case measured and false for the case that mattered.

### The rule

**Every regression case for a new capability must fail if the capability is reverted.** If you cannot write it that way, one of three things is true: the capability is not observable, the fixture does not reach the code path, or the test is testing something else.

### How to verify it

The check is concrete and takes two minutes:

1. Revert the fix (or break the capability in place).
2. Run `npm test`.
3. **Observe a failure.** No failure means the test does not cover the capability.
4. Re-apply the fix. Confirm green.

A test whose failure you cannot provoke is decoration. Treat "I can't make this one fail" as a finding about the test, not about the code.

### Writing the assertion

Prefer **counting what must be reported** over **asserting absences**:

```js
// Fragile: passes for unrelated reasons if the filter order changes.
assert.equal(findings.length, 0);

// Robust: fails unless the rule actually fires on the reportable cases.
assert.deepEqual(reportedLines, [12, 27, 41]);
```

Absence assertions are the mechanism behind this failure mode: they go green for any reason at all, including the wrong one.

## Adding a UX signature

1. Append the rule to `scripts/ux-rules.json` with `id`, `title`, `severity`, `signature`, `impact`, `fix`, `message` and a `check`.
2. Use `requires.deps` if the rule only makes sense when a library is present. Stack-agnostic rules omit it.
3. Document it in `.agents/skills/code-level-ux-auditor/SKILL.md` as `### N. [UX-0NN] · SEVERITY · Title`, with the title copied verbatim from the catalog.
4. Add a positive and a negative fixture under `tests/fixtures/`.
5. Add the id to the "every catalogued rule fires" coverage — the test fails if a catalogued rule has no fixture.
6. **Revert the fix and watch the new test fail.** This is not optional and not covered by `npm test`. See [A test that passes for the wrong reason is a defect](#a-test-that-passes-for-the-wrong-reason-is-a-defect).

## Adding a status or a transition

`.agents/TEAM_PLAYBOOK.md` and `docs/BACKLOG.md` reference the state table; they never redefine it. `validate-repo` fails if any of them drifts.

When you add a status, all three must move together:

1. The table in `.agents/STATE_MACHINE.md`.
2. The transitions table, with its guard.
3. The vocabulary line in `docs/BACKLOG.md`.
4. The invariants section, if the status carries one (e.g. `blocked` requires a non-empty `blocked_reason`).
5. `CANONICAL_STATUSES` in `scripts/validate-repo.mjs`.

## Commits

Do not commit on your behalf rules. The canonical git policy lives in `.agents/rules/git-workflow.md`: explicit verbal authorization is required for every commit and push.

Use Conventional Commits with a structured body when a change spans modules.

## Adding a stack pack

1. Create `.agents/stacks/<tech>/STACK.md` describing what it covers and what it assumes.
2. Put skills in `.agents/stacks/<tech>/skills/<name>/SKILL.md`.
3. Register the pack in `.playbook-manifest.json` under `stacks`.
4. Mirror the list in `FALLBACK_STACKS` in `scripts/sync-playbook.mjs`, which is used when the remote manifest cannot be fetched.
5. Document it in the README layer table.

## Reporting a bug

Include the install method, the target stack, the Node version, and the command that reproduces it. If the issue is an inconsistency inside the framework, run `npm run validate` first — it may already be reporting it.

## License

By contributing you agree that your contributions are licensed under the MIT License.