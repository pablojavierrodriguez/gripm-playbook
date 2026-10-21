---
name: product-designer
description: Designs world-class interfaces and micro-interactions. Visual hierarchy, semantic tokens, precision typography, tactile feedback, purposeful motion, and complete states. Use when designing or reviewing a component, flow, screen, or design system.
---

# Product Designer Skill

## Mission

Make the product feel as polished, responsive, and purposeful to use as the best tools in its category. Zero generic interfaces: every interactive element must communicate craftsmanship, solidity, and care.

> This skill defines **design judgment**. The concrete design system (tokens, component library, motion framework) belongs to the project: consult it before proposing specific values.

---

## 1. Philosophy and Microcopy

The interface **assists, it does not judge**.

- Affirmative and specific microcopy. Name the action, not the absence: "No activity in this period" or "No items recorded", not "No data".
- **Anti-paternalism:** the design respects user autonomy. In onboarding or hard resets, defaults are never imposed; always offer an explicit fork between the recommended option and a blank canvas.
- **Zero state:** when there is no activity or 0 records, never emit an alert or error color. An empty state is a **valid** state: communicate it with serenity and offer the next step.
- Proactive empty states: guide first-time use with context and a concrete action, not with "nothing here".

---

## 2. Visual Hierarchy and Typography

- No flat grays or dead contrasts. Semantic tokens (`primary`, `accent`, `muted-foreground`) so the theme can change without touching components.
- Closed typographic scale. An arbitrary size is debt: promote it to a token or use the scale.
- **Tabular numerals** (`tabular-nums` or monospaced data token) in **every** numeric column, and in every value that changes live. Without this, digits shift layout.
- Thousands and decimal separators consistent across all surfaces, including exports and charts.
- Fine tracking on small caps for labels; never all-caps in paragraphs.

---

## 3. Micro-Interactions and Motion

- **Immediate touch feedback:** every tactile action responds in the same frame (`active:scale-[0.98]`, background change).
- **Purposeful motion:** sheet and modal entry with curves that communicate origin. No decorative animation that delays the response.
- Short transitions (150 - 250ms) for state; longer only for surface entry/exit.
- Respect `prefers-reduced-motion`: it is an accessibility requirement, not an extra.

---

## 4. Touch Ergonomics

- **Effective touch target >= 44x44px** on any clickable element. Verified with `getBoundingClientRect()`, not with the CSS class.
- Primary actions within thumb reach on mobile: bottom sheets and bottom action bars.
- **Never more than 2 visible actions per row** in lists and cards. Secondary ones go into a menu with a comfortable target.
- Numeric inputs: keyboard declared by data type (`inputMode="decimal"`, `inputMode="tel"`), parsed by locale. Never `type="number"` for numeric values with commas or decimals.
- Sheets and modals with safe scroll: capped maximum height, `overflow-y-auto`, and bottom padding that respects the safe area.

---

## 5. Mobile Layout

- **Two-level card architecture:** decouple metadata from the main header. Row 1 = identity and value. Row 2 = context and chips. Avoids forced vertical breaks from long titles.
- Every scrollable container with **sufficient clearance against the fixed bottom UI** (`pb-32` + `env(safe-area-inset-bottom)`), not `pb-16`.
- No horizontal overflow at 375px/390px. Tested, not assumed.
- Responsive density: fewer columns on mobile, more vertical scroll. Never a 6-column table at 375px.

---

## 6. States

Every interactive component defines **all** of these states, explicitly:

| State | Content |
| :--- | :--- |
| Default | - |
| Hover | Pointer devices only |
| Active / Focus | Focus ring **always visible** for keyboard navigation |
| Disabled | Reason communicated, not just dimmed |
| Loading | Skeleton or spinner by expected latency |
| Empty | Serene zero state + next action |
| Error | What happened + what to do + whether it is recoverable |

---

## 7. The Playbook is a Filter, not a Style Guide

This skill **does not prescribe** colors, typefaces, radii, or specific values. The project owns its visual system; the playbook defines the criterion by which it is judged.

What it defines is a filter. Against **every** visual decision (a technique already in the repo, one proposed by the design stack, or one that "looks modern") apply the **Purpose Test**:

> **What purpose of hierarchy, legibility, or accessibility does this technique serve?**

- If the answer names a verifiable purpose (distinguishing primary from secondary element, sustaining minimum contrast, marking the focused element), the technique stays and its function is documented.
- If the answer is decorative, or "it looks modern", or cannot be answered, the technique **is removed**. Not degraded, not softened: removed.

The test **removes decisions; it does not add rules**. Its default result is a more restrained interface. Adding an exception requires a new catalog signature (`UX-NNN`) declared on both sides, or a new chapter with its justification: never a "it's a matter of taste" shortcut.

When the purpose of a technique is not obvious, prefer the version without it: the same result with less visual surface is a better result.

---

## 8. Catalog of Default Clichés

These defaults are rejected **at first sight** unless the design demonstrates the purpose that justifies them. They are not prohibited values: they are defaults that must be **justified**.

| Default | Why it is rejected | Question before keeping it |
| :--- | :--- | :--- |
| Dark background with blue-purple or cyan radial gradient orbs | It is the visual signature of generic output; it does not hierarchize anything and competes with the text it surrounds | Does the gradient separate surfaces or only decorate? If it does not separate, it is noise |
| Glassmorphism on cards, navigation bar, and modals **simultaneously** | Repeated blur on three planes stacks translucency where opacity is needed: text loses contrast and depth becomes illegible | On which surface is translucency needed, and what is beneath? One translucent plane, the rest opaque |
| Uniform pill-radius `border-radius` on **everything** | The capsule communicates shape continuity; applied universally it erases contrast between surface types (container, control, chip, avatar) | Is the radius distinguishing surfaces or is it a global default value? |
| Oversized shadows on every layer | When everything floats, nothing stands out: hierarchy flattens and the user does not know where to tap first | Which layer should be in front? Only that one gets a shadow |

The combined test: **if two different screens of the product look identical, something is not communicating.** A product is recognized by how it resembles its category, not by how it resembles everything else.

---

## 9. Copy Veracity

In components, copy, and mockups, content follows the same law: **what is stated is true, or it is not stated.**

- **Prohibited:** inventing example statistics, metrics, or percentages ("+10,000% ROI", "500,000 teams trust this") in screens presented as a real product.
- **Prohibited:** fabricating testimonials, client logos, avatars, proper names, or quotes.
- **Prohibited:** hyperbolic claims or substanceless headlines ("unlock the power of next-generation workflows"). If the headline can be pasted onto any product in the sector, it says nothing.
- **Prohibited:** layout filler: never complete a card, chart, or badge with a fabricated number to make the mockup look populated.

If there is no real data, the path is one of two, and both are valid:

1. Show the **real zero state** (section 1) - serene, with the next step - when zero is a true datum.
2. **Omit** the statement and let the surface breathe.

The mockup placeholder is marked as such (`Lorem`, `-`, `0`) so no one confuses it with production data. A mockup that looks real and is not is a content bug, not a shortcut.

---

## Deliverables

Specification in the `[DESIGN SPEC]` section of the sprint spec:

- Tokens and visual hierarchy defined.
- Touch targets declared.
- Micro-interactions and sensory feedback specified.
- All 7 states from section 6 resolved, with token name where applicable.
- Tokens as **semantic variables**, never hardcoded hex in the component.
- **Purpose Test** verdict (section 7) for every non-obvious technique: the purpose that justifies it, or confirmation that it was removed.
- Confirmation that copy meets **veracity** (section 9): every displayed datum comes from a real source, or the statement was omitted.
