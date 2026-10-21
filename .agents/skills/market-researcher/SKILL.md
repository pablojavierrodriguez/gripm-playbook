---
name: market-researcher
description: Researches product benchmarks, external API documentation, and domain standards to ground UX and engineering decisions. Compares against at least 3 leading products, identifies anti-patterns and edge cases, and delivers an actionable brief. Use before defining a solution or when judgment on a complex flow is lacking.
---

# Market & UX Researcher Skill

## Mission

Ensure that no product decision or interaction is made blind or from gut instinct alone. Research how domain leaders solve the same problem, what friction users report, and what the proven industry standards are.

---

## Process

### 1. Reference Benchmark

Compare the problem against **at least 3 leading products in the domain**. Select by problem proximity, not brand fame:

| Product type | Reference examples |
| :--- | :--- |
| Productivity / tools | Linear, Notion, Obsidian |
| Developer tools | GitHub, Vercel, Stripe Dashboard |
| Fintech / personal finance | Monzo, Revolut, Copilot Money |
| E-commerce | Shopify, Mercado Libre, Amazon |
| Health / regulated domains | Domain-specific |

For each, capture:

- **Empty states:** what do they show when there is no data? Do they guide the user or leave them alone?
- **Latency:** skeleton, spinner, optimistic, or blocking? Are perceived-performance techniques in use?
- **Complex inputs:** keyboard, validation, regional format, autocomplete.
- **Micro-feedback:** confirmations, undo, haptics, toasts.
- **Density:** how much information per screen without overloading?

### 2. Domain Edge Cases

Anticipate limits **before** users report them. The families that appear in nearly every domain:

| Family | Examples |
| :--- | :--- |
| **Volume** | Zero, one, many, too many to render. |
| **Unit and format** | Multiple currencies / units / timezones; regional decimal separators. |
| **Temporal cycle** | Cutoff date vs. due date; projections; what happens when the month changes. |
| **Relationships** | Deleting or editing something referenced by another item. |
| **Partiality** | Partial cancellations, partial amounts or deliveries, partial status. |
| **Concurrency** | Two sessions editing the same thing; double submit. |
| **Access restrictions** | The user can view but not edit; another tenant's data. |

### 3. Documented Output

Produce a concise brief in the `[RESEARCH]` section of the sprint spec:

- **References analyzed:** concrete links. "I looked at 3 apps" without a link is not research.
- **Prominent interaction patterns:** the reusable pattern, not the app name.
- **Domain edge cases & risks:** table from section 2, filtered to those that apply to **this** item.
- **Recommendations:** one concrete decision per edge case, for the Designer and the Engineer.

> [!NOTE]
> Research **constrains**; it does not replace judgment. If the references disagree with each other, that conflict is a valid finding: document both options and the decision alongside the trade-off.
