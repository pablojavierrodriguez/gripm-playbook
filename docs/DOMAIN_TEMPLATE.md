# DOMAIN.md - Ubiquitous Domain Glossary

> **Opt-in** template for projects that adopt the playbook. It is not mandatory: a project without a glossary is still valid. It is recommended when two or more agents work on the same domain.

Copy as `DOMAIN.md` in the project root and fill it in.

---

## Why it exists

A domain glossary is not documentation. It is a **lever for concision and precision**:

1. **Concision.** The canonical term replaces the paragraph. "A reservation cancels" says more than three lines explaining the cancellation flow.
2. **Precision.** It prevents conceptual hallucinations: the agent does not invent a concept the project has already named differently.

When it exists, agents consult it **before using a term**, and use the canonical vocabulary in code, commit messages, ACs, and conversations.

---

## How to write an entry

Every concept follows the same template. The discipline is what makes it useful: without the name rule, the glossary degenerates into one more document.

```markdown
### <Canonical term in PascalCase or snake_case>

**What it is:** One sentence. The operational meaning, not the dictionary definition.

**Why it exists:** The user problem that exists. If there is no problem, there is no term.

**It is not:** The concept that looks like a twin and is not. This line delivers the most value:
it prevents confusion with the neighbouring term.

**Example:** One concrete, real case from the domain.
```

### Rules

| Rule | Why |
| :--- | :--- |
| **The name is the code identifier.** The canonical term is used literally in variables, types, and functions. If the glossary name and the code name differ, one of the two is wrong. |
| **"It is not" is mandatory.** The most expensive mistake in a domain is confusing two neighbouring concepts. |
| **One term, one meaning.** If it needs two meanings, they are two terms. |
| **No synonyms.** If two words mean the same thing, one of them goes. |
| **Real examples, not invented ones.** A fabricated example is worse than no example. |
| **Revision date.** Glossaries age badly. A term not verified in six months is a hallucination source. |

> [!CAUTION]
> **A stale glossary is worse than no glossary.** A term that is no longer used induces the agent to write dead code. When a term stops being part of the domain, it is **deleted**; it is not marked as obsolete.

---

## File structure

```markdown
# Domain - <Product Name>

<!-- Last updated: YYYY-MM-DD by <role> -->

## Glossary

### Booking
### Guest
### Reservation
### Cancellation

## Domain Invariants

<!-- Non-negotiable rules. Cross-reference .agents/rules/ if they already exist. -->

- A reservation cannot overlap another reservation for the same room.
- Cancelling a reservation releases the inventory atomically.

## Banned Language

<!-- Words the project does NOT use, so the agent does not reintroduce them. -->

| Do not use | Use instead | Why |
| :--- | :--- | :--- |
| "user" | "guest" | A user may be staff; a guest never is. |
| "purchase" | "order" | Domain terminology, not platform terminology. |
```

---

## Maintenance

- **The PO writes it**, not the agent. The agent may propose entries, but business vocabulary is a product decision.
- **It is updated with the domain, not with the sprint.** If the glossary changes every sprint, it was not a glossary: it was a changelog.
- **The agent flags the gaps.** If you find a project concept that is not in the glossary and you use it two or more times, it is a missing entry: propose it.
