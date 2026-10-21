---
id: PLAY-030
title: "Zero-Friction Onboarding CLI and Multi-Harness Adapters (Cursor, Claude Code, Antigravity)"
status: done
created_date: '2026-10-20'
updated_date: '2026-10-21'
labels:
  - "adoption"
  - "cli"
  - "multi-harness"
dependencies: []
priority: high
type: feature
estimate: 13
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementar un onboarding sin friccion (`npx @gripm/playbook init`) con adaptadores nativos para los tres harnesses que el framework ya declara soportar (Antigravity, Cursor, Claude Code). Es el item que ejecuta los pasos 2 y 3 del plan original de "golden repo" y cierra el ultimo pendiente del paso 1.

Por que importa: el playbook promete compatibilidad universal pero hoy su arquitectura depende conceptualmente de `invoke_subagent`, que es primitiva exclusiva del runtime de Antigravity. Un usuario de Cursor o Claude Code no tiene camino de ejecucion. Ademas, la adopcion manual hoy exige clonar el repo y copiar carpetas a mano.

Historial: creada el 2026-10-20 por una sesion que se interrumpio por cuota, sin refinement y sin ACs verificables. Re-refinada el 2026-10-21 al tomar control del repo.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `npx @gripm/playbook init` ejecuta un asistente interactivo que pregunta harnesses (multi-seleccion), stack principal e integracion opcional del Board, y expone un flag no interactivo equivalente al `--yes` que ya tiene `sync-playbook.mjs`.
- [x] #2 Deteccion automatica de stack: el init lee el `package.json` del proyecto destino y propone los stack packs disponibles de `.agents/stacks/` (react, mobile, pwa), dejando al usuario confirmar o sobreescribir.
- [x] #3 Genera los archivos nativos del harness elegido: `.agents/` (Antigravity), `.cursor/rules/*.mdc` (Cursor) y `CLAUDE.md` (Claude Code).
- [x] #4 El `AGENTS.md` que llega al consumidor viene parametrizado con el nombre, stack e idioma reales elegidos en el asistente: no queda ningun texto-guia tipo `[PROJECT_NAME]` o `[Specify Language, ...]` sin resolver.
- [x] #5 Existe un test e2e que corre el init no interactivamente en un directorio temporal y afirma que los archivos generados existen y son validos (extiende `tests/e2e-delivery.test.mjs`).
- [x] #6 `npm run check:all` pasa con 0 errores y el nuevo archivo del CLI esta registrado en `.playbook-manifest.json` y en `FALLBACK_CORE_FILES` con paridad verificada.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Crear `scripts/init.mjs` separado de `sync-playbook.mjs` (ya en 438 LOC, contra un techo sano de 500: el wizard es otra responsabilidad, no una flag mas).
2. Extraer el helper `prompt()` que hoy vive local en `sync-playbook.mjs` a `scripts/lib/terminal.mjs`, que ya es parte del manifest, en vez de duplicarlo. El wizard ademas necesita select y multi-select, que no existen.
3. Implementar la deteccion de stack leyendo `package.json` y mapeando a `.agents/stacks/{react,mobile,pwa}`.
4. Implementar los generadores de adaptadores (`.cursor/rules/*.mdc`, `CLAUDE.md`) reutilizando el contenido de `AGENTS.md` ya parametrizado.
5. Registrar `scripts/init.mjs` en `.playbook-manifest.json` (core) y en `FALLBACK_CORE_FILES` de `sync-playbook.mjs`; el test de paridad del repo lo exige.
6. Actualizar `package.json` (bin + script `init`) y el README (titular + quickstart de 30 segundos).
7. Correr `npm run check:all` y el test e2e nuevo.

## Alcance negativo
- Sin publicacion a npm, sin bump de version, sin release ni push.
- Sin adaptador para Copilot.
- Sin playground interactivo ni demo en terminal (eso es PLAY-031).
- Sin seccion de sinergia Board/Playbook en el README (eso es PLAY-032).
- Sin tocar el lado consumidor (`gripm`): ese trabajo es DEV-323 y queda bloqueado hasta que este item se libere.

