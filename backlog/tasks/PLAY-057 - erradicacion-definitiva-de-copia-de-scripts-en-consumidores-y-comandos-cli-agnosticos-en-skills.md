---
id: PLAY-057
title: "Erradicacion definitiva de copia de scripts en consumidores y comandos CLI agnosticos en skills"
status: ready
created_date: '2026-11-02'
updated_date: '2026-11-02'
labels:
  - "architecture"
  - "sync"
  - "zero-clutter"
  - "dx"
dependencies: []
priority: high
type: fix
estimate: 5
claimed_by: "antigravity:subagent-play-057"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem Statement
A pesar de la arquitectura Zero-Clutter introducida en `PLAY-041`, persiste un defecto estructural en `scripts/sync-playbook.mjs` al calcular `isConsumerPackage`: cuando un repositorio consumidor ejecuta `playbook sync` contra el repositorio remoto de GitHub o mediante `--source <dir>`, `shouldDefaultToLocalBundle` resulta `false` y el sincronizador **vuelve a copiar los 19 scripts internos del framework (`scripts/*.mjs`, `scripts/lib/*.mjs`, `scripts/audit-ux-code.cjs`, `scripts/ux-rules.json`) dentro de la carpeta `scripts/` del consumidor**, generando archivos duplicados y código muerto que no le pertenecen al proyecto.

Adicionalmente, las skills canónicas (`.agents/skills/*/SKILL.md`, `.agents/TEAM_PLAYBOOK.md`, `.agents/STATE_MACHINE.md`) continúan instruyendo al agente a ejecutar rutas locales como `node scripts/gate-qa.mjs <ID>` o `node scripts/audit-ux-code.cjs --strict`, lo cual falla en cualquier consumidor Zero-Clutter donde `scripts/` fue erradicado.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  1. Forzar `packageMode: true` en `scripts/sync-playbook.mjs` siempre que el repositorio destino (`targetDir`) no sea el propio repositorio fuente de `@gripm/playbook` (`targetDir !== packageBundleRoot` y no contenga `.playbook-manifest.json` con `"name": "@gripm/playbook"`), independientemente de si el sync proviene de paquete local, `--source` o GitHub remoto (salvo cuando el usuario pase explícitamente `--install-scripts`).
  2. Ejecutar `pruneLegacyScripts` en todo consumidor (remoto o `--source`) para eliminar automáticamente cualquier copia previa de los 19 scripts del Playbook y limpiar sus entradas de `.gripm/playbook-lock.json`.
  3. Actualizar todas las skills canónicas (`pm-orchestrator`, `principal-engineer`, `qa-auditor`, `code-level-ux-auditor`), `STATE_MACHINE.md` y `TEAM_PLAYBOOK.md` para invocar los binarios CLI del paquete (`npx playbook gate <ID>` / `npm run gate:qa -- <ID>`, `npx playbook audit --strict`, `npx playbook check-loc`, `npx playbook audit-repo`) en lugar de rutas `node scripts/...`.
- **Out-of-Scope:**
  - Modificar la lógica interna del parser UX o las reglas de negocio de las compuertas.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `scripts/sync-playbook.mjs` activa `packageMode: true` (excluyendo `scripts/*` del plan de instalación) para todo repositorio consumidor (`targetDir` distinto de la raíz del repositorio `@gripm/playbook`), tanto en modo paquete local como con `--source` o remoto desde GitHub, salvo que se indique explícitamente `--install-scripts`.
- [x] #2 Al sincronizar un consumidor que tenía scripts copiados en `.gripm/playbook-lock.json` (como `@gripm/board`), `pruneLegacyScripts` elimina los 19 scripts clonados de `scripts/` y `scripts/lib/` sin dejar archivos huérfanos ni directorios vacíos.
- [x] #3 Todas las referencias operativas en `.agents/skills/*/SKILL.md`, `.agents/STATE_MACHINE.md` y `.agents/TEAM_PLAYBOOK.md` priorizan los comandos del binario CLI (`npx playbook gate`, `npx playbook audit`, `npx playbook check-loc`, `npx playbook audit-repo`) eliminando la dependencia de archivos `scripts/*.mjs` copiados en el consumidor.
- [x] #4 `tests/sync.test.mjs` y `tests/package-portability.test.mjs` incluyen casos de prueba que verifican que `runPlaybookSync` con `--source` y remoto sobre un consumidor nunca copia `scripts/` y poda copias legadas existentes.
- [x] #5 `npm run check:all` (`validate`, `check:loc`, `test`) pasa con código 0.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Corregir la condición `isConsumerPackage` en `scripts/sync-playbook.mjs` verificando si `targetDir` es o no el repositorio fuente de `@gripm/playbook`.
2. Asegurar que `pruneLegacyScripts` se ejecute para todo consumidor en modo paquete, comparando contra hashes del lockfile o del origen.
3. Actualizar las instrucciones de comandos en `.agents/skills/`, `.agents/STATE_MACHINE.md`, `.agents/TEAM_PLAYBOOK.md` y `scripts/validate-repo.mjs` si valida strings literales.
4. Añadir tests de regresión en `tests/sync.test.mjs` y ejecutar `npm run check:all`.
<!-- SECTION:PLAN:END -->
