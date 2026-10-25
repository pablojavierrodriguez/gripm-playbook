---
id: PLAY-041
title: "Zero-Clutter architecture: confinamiento de metadata en .gripm/, erradicacion de scripts/ en consumidor y auto-poda de huérfanos"
status: ready
created_date: '2026-10-25'
updated_date: '2026-10-25'
labels:
  - "architecture"
  - "sync"
  - "dx"
  - "packaging"
dependencies: []
priority: high
type: feature
estimate: 8
claimed_by: "antigravity:pm-orchestrator"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hoy `@gripm/playbook` invade la raíz del repositorio consumidor y el directorio `scripts/`:
1. **Contaminación de raíz:** Planta archivos sueltos como `.playbook-lock.json`, `.uxaudit.json`, `audit-ux-baseline.json`, `.locignore` y `.playbook-backups/`.
2. **Contaminación de `scripts/`:** Copia 16 archivos ejecutables de infraestructura a `scripts/` del consumidor, pese a que PLAY-037 ya implementó la ejecución vía binarios de npm en `node_modules`.
3. **Duplicación por renombre de skills:** Cuando el framework renombra un skill (como en PLAY-029: `worldclass-product-designer` a `product-designer`), el sincronizador deja ambos directorios vivos en `.agents/skills/`, forzando al desarrollador a borrar archivos obsoletos a mano.

### Principio Arquitectónico Zero-Clutter

1. **La raíz le pertenece al proyecto:** Solo conviven `package.json` y `AGENTS.md`.
2. **Metadata confinada en `.gripm/`:** Lockfiles, backups, baselines y configs del framework viven en `.gripm/`. Si el proyecto usa `gripm-board`, comparte naturalmente esa misma carpeta. Si no usa el board, la carpeta sigue siendo el namespace limpio de la suite.
3. **Ejecución desde `node_modules`:** Cero scripts copiados a `scripts/` del consumidor.
4. **Auto-poda segura de huérfanos:** Archivos y directorios de skills obsoletos que fueron instalados por el playbook y no presentan modificaciones del usuario se eliminan automáticamente durante el sync sin dejar carpetas duplicadas.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 **Metadata confinada en `.gripm/`:** `scripts/sync-playbook.mjs` lee y escribe el lockfile en `.gripm/playbook-lock.json` y los backups en `.gripm/backups/`. Mantiene retrocompatibilidad leyendo `.playbook-lock.json` en la raíz si existe y migrándolo a `.gripm/`.
- [x] #2 **Auditor UX y Check-LOC confinados:** `scripts/audit-ux-code.cjs` y `scripts/check-loc.mjs` buscan `.uxaudit.json`, `audit-ux-baseline.json` y `.locignore` preferentemente dentro de `.gripm/`, manteniendo fallback a la raíz del proyecto.
- [x] #3 **Erradicación de `scripts/` en consumidor:** `sync-playbook.mjs` e `init.mjs` no copian archivos ejecutables a la carpeta `scripts/` de proyectos consumidores. La pirámide y los scripts de `package.json` invocan exclusivamente los binarios CLI (`playbook gate`, `playbook audit`, etc.).
- [x] #4 **Auto-poda de huérfanos y renombres obsoletos:** `sync-playbook.mjs` elimina automáticamente archivos de `.agents/` presentes en el lockfile anterior que ya no formen parte del plan instalado, siempre que no registren modificaciones locales (`customizations`). Si el directorio contenedor queda vacío, es removido de disco.
- [x] #5 **Limpieza de scripts legados en actualización:** Durante `sync`, si existen scripts en `scripts/` del consumidor que coincidan con los hashes canónicos del framework, se eliminan limpiamente para retirar la deuda técnica previa.
- [x] #6 **Suite de pruebas de migración e2e:** `tests/` incluye tests que validan una actualización desde un repositorio con estructura legada (scripts en raíz y skills con nombre antiguo), verificando que la raíz quede limpia, `.gripm/` contenga el lockfile y los skills viejos sean podados sin duplicaciones.
- [x] #7 **Validación total:** `npm run check:all` pasa con 0 errores y 100% de coherencia.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Transicionar PLAY-041 a `doing` (`node scripts/gate-qa.mjs start PLAY-041 --by "antigravity:pm-orchestrator"`).
2. Actualizar constantes de rutas en `scripts/lib/sync-classifier.mjs`, `scripts/sync-playbook.mjs`, `scripts/audit-ux-code.cjs` y `scripts/check-loc.mjs` para priorizar `.gripm/`.
3. Modificar el plan de sincronización para que en repositorios consumidores (`targetDir !== packageBundleRoot`) solo se instalen archivos bajo `.agents/` y templates necesarios, sin poblar `scripts/`.
4. Implementar `pruneOrphans` seguro en `sync-playbook.mjs` con borrado de carpetas vacías y migración/limpieza de scripts legados.
5. Actualizar adaptadores e instrucciones de skills para usar `playbook <cmd>` o `gate-qa` sin asumir `node scripts/...`.
6. Añadir cobertura de tests en `tests/sync.test.mjs` y `tests/package-portability.test.mjs`.
7. Ejecutar `npm run check:all`.
8. Transicionar a `review` y certificar vía subagente QA en contexto limpio.
<!-- SECTION:PLAN:END -->
