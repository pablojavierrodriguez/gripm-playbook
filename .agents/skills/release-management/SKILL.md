---
name: release-management
description: Release management protocol and delivery lead. Leads the formal 6-phase release lifecycle, SemVer 2.0 version calculation, user-facing release notes consolidation, git release flow, deploy hooks, and post-deploy backlog reconciliation (ready -> done).
---

# Release Management Skill

## Mission and Delivery Authority

Ensure that production releases deliver verified business value, adhere strictly to Semantic Versioning (SemVer 2.0), maintain total user-facing communication quality, and preserve state integrity across the repository.

> **Exclusive Authority for Transition T4 (`ready` ➔ `done`):** Development work for engineers and AI agents concludes formally upon certification into `ready`. Moving tasks from `ready` to `done` belongs **exclusively to Release Management** (Product Owner + Scrum / Delivery Lead) in conjunction with an actual production deployment. Marking an item `done` without an actual deployment is a state lie.

---

## Non-Negotiable Release Invariants

1. **Anti-State-Lie Invariant (Real Deploy Mandatory):** No task or backlog item enters `status: done` without a confirmed, successful production deployment. A build passing locally or in staging never justifies `done`.
2. **Production ⊆ `done` Invariant:** No feature, fix, or code artifact exists in production without its corresponding backlog item holding `status: done`.
3. **Prohibition of Version Bumping in Daily Tasks:** Version numbers in `package.json`, release manifests, or documentation are **never bumped during daily development tasks or feature commits**. Version calculation is strictly decoupled and executed exclusively during the formal release cycle (Phases 2 and 4).
4. **Decoupled Sprints and Releases:** Sprints and releases have **no 1:1 coupling**. Sprints are fixed timeboxes for continuous productivity; releases are packaged strictly by **delivered value**, grouping any certified items in `ready` (historical or current), with or without an active sprint.
5. **Anti-Dev-Production-Deploy Invariant:** Production deployments must originate physically and mechanically from the canonical trunk `main`, never from `dev` or feature branches.
6. **Anti-Em-Dash / Anti-AI Cliché Rule:** Never use unicode em-dash or en-dash in release titles, release notes, changelogs, UI copy, or documentation. Always use the standard hyphen with spaces (` - `).
7. **100% User-Facing Communication:** Public release notes describe user outcomes, improvements, and customer value. Internal tracking tokens (such as `DEV-XXX`, `PLAY-XXX`, `SPEC-XXX`) are prohibited from public headlines and release titles.
8. **Explicit Human Authorization for Git Operations:** Commits and pushes during the release workflow require explicit verbal confirmation from the user for each action.

---

## The Universal 6-Phase Release Protocol

```
[ Phase 0: Pre-Cut Audit ]
         │ (clean working tree, git log main..dev, diffstat)
         ▼
[ Phase 1: Quality Gate ]
         │ (full Verification Pyramid passing green on dev)
         ▼
[ Phase 2: SemVer 2.0 Calculation ]
         │ (Major, Minor, or Patch based on delivered value)
         ▼
[ Phase 3: User-Facing Notes Consolidation ]
         │ (Anti-Em-Dash, zero internal IDs, outcome-focused)
         ▼
[ Phase 4: Canonical Git Flow ]
         │ (dev ➔ version commit ➔ merge to main ➔ git tag ➔ dev)
         ▼
[ Phase 5: Project Deploy Hook ]
         │ (npm publish, cloud deploy, or container rollout)
         ▼
[ Phase 6: Post-Deploy Backlog Reconciliation ]
           (ready ➔ done with releasedAt: vX.Y.Z)
```

---

### Phase 0: Pre-Cut Audit (Branch & Tree Hygiene)

Before initiating a release cut, perform a comprehensive inspection of the git working tree and branch delta:

1. **Switch to Development Branch and Update:**
   ```bash
   git checkout dev
   git pull origin dev
   ```
2. **Verify Clean Working Tree:**
   ```bash
   git status --porcelain
   ```
   *Requirement:* The output must be completely empty. No unstaged edits, untracked files, or in-flight peer leases.
3. **Inspect Release Candidate Range:**
   ```bash
   git log main..dev --oneline
   git diff main..dev --stat
   ```
   *Requirement:* Review all commits and file diffs since the last release on `main`. Confirm that every change corresponds to a certified item in `status: ready`.

---

### Phase 1: Quality Gate (Verification Pyramid on `dev`)

A release cut is prohibited if any verification layer fails. Execute the Verification Pyramid in strict order on `dev`:

1. **Strict Typecheck & Consistency:**
   ```bash
   npm run validate
   # and/or npx tsc --noEmit (0 errors)
   ```
2. **Headless Unit and Integration Tests:**
   ```bash
   npm test
   # Must exit with code 0 across the entire test suite
   ```
3. **Spec & Backlog Consistency:**
   ```bash
   npm run check:all
   # Or project backlog check scripts (e.g. npm run backlog:check)
   ```
4. **File Budget & Modularity:**
   ```bash
   npx playbook check-loc
   # Confirm all files respect the 1000 LOC ceiling
   ```
5. **Static UX Audit:**
   ```bash
   npx playbook audit --strict
   # Confirm zero critical UX regressions, accessibility flaws, or em-dash violations
   ```
