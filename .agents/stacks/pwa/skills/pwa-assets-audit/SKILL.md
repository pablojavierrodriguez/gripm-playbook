---
name: pwa-assets-audit
description: Auditoría y validación de consistencia de la PWA (Progressive Web App). Usar al modificar manifest.webmanifest, íconos de la app, service worker o configuraciones de instalación móvil.
---

# PWA Assets & Manifest Audit

Esta skill permite auditar y verificar que los recursos de la PWA estén correctamente declarados y existan físicamente con las dimensiones requeridas.

## Script de Auditoría

Para verificar la consistencia del manifest y sus íconos:

```bash
node .agents/stacks/pwa/skills/pwa-assets-audit/scripts/validate-manifest.mjs
```

## Checklist Manual
1. Comprobar que `public/manifest.webmanifest` sea un JSON válido.
2. Comprobar que cada ruta en `icons` exista en `public/`.
3. Comprobar que los íconos con `purpose: "maskable"` y `purpose: "any"` cumplan con los estándares de Android y Chromium.
4. Validar que `start_url` y `scope` sean consistentes con la configuración del enrutador Vite/React.
