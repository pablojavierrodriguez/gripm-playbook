# Stack Pack: Mobile

Optional skills for teams delivering a **mobile experience**: responsive web, installable web apps (PWA), or hybrid apps via native wrappers.

## Included Skills

| Skill | Applies When |
| :--- | :--- |
| `mobile-ux-design` | Designing or auditing mobile responsive interfaces, sheets, virtual keyboard resiliency, safe areas, or native Capacitor integration. |

## Installation

```bash
node scripts/sync-playbook.mjs --stack mobile
```

## Scope

Covers **mobile responsive web** and **Capacitor** native wrapping. For purely native Swift/Kotlin applications without a web runtime, define native invariants in your own project rules.

## Dependencies

No required runtime dependencies. Specific sections assume Capacitor plugins (`@capacitor/haptics`, etc.) when enabled by the project.