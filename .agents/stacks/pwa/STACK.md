# Stack Pack: PWA

Optional skills for projects delivering an installable **Progressive Web App**.

## Included Skills

| Skill | Applies When |
| :--- | :--- |
| `pwa-assets-audit` | Auditing or modifying manifest.webmanifest, app icons, service workers, or install configuration. |

## Installation

```bash
node scripts/sync-playbook.mjs --stack pwa
```

## Scope

Audits **asset declaration and consistency**: verifying that the manifest references existing icons with correct dimensions and valid JSON.

## Note

PWA features frequently accompany the `react` and `mobile` stack packs. Stacks are fully modular: install only what your project requires.