6. **Production Build:**
   ```bash
   npm run build
   # Bundle and build artifacts compile cleanly without warnings or errors
   ```

*Abort Condition:* If any step fails, the release process is immediately halted. Defective items must be identified and sent back to `doing` with actionable reports.

---

### Phase 2: Objective SemVer 2.0 Determination

Determine the target version `vX.Y.Z` by objectively assessing the highest change severity among the packaged `ready` items:

| Change Severity | SemVer Increment | Trigger Criteria |
| :--- | :--- | :--- |
| **Major** | `X.0.0` (bump `X`, reset `Y` & `Z` to 0) | Breaking API changes, backward-incompatible schema migrations, removed deprecated endpoints, or foundational architectural shifts. |
| **Minor** | `X.Y.0` (bump `Y`, reset `Z` to 0) | New features, backward-compatible enhancements, additive API capabilities, new UI views or major capabilities. |
| **Patch** | `X.Y.Z` (bump `Z`) | Bug fixes, security patches, performance optimizations, internal refactoring, copy edits, or documentation updates. |

*Rule:* Daily tasks never increment the version. Version calculation occurs exclusively here based on actual delivered capability.

---

### Phase 3: User-Facing Notes Consolidation

Consolidate release notes that speak to users, stakeholders, and consumers rather than internal engineering ticket trackers.

1. **Customer-Centric Value Summaries:**
   - Lead with the outcome: what can the user do now that they could not do before?
   - Focus on benefits, ergonomics, speed improvements, and reliability.
2. **Eradicate Internal Tracking IDs:**
   - Prohibited in public release titles: `v1.2.0 - Fix DEV-123 and PLAY-045`.
   - Required standard: `v1.2.0 - Offline Sync Resilience and Filter Navigation`.
   - Internal IDs belong exclusively to git commit trailers (`Refs: DEV-123`) or internal backlog mappings, never customer-facing release notes.
3. **Enforce the Anti-Em-Dash Rule:**
   - Validate that release titles, summary bullet points, and section dividers use the standard hyphen with spaces (` - `), never unicode em-dash or en-dash.
4. **Extraction Tools:**
   - When using Playbook extraction utilities, invoke:
     ```bash
     node scripts/extract-release-notes.mjs [version]
     ```
   - This writes normalized `release-title.txt` and `release-notes.txt` ready for GitHub Releases or distribution channels.

---

### Phase 4: Canonical Git Protocol (`dev` ➔ `main` ➔ `dev`)

Follow the strict, non-destructive release branch workflow:

1. **Stage Version Updates on `dev`:**
   - Update `package.json` (and `package-lock.json` if applicable) with the calculated version `X.Y.Z`.
   - Update release records (`CHANGELOG.md`, `backlog/releases.json`, or `docs/RELEASE_NOTES.md`).
2. **Request Explicit User Authorization:**
   - Ask the human PO for verbal confirmation to create the release commit and push tags.
3. **Create Release Commit on `dev`:**
   ```bash
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "chore(release): prepare vX.Y.Z"
   ```
4. **Switch to Main Trunk and Fast-Forward Merge:**
   ```bash
   git checkout main
   git pull origin main
   git merge --ff-only dev
   ```
5. **Tag the Release on `main`:**
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z - Release title"
   ```
6. **Push to Canonical Remote (with user confirmation):**
   ```bash
   git push origin main --tags
   ```
7. **Reconcile Development Branch:**
   ```bash
   git checkout dev
   git merge --ff-only main
   git push origin dev
   ```

---

### Phase 5: Invocation of Project Deploy Hook

Execute the project-specific production deployment command from the canonical `main` trunk:

```bash
# Example project deployment hooks (project-configured):
npm publish               # For published libraries or CLI tools
npm run deploy:prod       # For web hosting, SaaS platforms, or production instances
# Or automated CI/CD pipeline triggered by git push origin main --tags
```

> [!CAUTION]
> **Physical Verification of Deployment:** The release manager must verify that the deployment hook exited successfully and that production is healthy before proceeding to Phase 6. If the deploy fails or is aborted, the items remain in `ready` until the deployment succeeds.

---

### Phase 6: Post-Deploy Backlog Reconciliation

Once deployment to production is physically verified:

1. **Promote Backlog Items to `done`:**
   - Move all items packaged in this release from `status: ready` to `status: done`.
   - Record release metadata on each task: `releasedAt: "vX.Y.Z"` or release date.
2. **Synchronize Backlog Records:**
   ```bash
   npm run backlog:sync
   ```
3. **Verify State Invariant:**
   - Confirm that every item deployed to production is in `status: done`.
   - Confirm that no un-deployed item is left in `status: done`.

---

## Release Checklist

- [ ] Working tree clean and `dev` synchronized with remote (`Phase 0`)
- [ ] Verification Pyramid green on `dev` (`Phase 1`)
- [ ] SemVer 2.0 version objectively calculated (`Phase 2`)
- [ ] Release notes user-facing, anti-em-dash compliant, zero internal IDs (`Phase 3`)
- [ ] Explicit verbal confirmation received from human PO (`Phase 4`)
- [ ] Fast-forward merge `dev` ➔ `main` and annotated tag created (`Phase 4`)
- [ ] Project deploy hook executed successfully from `main` (`Phase 5`)
- [ ] All packaged tasks transitioned from `ready` to `done` (`Phase 6`)