## Decisiones tomadas
1. **Tres modulos en vez de uno.** `scripts/init.mjs` (348 LOC: CLI, deteccion, wizard, orquestacion), `scripts/lib/adapters.mjs` (134 LOC: parametrizacion de AGENTS.md + render de adaptadores, funciones puras) y `scripts/lib/terminal.mjs` (117 LOC: prompts). El wizard concentrado en `init.mjs` superaba el techo sano de 500 LOC.
2. **`scripts/sync-playbook.mjs` registrado en `core` + `FALLBACK_CORE_FILES`.** `init.mjs` importa `runPlaybookSync` de ese archivo: instalar uno sin el otro deja un script roto. Ademas los `STACK.md` ya instruyen `node scripts/sync-playbook.mjs --stack <name>`, un comando que hoy solo existe si el consumidor copio el instalador a mano.
3. **Adaptadores = punteros finos, nunca copias.** Cada `.mdc` y `CLAUDE.md` declara que `AGENTS.md` es canonico y solo repite las no-negociables. Dos copias de una regla divergen; un puntero no.
4. **`AGENTS.md` solo se parametriza si es la plantilla base.** Se detecta por la guia `Configure your project stack below`: si esta presente, el archivo es nuestro template y cualquier ancla ausente revienta con error (drift). Si no esta, es un archivo escrito por un humano y se preserva intacto.
5. **El esquema de `.gripm/config.json` se copia del codigo que lo escribe y lee el Board** (`gripm` `bin/gripm.js:5800-5821`), no de una suposicion: `projectName`, `projectId` (scope minus, minusculas), `codePrefix` (4 chars), `language`, `theme`, `density`, `autoSave`, `mode: single`, `methodology: kanban`, `enabledTabs`, `kanban` y `version`.
6. **Los adaptadores usan `node scripts/gate-qa.mjs <ID>`, no `npm run gate:qa`.** El `package.json` del consumidor no se instala; el CLI si esta en `core`. Un adaptador que manda a un script inexistente seria mentira documental.
7. **Los prompts caen a su default sin TTY.** El mismo camino de codigo sirve para el wizard interactivo, `--yes`, pipes y la suite, que corre el CLI con stdin en pipe: no hay riesgo de bloqueo en CI.
8. **Subcomando `init` despachado en el main guard de `sync-playbook.mjs`** via dynamic import, siguiendo el precedente del token `sync`. No hay ciclo de import: el dispatch es dinamico y el main guard evita la doble ejecucion.

## Verificacion
- `npm run check:all` verde: validate + check:loc (17 archivos fuente, todos < 500 LOC, 0 warnings) + **332/332 tests** (eran 321).
- Smoke run real del wizard en directorio temporal: exit 0, deteccion automatica de `react` sin flag `--stack`, AGENTS.md parametrizado con 0 residuo de guia (`or configured`, `replace with project-specific`, `or project-configured language` = vacio), `.gripm/config.json` identico esquema por esquema al del Board.
- Suite e2e Tier 5 (F14-1 a F14-11): paridad manifest/fallback, deteccion + parametrizacion, adaptadores cursor/claude, AGENTS.md humano intacto, config del Board y `--no-board`, harness default solo antigravity, `CLAUDE.md` ajeno protegido salvo `--force`, harness desconocido exit 2 sin escribir nada, `--help`/`--list-harnesses`/fallbacks de prompt, **clausura de imports** y **ejecutabilidad de los scripts instalados**.

## Ronda de QA (subagente de contexto limpio)
**Hallazgo bloqueante encontrado y corregido.** El QA reprodujo que el sync instalaba scripts que revientan en el repo del consumidor: `scripts/sync-playbook.mjs` (recien agregado a `core`) importa `scripts/lib/provenance.mjs` y `scripts/lib/sync-classifier.mjs`, que no estaban registrados. `node <repo-consumidor>/scripts/init.mjs --help` fallaba con `ERR_MODULE_NOT_FOUND`, lo que hacia mentira documental dos veces: el propio mensaje de cierre del wizard ("Re-run this wizard any time") y el comando `node scripts/sync-playbook.mjs --stack <name>` que los `STACK.md` ya instruyen.

La causa raiz es que el test de paridad solo compara **membria** entre el manifest y `FALLBACK_CORE_FILES`, no la **clausura de imports**: ambos son ciegos al mismo defecto, y por eso la decision #2 de esta plan estaba correcta en su razonamiento pero incompleta en su ejecucion.

Correccion: los dos modulos quedaron registrados en `core` y en `FALLBACK_CORE_FILES` (ambos son hojas: solo importan builtins de Node, asi que la clausura queda cerrada en 24 entradas). Se agregaron dos tests que el QA identifico como faltantes:
- `F14-10` verifica la clausura de imports de todo el core, escaneando el contenido completo de cada script (no por linea: los imports multi-linia ponen el especificador en una linea que no empieza con `import`, que fue exactamente el ciego que tapo el defecto).
- `F14-11` ejecuta los entry points **instalados** dentro de un repo consumidor real, que era la brecha de cobertura que lo oculto.

Ambos tests pasaron el **control negativo**: reintegrando manualmente la ausencia de `provenance.mjs` del manifest, F14-10 y F14-11 fallan con mensaje preciso, y el manifest se restauro y revalido despues.

Correcciones menores derivadas del mismo informe: la atribucion de los artefactos generados decia `gripm init`, que en el consumidor es el CLI del Board y no ejecuta esta deteccion; ahora dice `npx @gripm/playbook init`. Y `backlog/tasks/` ahora se crea siempre, porque es el item pool del framework y no un artefacto del Board: con `--no-board` el mensaje de "Next steps" apuntaba a un directorio que no existia.

**Pendiente para Release Management (fuera del alcance de este item):** el QA confirmo que `npx @gripm/playbook@2.5.0 init` devuelve `Unknown option: init` porque la version publicada no tiene este trabajo. Publicar el comando exige bump de version; hasta entonces el quickstart del README y el `Regenerate with:` del `CLAUDE.md` generado son ciertos solo para el release que los contiene.
<!-- SECTION:PLAN:END -->
