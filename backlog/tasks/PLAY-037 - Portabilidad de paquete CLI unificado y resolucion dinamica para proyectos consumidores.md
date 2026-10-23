---
id: PLAY-037
title: "Portabilidad de paquete: CLI unificado, resolucion dinamica de raiz y desacople de piramide para proyectos consumidores"
status: ready
created_date: '2026-10-22'
updated_date: '2026-10-23'
labels:
  - "packaging"
  - "cli"
  - "dx"
  - "portability"
dependencies: []
priority: high
type: improvement
estimate: 8
claimed_by: "antigravity:f4f3956d-a68c-400f-8f08-14f081bf6f2b"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`@gripm/playbook` no puede utilizarse como paquete en proyectos consumidores por acoplamientos internos a rutas relativas fijas y llamadas de red forzadas:

1. **Rutas fijadas a `__dirname/..`:** `scripts/gate-qa.mjs`, `scripts/audit-ux-code.cjs` y `scripts/gate-review-items.mjs` calculan su raíz como `path.resolve(__dirname, '..')`. Cuando corren instalados dentro de `node_modules/@gripm/playbook/`, intentan inspeccionar tareas y correr validaciones dentro de la carpeta del propio paquete instalado y no en la del proyecto consumidor (`process.cwd()`).
2. **Descarga obligatoria de GitHub en `init` y `sync`:** `scripts/sync-playbook.mjs` y `scripts/init.mjs` descargan archivos desde `raw.githubusercontent.com` por defecto, ignorando que el paquete instalado ya contiene todos los archivos canónicos. Esto rompe entornos offline, CI/CD cerrados, proxies y versiones fijas.
3. **Bloqueo de la Pirámide de Verificación:** `gate-qa.mjs` exige que el `package.json` del consumidor declare `gate:review` y `audit:ux:strict` como pasos bloqueantes. Un proyecto consumidor no tiene estos scripts internos, por lo que `gate-qa` falla siempre con código 1.
4. **Falta de CLI router y binarios expuestos:** `package.json` solo tiene `playbook` atado a `sync-playbook.mjs` que solo acepta `init`. No hay binarios expuestos para `gate-qa`, `audit-ux`, `check-loc` ni subcomandos en el CLI.
5. **Instrucciones hardcodeadas a `node scripts/...`:** Skills, adaptadores y documentación instruyen ejecutar `node scripts/gate-qa.mjs <ID>`, obligando a copiar los scripts al proyecto consumidor en vez de permitir consumirlos como paquete npm.
6. **Residuo `human:pablo`:** `.agents/TEAM_PLAYBOOK.md` incluye el usuario `pablo` en los ejemplos de lease.

Este item implementa el Modelo Hibrido: el consumidor puede optar por usar `@gripm/playbook` como dependencia de npm pura mediante su CLI (`npx playbook <cmd>` o `npx gate-qa`) o sincronizar archivos a su repositorio, funcionando de manera transparente y desacoplada en ambos casos.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 **Resolucion dinamica de raiz en herramientas centrales:** `scripts/gate-qa.mjs`, `scripts/audit-ux-code.cjs` y `scripts/gate-review-items.mjs` resuelven la raiz del proyecto de trabajo dinamicamente (`--root`/`--cwd`, `process.env.GRIPM_ROOT`/`process.env.AUDIT_UX_ROOT`, o `process.cwd()`), permitiendo su ejecucion correcta desde `node_modules/@gripm/playbook/` contra el proyecto consumidor.
- [x] #2 **Zero-network local fallback en `init` y `sync`:** Si no se pasa `--remote` ni `--source`, `scripts/sync-playbook.mjs` e `init.mjs` detectan automaticamente los archivos del paquete local instalado (mediante `.playbook-manifest.json` en la raiz del paquete) y sincronizan localmente sin llamadas a GitHub ni requerir conexion a internet.
- [x] #3 **Desacople autonomo de la Piramide de Verificación en `gate-qa`:** Si el `package.json` del proyecto consumidor carece de scripts `audit:ux:strict` o `gate:review`, `gate-qa` ejecuta el motor empaquetado directamente (auditoria UX en modo estricto y validacion del backlog local) sin fallar falsamente por ausencia de scripts en `package.json`.
- [x] #4 **CLI Router unificado y binarios de paquete:** `package.json` expone los binarios `playbook`, `gripm-playbook`, `gate-qa`, `audit-ux` y `check-loc`. `scripts/sync-playbook.mjs` funciona como despachador para los subcomandos `init`, `sync`, `gate`, `audit`, `check-loc` y `review`.
- [x] #5 **Limpieza de residuos y adaptacion documental:** Se erradica la referencia `human:pablo` de `.agents/TEAM_PLAYBOOK.md` (sustituida por `human:<username>`). La documentacion y adaptadores (`CLAUDE.md`, `.cursor/rules/*.mdc`) instruyen la ejecucion canonica mediante el CLI `playbook gate <ID>` (y alias `gate-qa <ID>`), manteniendo retrocompatibilidad con la invocacion directa `node scripts/gate-qa.mjs <ID>`.
- [x] #6 **Suite de pruebas de portabilidad:** Se agrega `tests/package-portability.test.mjs` verificando la ejecucion de `gate-qa` y `audit-ux` simulando una instalacion en `node_modules`, la sincronizacion local zero-network, los subcomandos del router CLI y el paso de la piramide en un proyecto consumidor limpio.
- [x] #7 **Validacion integral del repositorio:** `npm run check:all` pasa con 0 errores (332+ tests, validacion de manifiesto y paridad de reglas).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Iniciar tarea con transicion T0: `node scripts/gate-qa.mjs start PLAY-037 --by "antigravity:<id>"`.
2. Implementar resolucion dinamica de raiz en `gate-qa.mjs`, `audit-ux-code.cjs` y `gate-review-items.mjs`.
3. Implementar deteccion de paquete local en `sync-playbook.mjs` e `init.mjs` para fallback zero-network sin internet.
4. Extender `resolvePyramidSteps` y `gate-qa.mjs` para ejecutar auditoria UX y verificacion de backlog in-process o via binario empaquetado cuando no existan en `package.json`.
5. Implementar el router de comandos en `scripts/sync-playbook.mjs` y agregar los binarios a `package.json`.
6. Actualizar adaptadores en `scripts/lib/adapters.mjs`, `.agents/TEAM_PLAYBOOK.md` (reemplazo de `human:pablo`) y docs.
7. Crear `tests/package-portability.test.mjs` y validar todos los escenarios.
8. Ejecutar `npm run check:all`.
9. Transicionar a review (`node scripts/gate-qa.mjs submit PLAY-037`).
10. Certificar mediante subagente QA en contexto limpio (`qa-auditor`).
<!-- SECTION:PLAN:END -->
