# Backlog: gripm-playbook
> Consolidado generado el 2026-11-08 por gripm

## Resumen de Estados

### 💡 Ideas / Discovery (1)

#### [PLAY-062] Add VS Code Copilot, OpenCode, and no-harness support to init
- **Prioridad**: `medium` | **Tipo**: `feature`

### Problem Statement
Playbook init currently offers adapters only for Antigravity, Cursor, and Claude Code. Users of VS Code Copilot and OpenCode cannot select native harness support, and an empty harness selection cannot be represented distinctly from the Antigravity default.

### Discovery Scope
- Identify the canonical instruction and adapter surfaces for VS Code Copilot and OpenCode while keeping AGENTS.md and .agents/ as the canonical source of governance.
- Define how explicit no-harness mode differs from the current implicit Antigravity default.
- Keep this capability in Playbook so all consumers, including Gripm, receive the same support.

### Out of Scope
- Changing Gripm's `--init` flow; Gripm integration is tracked separately in DEV-361.
- Duplicating the canonical agent rules into harness-specific files.

**Criterios de Aceptación:**
- [ ] #1 Research and document the supported native instruction surfaces for VS Code Copilot and OpenCode and how they point to the canonical Playbook instructions.
- [ ] #2 The product decision explicitly distinguishes an omitted harness selection (default behavior) from an explicit no-harness selection.
- [ ] #3 After refinement, `playbook init` can list and select VS Code Copilot and OpenCode using native adapters without duplicating governance content.
- [ ] #4 After refinement, `playbook init` can explicitly install no harness adapters without silently falling back to Antigravity.
- [ ] #5 Tests cover each new adapter and the explicit no-harness behavior; `npm run check:all` passes.

---

### 🚀 Ready for Deploy (6)

#### [PLAY-057] Erradicacion definitiva de copia de scripts en consumidores y comandos CLI agnosticos en skills
- **Prioridad**: `high` | **Tipo**: `bug`

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

**Criterios de Aceptación:**
- [x] #1 `scripts/sync-playbook.mjs` activa `packageMode: true` (excluyendo `scripts/*` del plan de instalación) para todo repositorio consumidor (`targetDir` distinto de la raíz del repositorio `@gripm/playbook`), tanto en modo paquete local como con `--source` o remoto desde GitHub, salvo que se indique explícitamente `--install-scripts`.
- [x] #2 Al sincronizar un consumidor que tenía scripts copiados en `.gripm/playbook-lock.json` (como `@gripm/board`), `pruneLegacyScripts` elimina los 19 scripts clonados de `scripts/` y `scripts/lib/` sin dejar archivos huérfanos ni directorios vacíos.
- [x] #3 Todas las referencias operativas en `.agents/skills/*/SKILL.md`, `.agents/STATE_MACHINE.md` y `.agents/TEAM_PLAYBOOK.md` priorizan los comandos del binario CLI (`npx playbook gate`, `npx playbook audit`, `npx playbook check-loc`, `npx playbook audit-repo`) eliminando la dependencia de archivos `scripts/*.mjs` copiados en el consumidor.
- [x] #4 `tests/sync.test.mjs` y `tests/package-portability.test.mjs` incluyen casos de prueba que verifican que `runPlaybookSync` con `--source` y remoto sobre un consumidor nunca copia `scripts/` y poda copias legadas existentes.
- [x] #5 `npm run check:all` (`validate`, `check:loc`, `test`) pasa con código 0.

---

#### [PLAY-058] Modularidad total en init y sync: gobernanza opcional, presets de rigor y modo manual
- **Prioridad**: `high` | **Tipo**: `feature`

### Problem Statement
El flujo actual de `playbook init` y `playbook sync` (`PLAY-051`) permite elegir skills de `.agents/skills/` y plantillas de `docs/`, pero sigue imponiendo de forma rígida:
1. La instalación obligatoria de `.agents/TEAM_PLAYBOOK.md`, `.agents/STATE_MACHINE.md` y `.agents/rules/git-workflow.md` incluso si el usuario solo desea instalar una skill puntual (ej. `code-level-ux-auditor` o `principal-engineer`).
2. Un único nivel de rigor en la auditoría estática (`ux-rules.json` y `gate-qa.mjs`) donde preferencias estilísticas y editoriales (`UX-011` escala tipográfica, `UX-014` anti-em-dash) bloquean al mismo nivel que defectos críticos de accesibilidad o roturas de teclados móviles.
3. Falta de una opción explícita en la personalización para usuarios avanzados que deseen operar las transiciones de forma manual versus el modo automatizado por defecto.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  1. Extender `scripts/lib/selection.mjs`, `scripts/lib/sync-classifier.mjs` (`planFiles`), `scripts/init.mjs` y `scripts/sync-playbook.mjs` con la dimensión `rules` (`team-playbook`, `state-machine`, `git-workflow`) seleccionable en modo `custom` y mediante flag `--rules <list|all|none>`, con auto-poda si se desmarca.
  2. Incorporar soporte de **Presets de Rigor** (`preset: "pragmatic" | "strict" | "dogmatic"`) y **Modo de Automatización** (`automation: "automated" | "manual-override"`) en `.gripm/config.json` y `.gripm/.uxaudit.json`:
     - `pragmatic`: Activa por defecto solo reglas deterministas críticas de ingeniería y accesibilidad (excluyendo bloqueos estilísticos como `UX-011`, `UX-012`, `UX-013`, `UX-014`).
     - `strict`: Activa el catálogo completo de ergonomía, LOC (< 1000) y anti-slop.
  3. Soportar flags CLI no interactivas (`--preset <pragmatic|strict>`, `--rules <list>`) para integración directa desde `@gripm/board` sin doble interrogatorio.
- **Out-of-Scope:**
  - Crear reglas nuevas en `ux-rules.json`.

**Criterios de Aceptación:**
- [x] #1 `scripts/lib/selection.mjs` y `planFiles` en `scripts/lib/sync-classifier.mjs` soportan la selección granular de artefactos de gobernanza (`team-playbook`, `state-machine`, `git-workflow`) vía modo interactivo `custom` y flag `--rules <lista|all|none>`, persistiendo la elección en `.gripm/playbook-lock.json` y podando archivos desmarcados.
- [x] #2 `scripts/audit-ux-code.cjs` y `scripts/gate-qa.mjs` respetan el preset configurado en `.gripm/config.json` o `.gripm/.uxaudit.json` (`pragmatic` vs `strict`), evitando bloqueos por reglas estilísticas (`UX-011`, `UX-014`) cuando el proyecto opera en perfil `pragmatic`.
- [x] #3 `scripts/init.mjs` permite configurar el nivel de rigor (`pragmatic` vs `strict`) y el modo de operación (100% automatizado con excepciones humanas vs manual), exponiendo flags no interactivas (`--preset`, `--rules`) para consumo programático desde `gripm --init`.
- [x] #4 Suite de pruebas en `tests/selection.test.mjs` y `tests/audit-ux.test.mjs` validando el filtrado de `rules`, la auto-poda y el comportamiento de los presets `pragmatic` y `strict`.
- [x] #5 `npm run check:all` pasa con código 0.

---

#### [PLAY-059] Descomposicion modular de scripts/audit-ux-code.cjs bajo el techo de 1000 LOC
- **Prioridad**: `high` | **Tipo**: `refactor`

### Problem Statement
El repositorio `@gripm/playbook` establece como regla innegociable que ningún archivo de código fuente debe alcanzar o superar las 1000 líneas de código (`check-loc.mjs`). Sin embargo, `scripts/audit-ux-code.cjs` cuenta actualmente con **1.441 líneas**, concentrando en un único archivo monolítico el CLI parser, el cargador de catálogos y baselines, el motor heurístico de unidades JSX/AST y el formateador de reportes.

Para predicar con el ejemplo y mantener un Health Score de **100/100** con `check:loc:strict` en verde, es obligatorio descomponer `scripts/audit-ux-code.cjs` en módulos cohesivos.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  1. Extraer la lógica de parseo de unidades JSX, expresiones e internacionalización (`collectUnits`, `stripExpressions`, `findTagEnd`, jerarquía de componentes) a `scripts/lib/ux-jsx-parser.cjs`.
  2. Extraer la carga de configuración, catálogos de reglas (canónicas y locales), compilación de globs `exclude` y gestión de snapshots `audit-ux-baseline.json` a `scripts/lib/ux-catalog.cjs`.
  3. Mantener intacta la interfaz pública programática (`const { auditProject } = require('./audit-ux-code.cjs')`) y todos los flags de CLI.
  4. Actualizar `.playbook-manifest.json` y `FALLBACK_CORE_FILES` si corresponde para empaquetar los submódulos en el tarball de npm.
- **Out-of-Scope:**
  - Alterar la semántica de detección de las reglas `UX-001` a `UX-015`.

**Criterios de Aceptación:**
- [x] #1 `scripts/audit-ux-code.cjs` y cada uno de sus submódulos extraídos (`scripts/lib/ux-*.cjs`) se mantienen estrictamente por debajo de las 650 líneas de código (cumpliendo con creces el techo de < 1000 LOC).
- [x] #2 `node scripts/check-loc.mjs --strict` y `node scripts/audit-engine.mjs --strict` sobre el repositorio `@gripm/playbook` reportan **0 violaciones de LOC** y un **Health Score de 100/100**.
- [x] #3 La API exportada (`auditProject`, `loadRules`, etc.) y el comportamiento CLI de `scripts/audit-ux-code.cjs` conservan 100% de retrocompatibilidad.
- [x] #4 `npm test` (incluyendo los 13 archivos de test y todas las fixtures de `audit-ux.test.mjs`) y `npm run validate` pasan con código 0.

---

#### [PLAY-060] Evitar que gate-qa adopte .agents globales como raiz de proyecto
- **Prioridad**: `high` | **Tipo**: `bug`

Al ejecutar `gate-qa` con una ruta de tarea temporal, la resolucion de raiz puede ascender hasta el perfil del usuario e interpretar su `.agents/` global como raiz del proyecto. `checkStructuralHealth` entonces inspecciona archivos ajenos al repositorio, supera el limite de salida de `spawnSync` (`ENOBUFS`) y hace fallar pruebas e2e.

### Alcance
- Tratar `.agents/` solo como marcador de proyecto cuando contiene artefactos canónicos de gobernanza; reconocer también marcadores inequívocos como `.git`, `package.json`, `.playbook-manifest.json`, `AGENTS.md` o `backlog/tasks/`.
- Si una ruta explícita de tarea no tiene una raíz de proyecto reconocible en sus ancestros, usar el directorio de esa tarea como raíz de fallback.
- Añadir una regresión CLI que demuestre que artefactos en un ancestro con `.agents/` no contaminan la inspección de la tarea aislada.

### Fuera de alcance
- Cambiar reglas del auditor, la pirámide de verificación o el gate de certificación.

**Criterios de Aceptación:**
- [x] #1 La resolución de una ruta explícita reconoce raíces con marcadores de proyecto verificables y no considera suficiente un `.agents/` genérico de un ancestro.
- [x] #2 Si no existe un marcador de proyecto, `gate-qa` usa el directorio de la tarea como raíz y no inspecciona artefactos de sus directorios padre.
- [x] #3 Una prueba CLI con un ancestro que contiene `.agents/` y una supresión fuera del directorio de la tarea devuelve el resultado esperado para la tarea aislada, sin `ENOBUFS`.
- [x] #4 Los casos existentes de resolución por ID, paquetes consumidores y `--root` conservan su comportamiento.
- [x] #5 `npm run check:all` termina con código 0.

---

#### [PLAY-063] Skill canónica release-management y protocolo formal de entrega en Playbook
- **Prioridad**: `high` | **Tipo**: `feature`

### Problem Statement
El flujo ágil de entrega en Playbook define formalmente: `draft` ➔ `doing` ➔ `review` ➔ `ready` ➔ `Release Management` ➔ `done`. Sin embargo, Playbook cuenta con skills para PM, UX, Dev y QA, pero carecía de una skill canónica para `release-management`. Esto provocó que proyectos consumidores (como DOM) crearan skills ad-hoc o que Gripm dispersara sus reglas en AGENTS.md.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  1. Crear la skill canónica `.agents/skills/release-management/SKILL.md` en `@gripm/playbook`.
  2. Definir el protocolo universal de release en 6 fases:
     - Fase 0: Auditoría pre-corte (`git log main..dev`, diff stat, cero ramas sucias).
     - Fase 1: Quality Gate previo (Pirámide de Verificación completa pasando en verde).
     - Fase 2: Determinación objetiva SemVer 2.0 (Major, Minor, Patch).
     - Fase 3: Consolidación de notas 100% User-Facing (cero IDs internos `DEV-XXX`/`SPEC-XXX`, regla Anti-Em-Dash `-`).
     - Fase 4: Protocolo Git canónico (`dev` ➔ `main` ➔ `dev`) con confirmación verbal explícita para commit y push.
     - Fase 5: Invocación del Deploy Hook del proyecto (npm publish, script de hosting, o deploy cloud) que justifica la transición de estado.
     - Fase 6: Reconciliación post-deploy en Backlog (`ready` ➔ `done` con `releasedAt: vX.Y.Z`).
  3. Actualizar `TEAM_PLAYBOOK.md` y `STATE_MACHINE.md` para referenciar formalmente a `release-management` como el rol/skill ejecutor de la transición `ready` ➔ `done`.
  4. Incluir `release-management` en el manifiesto de sincronización (`.playbook-manifest.json`, `selection.mjs`) para que se distribuya a los proyectos consumidores vía `playbook sync` / `playbook init`.
- **Out-of-Scope:**
  - Comandos de despliegue específicos de proyectos individuales (cada consumidor define su propio hook).

**Criterios de Aceptación:**
- [x] #1 .agents/skills/release-management/SKILL.md existe en @gripm/playbook con las 6 fases universales y guardrails de calidad documentados.
- [x] #2 TEAM_PLAYBOOK.md y STATE_MACHINE.md documentan formalmente la skill release-management como dueña de la transición ready -> done.
- [x] #3 .playbook-manifest.json y los scripts de distribución (selection.mjs, init.mjs) incluyen la skill release-management.
- [x] #4 Los checks de calidad del playbook (npm run check:all) pasan en verde (0 errores de lint, tests y LOC).

---

#### [PLAY-064] Utilidad agnóstica de extracción de release notes y plantilla CI de release idempotente
- **Prioridad**: `medium` | **Tipo**: `feature`

### Problem Statement
Los workflows de CI/CD de proyectos que usan Playbook suelen sufrir de fragilidad en la fase de release: scripts inline de bash/node para extraer notas, acoplamiento donde un fallo en GitHub Release impide reintentos, y falta de marcadores `--latest`.

### Bounded Scope & Decisions (Gate R1)
- **In-Scope:**
  1. Crear el script utilitario agnóstico `scripts/extract-release-notes.mjs` distribuible vía Playbook:
     - Capaz de extraer notas y título tanto desde `backlog/releases.json` (formato Gripm Board) como desde `docs/RELEASE_NOTES.md` (formato Markdown plano).
     - Genera `release-title.txt` y `release-notes.txt` de forma limpia y testeable localmente.
     - Aplica validación Anti-Em-Dash (reemplazando o alertando ante caracteres unicode em-dash o en-dash).
  2. Proveer una receta o plantilla canónica de GitHub Actions (`templates/ci-release-job.yml` o en documentación) que demuestre:
     - Desacople idempotente de estados (`tag_exists` y `release_exists` evaluados independientemente).
     - Flag `--latest` en `gh release create`.
     - Concurrency seguro (`cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`).
  3. Tests unitarios en `tests/` para `extract-release-notes.mjs`.
- **Out-of-Scope:**
  - Modificar la infraestructura de CI de proyectos externos de forma automática.

**Criterios de Aceptación:**
- [x] #1 scripts/extract-release-notes.mjs extrae título y cuerpo correctamente desde backlog/releases.json y docs/RELEASE_NOTES.md.
- [x] #2 El script genera release-title.txt y release-notes.txt normalizando CRLF y respetando la regla Anti-Em-Dash.
- [x] #3 Tests unitarios en tests/ cubren ambos formatos de extracción y fallbacks.
- [x] #4 La plantilla de CI con los guardrails de idempotencia y --latest queda documentada en el Playbook.
- [x] #5 npm run check:all pasa con código 0.

---

### ✅ Done / Deployed (54)

#### [PLAY-001] Anatomía de unidad en el motor de reglas: text, ownContent y scopeText
- **Prioridad**: `high` | **Tipo**: `bug`

Causa raíz de los defectos DEV-187 #1 y #2. `needsContent` se evaluaba contra `content`, el **archivo entero**, así que un solo `const Icon = () => null` en cualquier línea convertía a todos los botones del archivo en botones "icon-only". En `gripm` eso producía 127 hallazgos de UX-010 en 13 archivos, de los cuales ~101 son falsos positivos.

La causa no era el `lineMatches` sino `buildUnits`. El segmentador anterior contaba `<` abiertos contra `>` cerrados como caracteres, sin distinguir un self-closing `<Icon />` de un elemento con hijos. Consecuencia: `<button>` y su contenido caían en unidades distintas, y "el contenido de este elemento" no era una pregunta computable. Aplicar `content` → `unit.text` al pie de la lettre corrige el caso de una línea y **regresiona `UX-006`**, cuyo fixture es multilínea.

**Criterios de Aceptación:**
- [x] #1 `buildUnits` distingue open, self-close y close, y rastrea profundidad de anidamiento real
- [x] #2 Un self-closing hijo no cierra a su padre: `<button><Icon /></button>` es una sola unidad
- [x] #3 Cada unidad expone `text` (tag de apertura), `ownContent` (sin descendientes) y `scopeText` (subárbol completo)
- [x] #4 `needsContent`/`unlessContent` leen `scopeText`; `line`/`alsoLine` leen `text`
- [x] #5 `UX-006` reescrita de `needsContent` a `nearby`: la regla es inherentemente cross-elemento
- [x] #6 `UX-004` y `UX-013` declaradas con `alsoContent` para que apunten al elemento que renderiza el valor, no al wrapper
- [x] #7 El hallazgo reporta la línea exacta del elemento, no la del contenedor
- [x] #8 `npm run check:all` en verde

---

#### [PLAY-002] UX-010: nombre visible como escape, y reporte de toda ocurrencia en vez de una por archivo
- **Prioridad**: `high` | **Tipo**: `bug`

Dos defectos reportados por el dev de `gripm` en el retro `2026-10-06-auditoria-real-code-level-ux-auditor`.

**1. `UX-010` no veía etiqueta de texto visible.** Sus escapes eran todos por atributo (`aria-label`, `title=`, `aria-labelledby`, `sr-only`), así que `<button><span>visible label</span></button>` se reportaba igual. Ninguna lista de tokens puede expresar "este control ya tiene un nombre visible"; hacía falta capacidad del motor.

**2. `break` por archivo.** El motor traía `break; // one finding per rule per file keeps the report actionable`, que limitaba a una observación por regla por archivo. En `gripm` reportaba 49 hallazgos donde había 487: ocultaba el 90% del ruido y volvía inútil cualquier baseline.

El defecto 2 era además la razón por la que el defecto 1 pasaba desapercibido upstream: con el `break`, la reproducción mínima reportaba **1** falso positivo en vez de 2, porque el recorrido cortaba antes del segundo caso.

**Criterios de Aceptación:**
- [x] #1 Nueva capacidad de motor `unlessVisibleText` que evalúa si el elemento renderiza texto, quitando tags y expresiones
- [x] #2 `UX-010` no reporta botón con etiqueta de texto visible como hijo
- [x] #3 `UX-010` sigue reportando un botón realmente icon-only sin nombre
- [x] #4 El `break` por archivo se elimina: se reporta cada ocurrencia
- [x] #5 El baseline reemplaza al `break` como mecanismo de gestión de ruido (ver PLAY-003)
- [x] #6 Fixture de regresión con la reproducción mínima del dev
- [x] #7 `npm run check:all` en verde

---

#### [PLAY-003] Baseline de observaciones aceptadas como capacidad genérica del auditor
- **Prioridad**: `high` | **Tipo**: `feature`

El motor reportaba una ocurrencia por regla por archivo. Ese `break` era un parche para el ruido, y como parche era falso: ocultaba el 90% de las observaciones reales, y a la vez enmascaraba los falsos positivos porque cortaba el recorrido.

Adoptar el auditor sobre un codebase que ya tiene cientos de hallazgos abre un problema real: o el gate es inútil desde el primer día, o es ilegible y nadie lo lee. La respuesta estándar en la industria es un snapshot de lo ya revisado.

`gripm` ya implementó esto localmente (DEV-166) y por eso tuvo que **forkear el motor**: su `scripts/sync-playbook.mjs` preserva `audit-ux-code.cjs` para proteger el baselining frente al sync de upstream. Es decir, un consumidor-Parcheó el archivo que debería consumir, y el skill documentado empezó a describir un comportamiento que el motor que corre no tenía.

El baseline es genérico: cualquier proyecto con ruido cosmático acumulado lo necesita. Va en el playbook, no en el consumidor.

**Criterios de Aceptación:**
- [x] #1 `audit-ux-baseline.json` en el proyecto del consumidor, con `version` y `description`
- [x] #2 `--update-baseline` reescribe el snapshot y sale
- [x] #3 Sin baseline no se absorbe nada: comportamiento idéntico al previo
- [x] #4 `ERROR` nunca se absorbe, ni siquiera presente en el snapshot
- [x] #5 La fingerprint excluye el número de línea, para que importar arriba no invalide el snapshot
- [x] #6 Las ocurrencias se cuentan con multiplicidad: una quinta instancia de algo ya aceptado cuatro veces se reporta
- [x] #7 Un baseline de otra versión se descarta con warning y regenerable
- [x] #8 Reporta cuántas observaciones absorbió, en human y en JSON
- [x] #9 `audit-ux-baseline.json` en `preserved` del manifest: es del proyecto, no del framework
- [x] #10 Tests del ciclo completo
- [x] #11 `npm run check:all` en verde

---

#### [PLAY-004] Retirar el bin agentic-team-playbook, residuo del renombre a gripm-playbook
- **Prioridad**: `medium` | **Tipo**: `chore`

`DEV-179` renombró el proyecto a `gripm-playbook` y limpió README, `sync-playbook.mjs` y los badges. Se le olvidó `package.json`: el bin `agentic-team-playbook` siguió apuntando al sync, de modo que el nombre viejo seguía siendo invocable después de haber sido declarado muerto.

Es un residuo de bajo impacto pero con costo de mantenimiento real: mientras exista, un documento, un script o una persona que busque el proyecto viejo lo encuentra y no tiene forma de saber que está obsoleto.

**Criterios de Aceptación:**
- [x] #1 El bin `agentic-team-playbook` se elimina de `package.json`
- [x] #2 Los bins canónicos `playbook` y `gripm-playbook` se conservan
- [x] #3 Una búsqueda del nombre viejo devuelve cero resultados
- [x] #4 La ruptura queda explícita en el CHANGELOG de la versión
- [x] #5 `npm run check:all` en verde

---

#### [PLAY-005] Punto de extensión del auditor: API pública, onlyFile y catálogo local por proyecto
- **Prioridad**: `high` | **Tipo**: `feature`

El consumidor `gripm` bifurca `scripts/audit-ux-code.cjs` y su divergencia pasó de 302 a 779 líneas. La causa no es una decisión de `gripm`: **es que no hay forma de extender el auditor sin reescribirlo.**

Tres huecos concretos, en orden de gravedad:

**1. No hay API pública.** El archivo termina en `main()` y no exporta nada. Un consumidor no puede importar el motor para componer sus propias reglas: no hay nada que importar. Bifurcar es la única salida, y por eso el `.agents/skills/` del consumidor documenta un comportamiento que el motor que corre no tiene.

**2. No hay filtro positivo de archivo.** El catálogo expone `unlessFile` (exclusión) pero ninguna forma de decir "esta regla solo aplica a archivos cuyo nombre contenga X". Sin eso, una regla acotada por contexto —"`truncate` dentro de un diálogo"— no es declarable, porque solo se puede desactivar por archivo, nunca activar.

**3. No hay catálogo local.** El catálogo canónico vive en `scripts/ux-rules.json`, que el sync reemplaza. Un consumidor que necesite una regla propia tiene que escribirla en código, dentro del motor.

Esto también products el problema de nombres que el consumidor ya sufrió: 5 de sus 8 códigos `UX-*` locales significaban otra cosa que los canónicos, porque nada reserva el prefijo `UX-` para el catálogo compartido.

**Criterios de Aceptación:**
- [x] #1 `audit-ux-code.cjs` exporta una API programática y el CLI sigue identico
- [x] #2 Correr el archivo como bin no dispara la auditoría, solo importarlo
- [x] #3 `onlyFile` en el catálogo: la regla solo corre si el path contiene alguno de los tokens
- [x] #4 `onlyFile` documentado en `authoring.checkSemantics`
- [x] #5 `.uxaudit.json` acepta `rules`: path a un catálogo propio del proyecto
- [x] #6 El catálogo local se mergea con el canónico, sin pisar firmas existentes
- [x] #7 Un ID local con el patrón `UX-NNN` es error fatal con mensaje explicito
- [x] #8 Un ID duplicado entre local y canónico es error fatal
- [x] #9 `--list-rules` distingue las firmas locales de las canónicas
- [x] #10 Un consumidor puede importar `auditProject` y obtener findings sin pasar por el CLI
- [x] #11 Tests que cubran API, `onlyFile` y catálogo local
- [x] #12 Documentado en README y en el skill
- [x] #13 `npm run check:all` en verde

---

#### [PLAY-006] UX-010: el texto visible de un descendiente cuenta, y los custom controls entran en la firma
- **Prioridad**: `high` | **Tipo**: `bug`

Dos defectos residuales de `UX-010` reportados por el consumidor contra el tarball de `2.1.0` (`DEV-188`). Verificados y reproducidos acá antes de tocar nada.

**1. `unlessVisibleText` era inerte para la forma más común de botón.** Contaba solo los nodos de texto directos del elemento y excluía los descendientes, así que:

```jsx
<button onClick={save}><Icon /><span>Guardar</span></button>
```

se reportaba como botón icon-only sin nombre. Un control que le muestra "Guardar" a la persona **no** es un control sin nombre, y ese markup es exactamente cómo se escriben los botones con icono y etiqueta.

**2. Un control custom nunca estuvo cubierto.** La firma era `<button`, `<Button`, `motion.button`. Un `div[role=button]` con solo un icono pasaba limpio. Los ARIA buttons son un patrón documentado y la regla los era ciega.

**Por qué importaba:** hacen que el "0 hallazgos" de `UX-010` sea un techo, no una prueba. El consumidor ya tiene el caso concreto: puso `role="button"` en la raíz de `ItemCard` en su AC #6, hoy con `aria-label`, pero si mañana alguien lo saca el gate no avisa.

**Criterios de Aceptación:**
- [x] #1 El texto renderizado por descendientes cuenta para `unlessVisibleText`
- [x] #2 Un botón multilínea con icono y etiqueta visible no se reporta
- [x] #3 `role="button"` entra en la firma de `UX-010`
- [x] #4 Un `div[role=button]` con solo un icono se reporta
- [x] #5 Un `div[role=button]` con etiqueta visible no se reporta
- [x] #6 `IconOnly.tsx` cubre las cinco formas etiquetadas y las dos sin nombre
- [x] #7 La aserción lista exactamente qué dos líneas pueden reportarse
- [x] #8 `npm run check:all` en verde

---

#### [PLAY-007] onlyFile debería enganchar el componente renderizado y no el nombre del archivo
- **Prioridad**: `medium` | **Tipo**: `improvement`

`onlyFile` (PLAY-005) resuelve por **nombre de archivo**. Es lo que el consumidor necesitaba para expresar "`truncate` dentro de un diálogo", y funciona, pero la forma en que funciona es frágil:

```json
"check": { "line": ["truncate"], "onlyFile": ["Modal", "Dialog"] }
```

Un diálogo definido en `Overlays.tsx` no se ve. Uno en `ConfirmModal.tsx`, sí. El comportamiento depende de cómo el proyecto nombró sus archivos, no de qué renderiza el componente.

La misma debilidad ya existía en el invariante `ENV-002` del consumidor, y fue parte de lo que abrió la pregunta de si debía promoverse al catálogo: el problema no es solo si una regla debe ser canónica, sino si la regla es correcta.

La solución refinada y aprobada por el PO agrega la semántica declarativa `withinComponent` en `check`: el árbol de parseo de unidades de JSX conoce la jerarquía de ancestros (`frame.parent`), permitiendo verificar si un elemento está contenido dentro de un componente padre (ej. `<Dialog>`, `<Modal>`, `<Dialog.Content>`) sin importar el nombre del archivo en disco.

**Criterios de Aceptación:**
- [x] #1 El motor de auditoría (`scripts/audit-ux-code.cjs`) soporta `check.withinComponent` como array de nombres de componente (soporta matching de nombre exacto y componentes con notación de punto como `<Dialog.Content>`).
- [x] #2 Un elemento o texto dentro de un componente objetivo (ej. `<Dialog>`) declarado en un archivo con cualquier nombre (ej. `src/Overlays.tsx`) es detectado y reportado si viola la condición.
- [x] #3 `onlyFile` se mantiene 100% funcional y retrocompatible para filtrado por ruta de archivo.
- [x] #4 La documentación de authoring en `.agents/skills/code-level-ux-auditor/SKILL.md` y `README.md` documenta la sintaxis y distingue `withinComponent` de `onlyFile`.
- [x] #5 Tests automatizados en `tests/audit-ux.test.mjs` validando `withinComponent` con anidamientos profundos, nombres de archivo no obvios (`Overlays.tsx`), componentes con punto y coexistencia con `onlyFile`.
- [x] #6 `npm run check:all` (`validate`, `check:loc`, `test`) en verde con 0 fallos.

---

#### [PLAY-008] Exports map y verificacion del catalogo local en validate-repo
- **Prioridad**: `medium` | **Tipo**: `improvement`

Dos huecos que aparecieron al publicar el punto de extension (PLAY-005).

**1. El import del motor es un deep require.**

```js
const { auditProject } = require('@gripm/playbook/scripts/audit-ux-code.cjs');
```

Funciona porque el paquete no define un campo `exports`. En el momento en que se agregue uno -por ejemplo para restringir `main` o exponer el auditor con un nombre estable- **todos los deep requires externos se rompen**. El dia que se cree un `exports` map, los consumidores que hayan migrado con esta ruta reciben un error en runtime.

**2. `validate-repo` no conoce el catalogo local.** Verifica que el catalogo canonico ⇄ skill ⇄ manifiesto esten consistentes. No valida un catalogo propio del proyecto: ni sus IDs, ni sus checks, ni que no colisione con un ID canonico. El motor rechaza esas tres cosas al cargar, pero el error aparece tarde, en el momento de auditar, y no en el gate de consistencia.

Ademas, el error de colision actual dice "reserved canonical pattern" incluso cuando el ID colisiona con una firma canonica concreta y no con el patron. El mensaje correcto debe nombrar la firma colisionada especificamente.

**Criterios de Aceptación:**
- [x] #1 `package.json` define un `exports` map con un nombre estable para el auditor (`"./audit"`, `"./gate"`, `"./check-loc"`)
- [x] #2 La ruta del import documentado sigue funcionando (deep require backwards-compatible `"./scripts/*"`)
- [x] #3 `validate-repo` valida un catalogo local declarado en `.uxaudit.json` si existe
- [x] #4 Un ID local que colisiona con una firma canonica da un mensaje que nombra la firma
- [x] #5 Un ID local con el patron reservado da un mensaje distinto del de colision
- [x] #6 `npm run check:all` en verde

---

#### [PLAY-009] La puerta de salida del motor debe separar findings canonicos de locales
- **Prioridad**: `medium` | **Tipo**: `improvement`

`--strict` decide el codigo de salida sobre **todos** los hallazgos reportados. Con un catalogo local activo, un consumidor tiene tres clases de observacion mezcladas en un solo contador:

- firmas canonicas del playbook
- firmas locales del proyecto
- observaciones absorbidas por el baseline

Un `--strict` que falla por una regla local no dice cual de las dos familias es responsable, y un `--strict` en CI que falla por un invariante propio no es comparable con uno que falla por el catalogo compartido. Dos proyectos con el mismo resultado pueden tener causas distintas y ningun signal para distinguirlas.

El baseline tiene el mismo problema, que es mas caro: la fingerprint es `regla|archivo|digest`. Un snapshot tomado antes de agregar una regla local contiene entradas que despues se reinterpretan, y no hay forma de regenerar el snapshot **solo** para las firmas locales sin perder el trabajo de revision de las canonicas.

**Criterios de Aceptación:**
- [x] #1 El reporte distingue findings canonicos de locales (tanto en salida humana como en el resumen)
- [x] #2 `--strict` puede limitarse a las firmas canonicas mediante `--canonical-only`
- [x] #3 `--update-baseline` puede regenerar solo un subconjunto de firmas (`--only canonical|local` o `--rule <ID>`)
- [x] #4 Un snapshot parcial no pierde la revision de las firmas que no se regeneran
- [x] #5 La salida JSON declara el origen (`origin: "canonical" | "local"`) de cada hallazgo
- [x] #6 `npm run check:all` en verde

---

#### [PLAY-010] Enviar una firma nueva exige un test que falle sin el fix
- **Prioridad**: `high` | **Tipo**: `process`

`PLAY-006` llegó al release con la capacidad rota, y la causa no fue una falta de revisión: **el test pasaba por la razón equivocada**.

El fixture de `UX-010` tenía un único caso etiquetado:

```jsx
<button><span>Guardar</span></button>
```

No contenía un icono, así que `needsContent Icon` lo filtraba **antes** de que `unlessVisibleText` evaluara nada. El test comprobaba la capacidad sin ejercitarla nunca. La conclusión "funciona" era defendible para el caso medido y falsa para el caso que importaba.

Un test que pasa sin ejecutar el código bajo prueba no es cobertura. Es decoración.

La regla que sale de acá: **un caso de regresión para una capacidad nueva tiene que fallar si la capacidad se revierte.** Si no se puede escribir el caso así, o la capacidad no es observable, o el test está probando otra cosa.

**Criterios de Aceptación:**
- [x] #1 Cada capacidad nueva del motor trae un test que falla al revertirla
- [x] #2 La guía de contribución dice cómo verificar esa condición
- [x] #3 El fixture de `UX-010` cubre las cinco formas etiquetadas y las dos sin nombre
- [x] #4 La aserción cuenta las líneas que sí pueden reportarse, en vez de comprobar ausencias
- [x] #5 Un test que pasa por una razón distinta a la que dice probar se considera defecto

---

#### [PLAY-011] Sync local zero-network, smart orphan detection y State Machine canónica
- **Prioridad**: `high` | **Tipo**: `feature`

Mejorar el sincronizador `sync-playbook.mjs` y consolidar la taxonomía de la State Machine para permitir que cualquier proyecto consumidor (incluyendo repositorios hermanos en desarrollo local) sincronice sin fricción y sin falsos positivos:

1. **Soporte de origen local:** Permitir `--source <dir>` / `--from <dir>` o auto-detectar rutas de directorio locales en `--remote`, habilitando sincronización zero-network.
2. **Smart Orphan Detection:** `findOrphanedFiles` ahora discrimina archivos gestionados previamente mediante `.playbook-lock.json`. Reglas y skills de dominio del proyecto consumidor ya no son falsamente clasificadas como huérfanas.
3. **Consolidación de State Machine y Git Governance:** Formalización de la secuencia `draft ➔ doing ➔ review ➔ ready ➔ done` y cadencia de 1 tarea = 1 commit atómico en `STATE_MACHINE.md` y `git-workflow.md`.

**Criterios de Aceptación:**
- [x] #1 Soporte de `--source <dir>` / `--from <dir>` en `sync-playbook.mjs` para sincronización local
- [x] #2 Detección inteligente de huérfanos (`findOrphanedFiles`) que respeta skills/reglas propias del consumidor vía `.playbook-lock.json`
- [x] #3 Alineación de `STATE_MACHINE.md` y `git-workflow.md` con taxonomía unificada
- [x] #4 Suite de pruebas automatizadas con 49 tests en verde (`npm test`) y validación de manifiesto (`npm run validate`)
- [x] #5 Manifiesto, package.json y CHANGELOG actualizados a v2.2.2

---

#### [PLAY-012] Aislamiento de agentes concurrentes mediante git worktree para prevenir colisiones de rama y working tree
- **Prioridad**: `high` | **Tipo**: `feature`

Cuando múltiples agentes de IA (o hilos paralelos) operan de forma concurrente sobre un mismo repositorio local en ramas distintas, el uso tradicional de `git checkout <branch>` dentro del mismo directorio de trabajo produce colisiones críticas:

1. **Estado global de HEAD:** `.git/HEAD` y el working tree son compartidos a nivel de sistema de archivos. Si el Agente B ejecuta `git checkout dev-feature` mientras el Agente A está trabajando sobre `dev`, el working tree del Agente A cambia silenciosamente de rama en tiempo real.
2. **Commits en ramas equivocadas:** Si el Agente A ejecuta `git commit` tras la conmutación involuntaria, los cambios se asientan sobre la rama del Agente B, contaminando el historial y generando confusión operativa.
3. **Riesgo para cambios no stageados:** Cambios no guardados o temporales de un agente pueden bloquear o corromper el checkout de otro agente.

### Solución Canónica: Aislamiento mediante `git worktree`
Incorporar al Playbook (`.agents/rules/git-workflow.md`, `AGENTS.md` y `TEAM_PLAYBOOK.md`) la directriz formal y receta operativa de aislamiento multi-agente:
- **Prohibición de conmutar ramas en repositorios compartidos activos:** Cuando dos o más agentes/hilos operan simultáneamente, ningún agente debe hacer `git checkout` para cambiar de rama en el working tree principal.
- **Creación de worktrees dedicados:** Cada agente o tarea paralela debe operar en su propio worktree aislado:
  ```bash
  git worktree add ../<repo>-<feature> <branch>
  ```
  y al concluir la tarea y consolidar los cambios:
  ```bash
  git worktree remove ../<repo>-<feature>
  ```
- **Integración con sub-agentes:** Guía para que herramientas y sub-agentes utilicen el modo de workspace aislado (`Workspace: 'share'` / `Workspace: 'branch'`) o creen worktrees efímeros.

**Criterios de Aceptación:**
- [x] #1 .agents/rules/git-workflow.md incorpora sección 'Multi-Agent Parallelism via git worktree' con reglas y recetas operativas
- [x] #2 AGENTS.md documenta la prohibición de checkout cruzado en entornos multi-agente concurrentes
- [x] #3 .agents/TEAM_PLAYBOOK.md actualiza la sección de Sub-Agent Autonomy con la pauta de aislamiento de workspaces
- [x] #4 Guía de comandos prácticos (worktree add, worktree list, worktree remove) documentada en docs/ o playbook de soporte

---

#### [PLAY-013] Reglas deterministas de linter anti-slop (Oxlint/AST) contra vicios de código y comentarios generados por IA
- **Prioridad**: `high` | **Tipo**: `feature`

Los agentes de IA tienden a incurrir en vicios repetitivos de codificación ("code slop") que degradan silenciosamente la integridad técnica de las aplicaciones TypeScript y JavaScript:

1. **Fabricación de tipos:** Cuando el compilador detecta una incompatibilidad, los LLMs recurren con frecuencia a dobles aserciones como `value as unknown as TargetType` o ensanchan expresiones conocidas hacia `any` o `unknown`, esquivando el sistema de tipos en lugar de resolver el contrato.
2. **Tests mentirosos por mockeo desmedido:** En suites de tests (Vitest/Jest), los agentes abusan de `vi.mock()` para aislar módulos enteros, produciendo tests verdes que no validan las integraciones reales y ocultan roturas de dependencias.
3. **Validación perezosa en runtime:** Uso de `typeof x === 'object'` en los bordes del sistema (APIs, payloads) en lugar de esquemas deterministas y seguros (Zod, Valibot, ArkType).
4. **Comentarios de relleno y decorativos:** Banners con caracteres repetidos (`// ==================== AUTH ====================`), narración paso a paso de control flow trivial (`// Step 1: validate input`) y comentarios que simplemente duplican el nombre del símbolo o función sin aportar contexto arquitectónico.

### Solución
Inspirado en el enfoque determinista de `dmmulroy/anti-slop` y la higiene de `miqdadbadjuber/anti-slop` (antislop-code):
- Establecer en el playbook las reglas y configuraciones linter deterministas que rechazan estos patrones mediante análisis estático de AST (con exit code 1 bloqueante).
- Actualizar la skill del Principal Engineer para consagrar la prohibición de comentarios de relleno y la disciplina estricta de aserciones de tipos.

**Criterios de Aceptación:**
- [x] #1 Actualizar .agents/skills/principal-engineer/SKILL.md con las reglas de higiene de comentarios (prohibición de separadores decorativos, narración de flujo trivial y duplicación de firmas)
- [x] #2 Documentar en el playbook las reglas de código anti-slop: prohibición de aserciones encadenadas (no-chained-type-assertions), requisito de justificación explícita ante type assertions y prohibición de widening innecesario
- [x] #3 Documentar en el playbook la política contra el mockeo indiscriminado de módulos en tests (no-module-mocking) en favor de costuras reales de arquitectura
- [x] #4 Proveer configuración recomendada y receta de integración de Oxlint / plugins anti-slop para proyectos consumidores del playbook

---

#### [PLAY-014] Filtro anti-slop en UI, copy y diseño: Purpose Test y erradicación de clichés estéticos de IA
- **Prioridad**: `high` | **Tipo**: `feature`

El diseño y contenido generado por IA adolece de patrones cliché repetitivos ("UI slop") que le dan un aspecto genérico y carente de identidad propia:

1. **Clichés estéticos universales:** Fondo oscuro por defecto con orbes de gradiente radial azul-púrpura o cian, efecto glassmorphism en cards, barra de navegación y modales en simultáneo, border-radius excesivo donde cada elemento es una píldora y sombras sobredimensionadas que hacen flotar la pantalla sin jerarquía.
2. **Copywriting inflado e inverosímil:** Métricas fabricadas ("10,000% ROI", "500,000 founders trust us"), titulares hiperbólicos sin sustancia ("Unlock the power of next-gen workflows") y viñetas cargadas de emojis genéricos.
3. **Técnica visual sin propósito:** Aplicación de artificios estéticos únicamente porque "lucen modernos" en lugar de comunicar jerarquía, contraste o accesibilidad.

### Solución
Inspirado en los principios de filtro de `miqdadbadjuber/anti-slop`:
- Establecer que el playbook opera como un **filtro, no una guía de estilo**: no impone colores fijos ni tipografías, pero somete toda decisión visual al **Purpose Test** (*"¿Qué propósito de jerarquía o legibilidad cumple esta técnica?"*). Si la respuesta es solo decorativa o por inercia de IA, se retira.
- Actualizar la skill `.agents/skills/worldclass-product-designer/SKILL.md` para proscribir paletas genéricas de IA y exigir veracidad estricta en el copy (datos reales o no mostrarlos).

**Criterios de Aceptación:**
- [x] #1 Incorporar el 'Purpose Test' en .agents/skills/worldclass-product-designer/SKILL.md para descartar técnicas visuales no justificadas
- [x] #2 Documentar en la skill de diseño la prohibición de clichés de IA (orbes de gradiente azul-violeta por defecto, glassmorphism masivo, sombras desmedidas)
- [x] #3 Establecer la regla de veracidad en copy: prohibir la invención de estadísticas, testimonios y afirmaciones hiperbólicas en componentes o mockups
- [x] #4 Incorporar en .agents/skills/code-level-ux-auditor/SKILL.md la auditoría estática o heurística de sobrecarga decorativa que afecte el contraste y la jerarquía

---

#### [PLAY-015] Compuertas de certificación de QA ejecutables (gate runner) para erradicar la auto-certificación por simulación
- **Prioridad**: `high` | **Tipo**: `feature`

Uno de los mayores puntos de fricción y escepticismo en los marcos de trabajo para agentes de IA es la degradación de las reglas en "teatro cognitivo". Cuando un único agente asume la conversación:
- La instrucción *"un desarrollador nunca se auto-certifica"* suele ser esquivada por el LLM simulando ser el "QA Auditor" en el mismo mensaje o turno de chat.
- Las acceptance criteria se marcan como cumplidas por inercia sin haber corrido los comandos reales de verificación.
- El agente promueve tareas a `ready` de forma discursiva, violando los invariantes del delivery flow.

### Solución
Sustituir la simulación de roles por **compuertas mecánicas ejecutables**:
1. Implementar un runner de verificación unificado (ej. `node scripts/gate-qa.mjs` o `npm run gate:qa`) que ejecute de forma headless y secuencial toda la Pirámide de Verificación:
   - Typechecking estricto (`tsc --noEmit`, 0 errores).
   - Tests unitarios y de integración (`npm test`, 0 fallos).
   - Auditoría estática de UX (`node scripts/audit-ux-code.cjs --strict`).
   - Verificación del archivo de tarea en `backlog/tasks/`: validar que exista, que todos los ACs estén marcados con `- [x]`, que se encuentre en status `review`, y que todas sus dependencias declaradas en `dependencies:` se encuentren en estado `done`.
2. Actualizar la State Machine (`.agents/STATE_MACHINE.md` transición T2) y el Team Playbook (`.agents/TEAM_PLAYBOOK.md`):
   - La transición formal `review` ➔ `ready` **exige evidencia de exit code 0 del gate runner**.
   - Cualquier intento de mover a `ready` por mera declaración textual sin haber ejecutado el runner se considera una transición inválida y no surte efecto.

**Criterios de Aceptación:**
- [x] #1 Implementar un script de compuerta headless (gate runner) que ejecute la Pirámide de Verificación e inspeccione la tarea en disco (ACs completos, status review y dependencias resueltas en done)
- [x] #2 Actualizar .agents/STATE_MACHINE.md (Transición T2) para exigir formalmente la salida exit code 0 del gate runner antes de promover a ready
- [x] #3 Actualizar .agents/TEAM_PLAYBOOK.md y .agents/skills/rigorous-qa-auditor/SKILL.md para consagrar la compuerta ejecutable frente a la auto-certificación en prosa
- [x] #4 Agregar tests automatizados en tests/ que verifiquen el comportamiento y los códigos de salida del gate runner ante fallos de pirámide o dependencias pendientes

---

#### [PLAY-016] Estado 'blocked' con motivo obligatorio y gate de resolución de dependencias
- **Prioridad**: `high` | **Tipo**: `feature`

En el flujo actual de entrega (`STATE_MACHINE.md`), cuando una tarea en desarrollo (`doing`) o planificada (`draft`) no puede avanzar debido a un impedimento externo (definición de producto pendiente, bloqueo de infraestructura, API de terceros rota o dependencia de otra tarea no liberada), no existe una forma normalizada de registrar el bloqueo:

1. **Falseo de métricas y WIP:** Las tareas frenadas quedan artificialmente en `doing`, distorsionando el Work In Progress real del sprint o tablero.
2. **Falta de trazabilidad del impedimento:** Si una tarea se bloquea, suele registrarse en comentarios dispersos o mensajes de chat sin un motivo estructurado y obligatorio, provocando que se olvide por qué se frenó.
3. **Elusión de dependencias por agentes de IA:** Los agentes frecuentemente intentan marcar tareas como terminadas (`ready`) o moverlas a desarrollo sin verificar si las tareas declaradas en `dependencies: [PLAY-XXX]` ya fueron completadas y desplegadas (`done`).

### Solución
1. **Estado canónico `blocked`:**
   - Incorporar `blocked` en la taxonomía de `STATE_MACHINE.md`.
   - Transiciones admitidas:
     - `doing` ➔ `blocked` (bloqueo durante la implementación).
     - `draft` ➔ `blocked` (bloqueo previo al inicio).
     - `blocked` ➔ `doing` / `draft` (desbloqueo).
2. **Invariante de `blocked_reason` obligatorio:**
   - Toda tarea con `status: blocked` **debe** incluir obligatoriamente el campo `blocked_reason: "<motivo detallado>"` en su frontmatter.
   - Dejar el motivo vacío o ausente invalida el estado y falla la validación.
3. **Gate de Desbloqueo y Dependencias:**
   - **Desbloqueo seguro:** Una tarea no puede volver a `doing` si el motivo de bloqueo está vinculado a dependencias que siguen sin resolverse.
   - **Gate de Dependencias para `ready`:** Ninguna tarea puede transicionar a `review` ni certificarse en `ready` si alguna de sus tareas en `dependencies:` no está en estado `done` (o fue formalmente desvinculada/eliminada del array).

**Criterios de Aceptación:**
- [x] #1 Incorporar el status canónico blocked en .agents/STATE_MACHINE.md y documentar sus transiciones y guards
- [x] #2 Definir el invariante estricto de blocked_reason obligatorio en el frontmatter de toda tarea con status: blocked
- [x] #3 Implementar regla de validación en el gate runner / tooling que rechace la transición a ready si alguna tarea en dependencies no está en done
- [x] #4 Implementar regla que impida el desbloqueo (blocked ➔ doing/draft) si sus dependencias bloqueantes no fueron resueltas o eliminadas
- [x] #5 Actualizar docs/BACKLOG.md y .agents/TEAM_PLAYBOOK.md para formalizar el ciclo de vida y gestión de impedimentos
- [x] #6 Agregar tests automatizados en tests/ que verifiquen el bloqueo sin motivo y la validación del árbol de dependencias

---

#### [PLAY-017] Disciplina de ingeniería senior y diff mínimo (ponytail): erradicación de la sobre-ingeniería en Principal Engineer
- **Prioridad**: `high` | **Tipo**: `feature`

Los agentes de IA sufren de una tendencia compulsiva hacia la sobre-ingeniería especulativa ("code inflation"): cuando se les pide un cambio o corrección puntual, con frecuencia introducen adaptadores innecesarios, factories abstractas, helpers no solicitados e instalan dependencias de terceros para resolver operaciones que requieren apenas unas pocas líneas de código nativo. Esto incrementa el consumo de tokens, eleva los costos operativos y amplía el radio de impacto (*blast radius*) de posibles regresiones.

### Solución
Inspirado en la filosofía de `DietrichGebert/ponytail` (*"The lazy senior dev: writes one line, it works"*) y el patrón *Minimal Change Engineer*:
1. **La mejor línea de código es la que no se escribe:** La solución óptima es la que resuelve el 100% de la necesidad con la menor cantidad de código nuevo posible.
2. **Reutilización obligatoria:** Antes de escribir una función auxiliar o instalar un paquete, el agente debe inspeccionar el repositorio en busca de utilidades existentes o aprovechar la standard library del lenguaje.
3. **Mapeo de blast radius antes de editar:** Identificar todos los puntos de contacto que el cambio puede afectar (llamadores, tests, fixtures, exports y configuración) antes de modificar código.
4. **Cierre honesto obligatorio:** Al finalizar cualquier intervención, el agente debe concluir declarando explícitamente en una o dos líneas qué no probó, qué salteó conscientemente y qué riesgos operativos o de compatibilidad quedan para el usuario.

**Criterios de Aceptación:**
- [x] #1 Actualizar .agents/skills/principal-engineer/SKILL.md incorporando la sección 'Disciplina Ponytail & Diff Mínimo Viable' (prohibición de sobre-ingeniería y código especulativo)
- [x] #2 Incorporar el protocolo de búsqueda previa y reutilización de componentes/helpers existentes antes de crear código nuevo o instalar paquetes
- [x] #3 Exigir el mapeo explícito de blast radius en la planificación del Principal Engineer antes de ejecutar ediciones
- [x] #4 Establecer el requisito de cierre honesto en los reportes de desarrollo (declarar lo no probado y riesgos remanentes)
- [x] #5 Actualizar AGENTS.md (Reglas Generales) reforzando la política de diffs mínimos y soluciones simples que escalan

---

#### [PLAY-018] Gate de refinamiento R1 interactivo (grill-me) y glosario ubicuo de dominio (DOMAIN.md) para especificaciones sin asunciones
- **Prioridad**: `high` | **Tipo**: `feature`

El modo de fallo más crítico y destructivo al desarrollar con agentes de IA es la desalineación inicial: cuando el usuario plantea una necesidad, el agente con frecuencia asume silenciosamente requerimientos no especificados, proyecta soluciones sobre premisas falsas y comienza a programar código desconectado de la intención real del producto. Adicionalmente, la ausencia de un vocabulario formal compartido provoca que el agente responda con párrafos inflados y confusos donde un término preciso del negocio bastaría.

### Solución
Inspirado en las skills de ingeniería de `mattpocock/skills` (Total TypeScript):
1. **Gate R1 Interactivo ("Grilling Session"):**
   - Prohibir que una tarea se promueva a `Refined: yes` o ingrese a desarrollo (`doing`) mediante asunción o deducción pasiva del agente.
   - El PM Orchestrator debe someter la propuesta a un interrogatorio estructurado: formular preguntas directas sobre casos de borde, fallbacks ante errores, comportamiento en estados vacíos y tradeoffs de producto antes de dar por cerrado el alcance.
2. **Glosario de Dominio Ubicuo (`DOMAIN.md` / `CONTEXT.md`):**
   - Establecer una convención estándar y liviana para proyectos consumidores del playbook que defina los conceptos clave del dominio (Domain-Driven Design).
   - El agente debe consultar este archivo en cada sesión para utilizar la terminología canónica del proyecto, erradicando la verbosidad excesiva y las alucinaciones conceptuales.

**Criterios de Aceptación:**
- [x] #1 Actualizar .agents/skills/pm-orchestrator/SKILL.md incorporando el protocolo de 'Grilling Session' interactiva para el Gate R1
- [x] #2 Actualizar .agents/STATE_MACHINE.md (Sección 2: Refinement Gate R1) exigiendo resolución explícita de ambigüedades documentada antes de habilitar T0 (draft ➔ doing)
- [x] #3 Documentar en docs/ y en el playbook la convención y plantilla canónica de DOMAIN.md (Glosario Ubicuo y arquitectura de términos)
- [x] #4 Actualizar AGENTS.md instruyendo a los agentes a consultar el glosario de dominio para garantizar concisión y evitar explicaciones redundantes

---

#### [PLAY-019] Subagent-Driven Development (SDD): orquestación de subagentes en contexto fresco con TDD atómico paso a paso
- **Prioridad**: `medium` | **Tipo**: `feature`

Cuando un único hilo de conversación de IA intenta ejecutar un plan de implementación extenso, sufre inevitablemente de fatiga de contexto: olvida instrucciones tempranas, confunde estados, introduce regresiones silenciosas en tests que previamente pasaban y comienza a aplicar parches improvisados.

### Solución
Inspirado en el modelo de *Subagent-Driven Development (SDD)* de `obra/superpowers`:
1. **Planes de implementación a prueba de fallos:**
   - La planificación de una tarea de envergadura debe desglosarse en pasos hiper-atómicos e independientes.
   - Cada paso se redacta bajo la disciplina Red-Green TDD con instrucciones tan explícitas y autocontenidas que un subagente sin contexto histórico pueda ejecutarlo sin desvíos.
2. **Ejecución delegada en contexto limpio:**
   - El agente orquestador (Principal Engineer / Team Lead) no pica todo el código en el hilo principal.
   - Despacha un subagente fresco para resolver el paso atómico N, operando en un espacio de trabajo aislado (articulado con `PLAY-012` mediante `git worktree`).
3. **Supervisión y consolidación continua:**
   - El orquestador revisa el diff producido por el subagente, corre la verificación headless, y únicamente cuando pasa en verde consolida el cambio antes de disparar el paso N+1.

**Criterios de Aceptación:**
- [x] #1 Documentar en .agents/TEAM_PLAYBOOK.md el protocolo de Subagent-Driven Development (SDD) para tareas de alta complejidad
- [x] #2 Definir el estándar de Planes de Implementación atómicos basados en ciclos TDD paso a paso (test fallando ➔ código mínimo ➔ test verde ➔ verificación)
- [x] #3 Articular el flujo de SDD con la directriz de aislamiento por git worktree (PLAY-012)
- [x] #4 Actualizar .agents/skills/principal-engineer/SKILL.md con las directrices de supervisión, revisión de diffs y consolidación secuencial de subagentes

---

#### [PLAY-020] El manifest y su fallback deben tener un unico origen de verdad
- **Prioridad**: `medium` | **Tipo**: `improvement`

Al publicar `gate:qa` en 2.3.0, el gate se desarrollo y se documento en tres skills del nucleo, pero **no se registro en `.playbook-manifest.json`**. Como `planFiles()` arma el plan de instalacion desde `manifest.core`, un consumidor que corria `npx @gripm/playbook sync` recibia skills que le ordenaban correr `npm run gate:qa` en un repo donde ese comando no existia.

El modo de falla es el que PLAY-015 vino a existenciaar, reintroducido por packaging: un agente obediente corre la compuerta, no encuentra nada, y reporta un pass de algo que nunca se ejecuto.

Lo que lo hacia invisible es que ningun check cruzaba las dos direcciones:

1. `validate-repo` verificaba que **lo que esta en el manifest exista en disco**, nunca que **lo que la documentacion menciona este en el manifest**.
2. `FALLBACK_CORE_FILES` en `sync-playbook.mjs` declara "Kept in sync with the manifest by scripts/validate-repo.mjs". Ese check no existia. Era una promesa en un comentario.

Corregido en 2.3.0 con dos checks nuevos (`checkDocsReferenceInstalledFiles` y `checkFallbackParity`). Queda el residuo: los dos siguen siendo **listas separadas que un humano tiene que mantener sincronizadas**, y el unico sintoma de la desalineacion es el check fallando.

**Criterios de Aceptación:**
- [x] #1 Un check de `validate-repo` falla cuando un archivo del manifest no esta en `FALLBACK_CORE_FILES`, y viceversa
- [x] #2 Un check de `validate-repo` falla cuando la capa nucleo documenta un comando `scripts/*` que el manifest no instala
- [x] #3 Un test cubre ambos checks: mutar cualquiera de los dos debe hacerlos caer
- [x] #4 `FALLBACK_CORE_FILES` esta generating desde el manifest, o la duplicacion esta documentada con la razon de existir
- [x] #5 `npm run check:all` en verde

---

#### [PLAY-021] Purificacion del core agnostico a dominio y erradicacion de prefijos hardcodeados
- **Prioridad**: `high` | **Tipo**: `tech_debt`

Auditar y sanear exhaustivamente el framework `@gripm/playbook` para garantizar que sea 100% agnostico al producto, dominio de negocio y stack tecnologico del consumidor:
1. Erradicar sesgos de dominio especificos (terminologia bancaria/financiera como balance negativo, pasivo, patrimonio, API de pagos o importes en ejemplos de invariantes y contratos).
2. Reemplazar esos ejemplos con invariantes universales de ingenieria de software: capacidades de inventario, limites de tasa (rate limiting), consistencia de unidades y normalizacion temporal/bytes.
3. Erradicar prefijos fijos de repositorios especificos (`DEV-XXX`, `PLAY-042`) en la documentacion maestra, plantillas y skills, estandarizandolos hacia `TASK-ID` o `[TASK-ID]`.

**Criterios de Aceptación:**
- [x] #1 El core de skills y reglas no contiene terminos de dominio bancario o financiero especificos
- [x] #2 Los ejemplos de invariantes en `principal-engineer` utilizan abstracciones universales de software (capacidades, conteos, normalizacion de magnitudes)
- [x] #3 Se reemplazan referencias fijas a tareas (`DEV-XXX`) por placeholders canonicos (`TASK-ID` o `[TASK-ID]`)
- [x] #4 El comando de verificacion `npm run validate` ejecuta y aprueba la pureza del core

---

#### [PLAY-022] Erradicacion de remanentes anti-em-dash y estandarizacion de guion simple
- **Prioridad**: `medium` | **Tipo**: `tech_debt`

Erradicacion integral de caracteres em-dash (—, U+2014) y en-dash (–, U+2013) en toda la documentacion, encabezados, plantillas, tablas y ejemplos de `@gripm/playbook`.
El uso de guiones largos artificiales es un cliche de IA que degrada la artesanía del producto y rompe convenciones tipograficas sobrias en herramientas de ingenieria. Esta tarea estandariza el uso exclusivo del guion simple estandar `-` con espacios (` - `).

**Criterios de Aceptación:**
- [x] #1 Escanear todos los archivos `.md`, `.json` y `.mjs` del repositorio eliminando em-dashes y en-dashes
- [x] #2 Reemplazar los hallazgos por el guion estandar simple con espacios (` - `) o guion de flag (`-`)
- [x] #3 Consolidar la regla anti-em-dash en `AGENTS.md` como estandar canónico obligatorio
- [x] #4 Verificar que los 128 tests de la suite del repositorio pasen limpiamente

---

#### [PLAY-023] Protocolo de Peer Discovery dinamico y Handshake sincronico inter-agente
- **Prioridad**: `high` | **Tipo**: `feature`

Institucionalizar el Protocolo Autonomo de Coordinacion Inter-Agente (IACP) en `@gripm/playbook` para eliminar el riesgo de colisiones en el working tree compartido y evitar que el usuario deba actuar como intermediario o pasamanos de IDs de conversacion:
1. **Single Source of Truth en Backlog:** El ítem de tarea es el unico lease del sistema. Al transicionar a `status: doing`, el agente estampa atómicamente en el frontmatter YAML `claimed_by: "<provider>:<session_or_agent_id>"` (ej. `antigravity:<id>`, `cursor:<id>`, `claude-code:<id>`, `human:<id>`) y `worktree: "main"` (o la ruta a su worktree).
2. **Pre-Flight Concurrency Probe Sincrónico:** Antes de modificar codigo o ejecutar comandos destructivos de Git (`git checkout .`, `git restore .`), todo agente realiza un probe sincrónico del backlog buscando tareas activas en `doing` y revisando `git status --porcelain`.
3. **Salvaguarda de Arbol Compartido:** Prohibicion estricta e inviolable de revertir o limpiar el working tree si hay tareas activas en `doing` con un `claimed_by` ajeno.
4. **Handshake Proactivo y Auto-Bifurcacion:** Si se detecta un par activo del mismo harness (`antigravity:`), emite un mensaje directo (`send_message` a `Recipient: claimed_by`). Si es cross-harness (`cursor:`, `claude-code:`, etc.), reconoce la frontera RPC y se auto-aísla mecánicamente en un `git worktree` independiente (`git worktree add -b <branch> ../<repo>-<task>`), permitiendo trabajo 100% paralelo sin interferencias ni fallas.

**Criterios de Aceptación:**
- [x] #1 Se formaliza la transicion T0 en `.agents/STATE_MACHINE.md` incorporando `claimed_by` como guard obligatorio
- [x] #2 Se incorpora el Invariante 9 en `STATE_MACHINE.md` prohibiendo revertir el arbol compartido con tareas en curso ajenas
- [x] #3 Se documenta en `.agents/TEAM_PLAYBOOK.md` el flujo completo de Dynamic Peer Discovery & Handshake Protocol
- [x] #4 Se actualiza `.agents/rules/git-workflow.md` y `AGENTS.md` con el Pre-Flight Concurrency Probe previo a comandos Git
- [x] #5 Se actualiza la skill `principal-engineer` con el protocolo de probe y claiming atomico al entrar a `doing`
- [x] #6 Se estandariza el formato namespaced de `claimed_by` (`<provider>:<id>`) con ruteo intra y cross-harness

---

#### [PLAY-024] Modularizacion estricta, arquitectura previa y limite de 1000 lineas por archivo
- **Prioridad**: `high` | **Tipo**: `feature`

Establecer en el core agnóstico de `@gripm/playbook` las reglas universales de modularización y arquitectura previa para garantizar soluciones robustas, escalables y mantenibles, eliminando de raíz los archivos monolíticos gigantes (God Files / God Objects) que concentran múltiples responsabilidades y actúan como punto único de falla (SPoF) en las aplicaciones:

1. **Principio Architecture-First (Diseño Previo Obligatorio):** Si el proyecto o subsistema no cuenta con una arquitectura definida, o si una tarea introduce un nuevo dominio o flujo, es obligatorio definir y documentar la arquitectura (capas, límites de módulo, contratos e interfaces públicas) antes de comenzar la codificación.
2. **Presupuesto Estricto de Tamaño de Archivo (Hard Ceiling < 1000 LOC):** Ningún archivo de código fuente (módulo, componente, servicio, script o controlador) puede alcanzar o superar las 1000 líneas de código. Si un archivo supera este umbral, constituye un defecto arquitectónico bloqueante que debe descomponerse en submódulos, subcomponentes o adaptadores antes de certificar la entrega.
3. **Anti-God-File & Desacoplamiento de Capas:** Queda prohibido agrupar en una única unidad monolítica la capa de presentación (UI/CLI/handlers), la lógica de dominio pura (invariantes/cálculos), la infraestructura/persistencia (APIs/BD/IO) y la gestión de estado.
4. **Gobierno Transversal en el Playbook:** Integración en las directivas de `AGENTS.md`, el flujo del equipo en `TEAM_PLAYBOOK.md`, la ejecución técnica en `principal-engineer`, el gate R1 en `pm-orchestrator`, y la auditoría de diffs en `rigorous-qa-auditor`.

**Criterios de Aceptación:**
- [x] #1 Formalizar en `AGENTS.md` el principio no negociable de Arquitectura Previa y Modularidad Estricta con limite inviolable de 1000 LOC por archivo
- [x] #2 Incorporar en `.agents/TEAM_PLAYBOOK.md` el requisito de diseño arquitectonico previo en Phase 1 y 3, y la auditoria modular en Phase 4
- [x] #3 Actualizar la skill `principal-engineer` con la directiva tecnica de Architecture-First, limite de 1000 LOC y separacion estricta de capas
- [x] #4 Actualizar la skill `pm-orchestrator` en el Refinement Gate R1 y Grilling Session incorporando la evaluacion arquitectonica previa
- [x] #5 Actualizar la skill `rigorous-qa-auditor` incorporando como causal de rechazo automatico en diff audit archivos > 1000 LOC o God-Files
- [x] #6 Verificar que la suite completa `npm run check:all` pase al 100% manteniendo el core puramente agnostico y sin enlaces rotos

---

#### [PLAY-025] Compuerta mecanica de presupuesto de archivo y visibilidad de limites modulares (check-loc)
- **Prioridad**: `high` | **Tipo**: `feature`

Materializar de forma ejecutable y automatizada la regla de modularidad introducida en PLAY-024 mediante un script de inspeccion de presupuesto de lineas de codigo (`scripts/check-loc.mjs`):

1. **Inspeccion determinista y agnostica:** Escanea archivos de codigo fuente en el proyecto ignorando rutas en `.gitignore`, `.locignore`, `node_modules`, `dist`, `.git` y binarios. Auto-detecta carpetas de codigo fuente (`src/`, `app/`, etc.).
2. **Visibilidad de deuda tecnica y Soberania del PO:** Por defecto opera en modo informativo y de alerta temprana (exit code 0), dando visibilidad clara de archivos que superan las 1000 LOC sin bloquear unilateralmente la entrega de valor urgente. La decision final de refactorizar de inmediato o priorizar en el backlog pertenece soberanamente al PO.
3. **Modo estricto opt-in (`--strict`):** Permite configurar una compuerta bloqueante estricta (exit code 1) para pipelines que requieran rechazo forzoso.
4. **Soft Warning (500 - 999 LOC):** Todo archivo en zona de crecimiento modular emite una advertencia preventiva para impulsar refactorizacion oportuna.
5. **API programatica y CLI:** Expone `checkFileBudget(options)` y CLI ejecutable `node scripts/check-loc.mjs` con flags `--max-lines`, `--warning-lines`, `--path`, `--src`, `--exclude`, `--strict` y `--json`.
6. **Integracion en el Playbook:** Empaquetado en `.playbook-manifest.json` y `FALLBACK_CORE_FILES`, y agregado a los scripts de `package.json` (`npm run check:loc`, `npm run check:loc:strict` y parte de `npm run check:all`).

**Criterios de Aceptación:**
- [x] #1 Script `scripts/check-loc.mjs` implementado con analisis agnostico de lineas, filtrado de .gitignore y .locignore
- [x] #2 Salida diferenciada de aviso de deuda tecnica (>= 1000 LOC) y advertencias preventivas (500-999 LOC). Modo informativo por defecto (exit code 0 para preservar soberania del PO) y modo `--strict` (exit code 1)
- [x] #3 `package.json` incluye script `check:loc`, `check:loc:strict` y lo integra en la suite `check:all`
- [x] #4 El script se incluye en el core del `.playbook-manifest.json` y en `FALLBACK_CORE_FILES` de `sync-playbook.mjs`
- [x] #5 Suite de tests unitarios en `tests/check-loc.test.mjs` validando CLI y API programatica
- [x] #6 `npm run check:all` en verde

---

#### [PLAY-026] Refactorizacion modular de scripts del core bajo umbral preventivo de 500 LOC (scripts/lib)
- **Prioridad**: `high` | **Tipo**: `refactor`

Descomponer los tres scripts principales del repositorio (`scripts/gate-qa.mjs`, `scripts/sync-playbook.mjs` y `scripts/validate-repo.mjs`) que superaban el umbral de aviso preventivo (500 LOC) extrayendo submodulos de alta cohesion en `scripts/lib/` y garantizando 100% de compatibilidad hacia atras en el CLI y API programatica:

1. **Extraccion de submodulos en `scripts/lib/`:**
   - `frontmatter.mjs`: parser de YAML plano, extraccion de ACs y mutacion determinista de frontmatter.
   - `terminal.mjs`: formateo ANSI y cabeceras de terminal.
   - `pyramid.mjs`: resolucion y ejecucion de la Piramide de Verificacion.
   - `task-inspection.mjs`: carga de tareas, resolucion de rutas e inspeccion pura de invariantes.
   - `provenance.mjs`: fetch con reintentos/backoff y verificacion de historial upstream en GitHub.
   - `sync-classifier.mjs`: hashing SHA-256, clasificacion de archivos locales y deteccion de huerfanos.
   - `catalog-validator.mjs`: validacion de catalogos locales `.uxaudit.json`.
   - `doc-checks.mjs`: validacion de links Markdown, frontmatter de skills y vocabulario de estados.
2. **Paridad de instalacion:** Registro de los submodulos runtime requeridos por `gate-qa.mjs` en `.playbook-manifest.json` y `FALLBACK_CORE_FILES`.

**Criterios de Aceptación:**
- [x] #1 Extraer submodulos cohesivos en `scripts/lib/` (`frontmatter.mjs`, `terminal.mjs`, `pyramid.mjs`, `task-inspection.mjs`, `provenance.mjs`, `sync-classifier.mjs`, `catalog-validator.mjs`, `doc-checks.mjs`)
- [x] #2 Reducir `scripts/gate-qa.mjs`, `scripts/sync-playbook.mjs` y `scripts/validate-repo.mjs` por debajo de las 500 LOC eliminando el 100% de los warnings en `node scripts/check-loc.mjs`
- [x] #3 Registrar los submodulos requeridos por el gate en `.playbook-manifest.json` (`core`) y `FALLBACK_CORE_FILES` manteniendo paridad total
- [x] #4 Preservar el 100% de compatibilidad de exports y comportamiento CLI validado por `npm run check:all`

---

#### [PLAY-027] Expansion del motor de auditoria UX con firmas canonicas UX-014 y UX-015
- **Prioridad**: `high` | **Tipo**: `feature`

Ampliar el catalogo canonico de reglas de auditoria estatica de UX (`scripts/ux-rules.json`) de 13 a 15 firmas y sincronizar la documentacion en `.agents/skills/code-level-ux-auditor/SKILL.md`:

1. **`UX-014` (Anti-em-dash / anti-AI cliche in UI or metadata):** Detecta caracteres em-dash (`\u2014`) o en-dash (`\u2013`) en nodos de texto JSX y atributos de UI/metadata para hacer cumplir mecanicamente la regla global de guion simple (` - `).
2. **`UX-015` (Viewport touch zoom lock):** Detecta configuraciones de viewport (`maximum-scale=1`, `user-scalable=no`, `user-scalable=0`, `userScalable: false`) que bloquean el pinch-to-zoom en dispositivos tactiles y violan WCAG 1.4.4.

**Criterios de Aceptación:**
- [x] #1 Incorporar las firmas `UX-014` y `UX-015` con severidad `WARNING` en `scripts/ux-rules.json`
- [x] #2 Documentar `UX-014` y `UX-015` en `.agents/skills/code-level-ux-auditor/SKILL.md` y actualizar `README.md` manteniendo paridad con `validate-repo.mjs`
- [x] #3 Agregar casos de violacion en `tests/fixtures/react-app/src/components/Violations.tsx` y tests unitarios/E2E en `tests/audit-ux.test.mjs` y `tests/e2e-delivery.test.mjs`
- [x] #4 Verificar que `node scripts/audit-ux-code.cjs --list-rules` reporte las 15 firmas canonicas y `npm run check:all` pase en verde

---

#### [PLAY-028] Compuerta mecanica anti-auto-certificacion y resolucion de actor en gate-qa
- **Prioridad**: `high` | **Tipo**: `feature`

Blindar mecanicamente la separacion de contextos entre desarrollo (`doing` -> `review`) y certificacion QA (`review` -> `ready`) en `scripts/gate-qa.mjs`:

1. **Resolucion jerarquica de identidad (`resolveActor`):** Soporta flags CLI (`--by`, `--as`), variables de entorno (`GRIPM_ACTOR`, `QA_ACTOR`, `CLAIMED_BY`), variables de sesion de harness (`ANTIGRAVITY_CONVERSATION_ID`, `CURSOR_SESSION_ID`, `CLAUDE_SESSION_ID`) y fallback `human:<user>`.
2. **Comparacion normalizada (`isSameActor`):** Compara identidades de forma case-insensitive e ignorando espacios marginales.
3. **Bloqueo mecanico en T2 (`inspectTask` & `gate-qa.mjs`):** Si el actor que ejecuta la certificacion coincide con el `claimed_by` registrado en la tarea, `gate-qa.mjs` rechaza la promocion con `exit code 1`, emite el diagnostico `anti-self-certification` y preserva el estado `review` en disco.

**Criterios de Aceptación:**
- [x] #1 Implementar `resolveActor` e `isSameActor` en `scripts/lib/task-inspection.mjs` y re-exportarlos desde `scripts/gate-qa.mjs`
- [x] #2 Bloquear con `exit code 1` en `gate-qa.mjs` e `inspectTask` cualquier intento de certificar una tarea cuando el certificador coincide con `claimed_by`
- [x] #3 Permitir la certificacion (`exit code 0` y promocion a `ready`) cuando el certificador es un subagente QA con contexto limpio o par distinto
- [x] #4 Añadir cobertura de tests unitarios y E2E en `tests/gate-qa.test.mjs` y `tests/e2e-delivery.test.mjs` validando el bloqueo y la aprobacion por pares

---

#### [PLAY-029] Editorial Refactoring and Technical English Standardization for Core and Skills
- **Prioridad**: `high` | **Tipo**: `refactor`

Complete editorial refactoring of gripm-playbook core to eliminate language mixing (Spanglish), replace informal prompt-engineering buzzwords with industry-standard terminology, and clean unparametrized template leftovers.

**Criterios de Aceptación:**
- [x] #1 All core framework files (AGENTS.md, TEAM_PLAYBOOK.md, STATE_MACHINE.md, core skills) are written strictly in idiomatic, professional technical English.
- [x] #2 Zero mixed-language paragraphs or residual Spanish sentences in core guidelines and skills.
- [x] #3 Role names and skills standardized (e.g. product-designer, qa-auditor) across manifest, scripts, and documentation.
- [x] #4 Esoteric slang removed and replaced with standard engineering practices (Honest Scope & Residual Risk, Refinement Gate).
- [x] #5 All template placeholders ([PROJECT_NAME], [e.g., ...]) cleaned and parametrized.
- [x] #6 npm run check:all passes with 0 errors in gripm-playbook.

---

#### [PLAY-030] Zero-Friction Onboarding CLI and Multi-Harness Adapters (Cursor, Claude Code, Antigravity)
- **Prioridad**: `high` | **Tipo**: `feature`

Implementar un onboarding sin friccion (`npx @gripm/playbook init`) con adaptadores nativos para los tres harnesses que el framework ya declara soportar (Antigravity, Cursor, Claude Code). Es el item que ejecuta los pasos 2 y 3 del plan original de "golden repo" y cierra el ultimo pendiente del paso 1.

Por que importa: el playbook promete compatibilidad universal pero hoy su arquitectura depende conceptualmente de `invoke_subagent`, que es primitiva exclusiva del runtime de Antigravity. Un usuario de Cursor o Claude Code no tiene camino de ejecucion. Ademas, la adopcion manual hoy exige clonar el repo y copiar carpetas a mano.

Historial: creada el 2026-10-20 por una sesion que se interrumpio por cuota, sin refinement y sin ACs verificables. Re-refinada el 2026-10-21 al tomar control del repo.

**Criterios de Aceptación:**
- [x] #1 `npx @gripm/playbook init` ejecuta un asistente interactivo que pregunta harnesses (multi-seleccion), stack principal e integracion opcional del Board, y expone un flag no interactivo equivalente al `--yes` que ya tiene `sync-playbook.mjs`.
- [x] #2 Deteccion automatica de stack: el init lee el `package.json` del proyecto destino y propone los stack packs disponibles de `.agents/stacks/` (react, mobile, pwa), dejando al usuario confirmar o sobreescribir.
- [x] #3 Genera los archivos nativos del harness elegido: `.agents/` (Antigravity), `.cursor/rules/*.mdc` (Cursor) y `CLAUDE.md` (Claude Code).
- [x] #4 El `AGENTS.md` que llega al consumidor viene parametrizado con el nombre, stack e idioma reales elegidos en el asistente: no queda ningun texto-guia tipo `[PROJECT_NAME]` o `[Specify Language, ...]` sin resolver.
- [x] #5 Existe un test e2e que corre el init no interactivamente en un directorio temporal y afirma que los archivos generados existen y son validos (extiende `tests/e2e-delivery.test.mjs`).
- [x] #6 `npm run check:all` pasa con 0 errores y el nuevo archivo del CLI esta registrado en `.playbook-manifest.json` y en `FALLBACK_CORE_FILES` con paridad verificada.

---

#### [PLAY-031] Diagrama del loop de entrega en el primer fold del README (sin vhs)
- **Prioridad**: `medium` | **Tipo**: `improvement`

El valor central del framework (dev tilda ACs -> QA ciego certifica -> item en `ready`) no es visible en un solo vistazo en el README: un lector tiene que leer varios documentos para entender el loop de entrega. Este item agrega un diagrama ASCII estático en el primer fold que muestra el ciclo de vida de un backlog item desde `draft` hasta `done`, destacando el gate ciego de QA como paso crítico entre `review` y `ready`. No depende de herramienta alguna (vhs/ffmpeg/gif no están disponibles en la máquina), solo diagramado ASCII.

**Criterios de Aceptación:**
- [x] #1 Diagrama ASCII de 5 estados (draft → doing → review → ready → done) ubicado en el primer fold del README, justo después del diagrama de arquitectura "Hub Orchestrator + Sub-Agentes".
- [x] #2 El diagrama usa solo caracteres box-drawing y flechas ASCII, sin binarios, sin GIF/VHS, sin herramientas externas.
- [x] #3 El diagrama resalta el gate ciego de QA (revisión en contexto aislado por sub-agente) como la flecha crítica que separa `review` de `ready`.
- [x] #4 PLAY-030 está desvinculado (removed de `dependencies:`), pues el gate exige dependencias en `done` y PLAY-030 está en `ready`.
- [x] #5 `npm run check:all` pasa (332/332 tests, 72 suites) sin errores de Lint ni LOC.
- [x] #6 `node scripts/gate-qa.mjs submit PLAY-031` completa y pasa a `review`.
- [x] #7 QA ciego en sub-agente limpio certifica a `ready` con 7 ACs mínimas (loop visible, gate destacado, sin vhs, PLAY-030 desvinculado).

---

#### [PLAY-032] Mencion breve de gripm Board como complemento en el README
- **Prioridad**: `medium` | **Tipo**: `improvement`

El README no menciona `gripm` en ninguna linea. Quien aterriza aqui no tiene por que saber que existe un board visual que lee el mismo backlog. Se agrega **una sola linea** de mencion, como complemento opcional.

**Rescoping decidido por el PO durante la implementacion.** El alcance original pedia una seccion completa con tabla comparando ambos proyectos y explicando la integracion. El PO lo rechazo: el README del playbook debe concentrarse en el playbook, sin enroscarse, y `gripm` solo vale como una mencion de complemento. La seccion grande se elimino y se dejo un unico tip. El PO dejo ademas claro que este repo no debe ir al repo de `gripm` a investigar: el foco es el playbook.

**Criterios de Aceptación:**
- [x] #1 El README menciona `gripm` como board visual opcional que lee el mismo backlog, en una sola linea (un tip), sin seccion ni tabla comparativa.
- [x] #2 La mencion no califica a ninguno de los dos proyectos de confuso ni establece una comparacion extensa; el texto se mantiene breve.
- [x] #3 `npm run check:all` pasa con 0 errores y el unico link agregado (a `https://github.com/pablojavierrodriguez/gripm`) es externo, por lo que no introduce rutas relativas que el validador tenga que resolver.

---

#### [PLAY-034] La instruccion `npm run gate:qa` falla para el consumidor (el alias npm no esta instalado)
- **Prioridad**: `medium` | **Tipo**: `bug`

Los archivos de instrucciones que el consumidor recibe le ordenan correr `npm run gate:qa <ID>`, pero ese comando no existe en su repo. El alias npm `gate:qa` vive en `package.json`, y `package.json` **no esta en `manifest.core`**, por lo que `sync` nunca lo instala en el repo del consumidor.

Verificado en el repo fuente:

- `scripts/gate-qa.mjs` **si esta en `core`**, junto con sus modulos `lib/frontmatter.mjs`, `lib/pyramid.mjs`, `lib/task-inspection.mjs` y `lib/terminal.mjs`. El archivo del gate si llega al consumidor.
- `package.json` **no esta en `core`** (esta fuera del manifest), asi que el script npm `gate:qa` no se instala.
- `scripts/init.mjs` (PLAY-030) **no inyecta** el script en el `package.json` del consumidor; solo lo lee para detectar stack.

Resultado: un consumidor que sigue la instruccion recibe `Missing script: gate:qa`. Es un defecto documental y de packaging a la vez: la doc invoca un alias que nunca se instala, aunque el binario subyacente si esta presente. `node scripts/gate-qa.mjs <ID>` funcionaria hoy mismo.

Este defecto quedo fuera de PLAY-029 (alcance editorial) y de PLAY-030 (alcance CLI/adaptadores): los adaptadores nuevos si usan `node scripts/gate-qa.mjs`, pero `AGENTS.md` y los skills del core conservan la instruccion vieja.

**Criterios de Aceptación:**
- [x] #1 Resolucion elegida y registrada: **(a) sustituir la invocacion npm por la forma `node`** en la documentacion cara al consumidor. `npm run gate:qa <ID>` pasa a `node scripts/gate-qa.mjs <ID>`. Se descarto (b) inyectar el script en el `package.json` del consumidor porque exige mutar un archivo que es del consumidor, con riesgo de pisar sus propios scripts.
- [x] #2 La sustitucion se aplica a **todas** las invocaciones de `npm run gate:qa` en los archivos que el consumidor recibe (`AGENTS.md`, `.agents/TEAM_PLAYBOOK.md`, `.agents/STATE_MACHINE.md`, skills `pm-orchestrator` y `qa-auditor`) **y** en `README.md`. El README entra en el alcance: aunque documenta este repo, es lo primero que lee un consumidor en npm/GitHub y ya usa la forma `node` en L116-117 (`node scripts/gate-qa.mjs start`), asi que unificarla elimina la inconsistencia interna.
- [x] #3 `npm run audit:ux` (TEAM_PLAYBOOK L46) sufre la misma causa raiz y se sustituye igual por `node scripts/audit-ux-code.cjs`, porque `scripts/audit-ux-code.cjs` si esta en `core`. Dejarlo roto al lado del gate arreglado seria incoherente.
- [x] #4 Las referencias de **concepto** (no invocacion) al gate quedan como `gate:qa`: `AGENTS.md` L36 (`still requires gate:qa`), `pm-orchestrator` L115 y `README` L62. Cambiarlas produciria prosa ilegible (`requires node scripts/gate-qa.mjs`).
- [x] #5 La sustitucion arregla **unicamente** comandos cuyo binario esta en `core`. `npm run validate` en `.agents/TEAM_PLAYBOOK.md` L142 (un archivo que el consumidor **si** recibe) comparte la misma causa raiz pero **no** admite el fix: `scripts/validate-repo.mjs` no esta en `core`, asi que ni `npm run validate` ni `node scripts/validate-repo.mjs` funcionarian en el consumidor. Queda **fuera** y se reporta como hallazgo que necesita decision propia (anadir el binario al core, o dejar de prometerlo).
- [x] #6 `README.md` se aclara como **landing page de npm, no archivo instalado**: no esta ni en `core` ni en `preserved`. Sus comandos (`validate`, `gate:review`, `check:all`, `audit:ux:strict`, `audit:ux:baseline`) **si** funcionan en este repo. Solo se unifico `npm run gate:qa` a la forma `node` por consistencia interna con L116-117, que ya usan `node scripts/gate-qa.mjs start`/`unblock`. `gate:review` y `check:all` permanecen en forma npm porque su binario no esta en core: unificarlos daria una falsa apariencia de que el README es 100% copy-pasteable para el consumidor, cosa que no es.
- [x] #7 `npm run build` (AGENTS L63, TEAM_PLAYBOOK L145, README L272) **no** se toca: es el build del propio proyecto del consumidor, no un script de gripm.
- [x] #8 `npm run check:all` pasa con 0 errores tras el cambio (332/332 tests, 72 suites).
- [x] #9 **Fix post-QA (invariante T_ready-immutability).** La QA ciego (subagente limpio) hallo que el barrido inicial subescalo el alcance: el inventario solo cubrio los 5 archivos donde aparecia `npm run gate:qa`, no **todos** los archivos core. Se reabrio el item a `doing` (STATE_MACHINE L77: un fix post-QA invalida la certificacion y debe recorrer T1/T2 de nuevo) y se sustituyeron las 4 lineas restantes de **mismo defecto** en archivos que el consumidor **si** recibe y cuyo binario **si** esta en core: `.agents/skills/code-level-ux-auditor/SKILL.md` L26 (forma `node scripts/audit-ux-code.cjs --update-baseline`, ya usada en L21-25) y L32 (prosa), mas `scripts/audit-ux-code.cjs` L1009 y L1204 (la **propia salida del binario** instruia `npm run audit:ux` al consumidor).
- [x] #10 **Hallazgos reportados, deliberadamente fuera de este fix** (mismo origen: `package.json` no viaja al consumidor, pero no admiten sustitucion porque su binario no esta en core o es ambiguo): (a) `npm run validate` en `TEAM_PLAYBOOK.md` L142; (b) `npm run lint:anti-slop` en `principal-engineer/SKILL.md` L215, que ademas no existe ni en este `package.json` (lectura ambigua: recomendacion de CI propia del consumidor vs script ausente); (c) en `README.md` (landing page, no instalado) `validate`, `gate:review` y `check:all`. Todos requieren decision propia del PO, no se resuelven por sustitucion.

---

#### [PLAY-035] Higiene residual del CHANGELOG: entradas en espanol y referencia literal de em-dash
- **Prioridad**: `low` | **Tipo**: `improvement`

La revision de `dev` tras el commit `2b56029` ("eradicate em-dash from live files, english 2.6.0 entries") dejo dos residuos verificables en `CHANGELOG.md`, ambos fuera del alcance de ese commit pero inconsistentes con el estandar que el propio repo declara:

1. **Dos entradas en espanol sin traducir** en la seccion `2.0.1`:
   - L186: "- **Saneamiento P0 de skills de stacks**: Eliminadas todas las referencias residuales..."
   - L187: "- **Formato regional estandar**: Reemplazado el valor invalido `'regional-locale'`..."
   El commit tradujo las entradas espanolas de `2.6.0` pero no hizo un barrido completo del archivo.

2. **Una referencia literal a em-dash/en-dash** en L58 (entrada `PLAY-022`): "`Replaced artificial AI em-dashes (—) and en-dashes (–) with standard hyphens`". Es una meta-referencia entre backticks a los caracteres que la regla combate, no prosa con guion prohibido. Es defendible, pero cualquier escaneo automatico futuro la cazaria.

El file es la fuente de la que salen las notas de release publicadas (ver PLAY-036), asi que lo que quede aqui termina en GitHub/npm.

**Criterios de Aceptación:**
- [x] #1 Las lineas L186 y L187 de `CHANGELOG.md` quedan en ingles tecnico, fiel al sentido original (saneamiento P0 de skills de stacks; formato regional BCP-47 `es-ES`), sin tocar el resto de la seccion 2.0.1.
- [x] #2 Decision del PO registrada sobre L58: adoptada la Opcion A (se reescribe para erradicar caracteres literales U+2014/U+2013, usando texto descriptivo 'em-dash and en-dash characters' y separador estandar '-' con espacios).
- [x] #3 Decidida la politica sobre L58: erradicacion total de caracteres literales en live docs sin necesidad de exenciones; la norma se mantiene rigurosa para toda documentacion y releases futuros.
- [x] #4 `npm run validate` y `npm test` en verde tras el cambio.

---

#### [PLAY-037] Portabilidad de paquete: CLI unificado, resolucion dinamica de raiz y desacople de piramide para proyectos consumidores
- **Prioridad**: `high` | **Tipo**: `improvement`

`@gripm/playbook` no puede utilizarse como paquete en proyectos consumidores por acoplamientos internos a rutas relativas fijas y llamadas de red forzadas:

1. **Rutas fijadas a `__dirname/..`:** `scripts/gate-qa.mjs`, `scripts/audit-ux-code.cjs` y `scripts/gate-review-items.mjs` calculan su raíz como `path.resolve(__dirname, '..')`. Cuando corren instalados dentro de `node_modules/@gripm/playbook/`, intentan inspeccionar tareas y correr validaciones dentro de la carpeta del propio paquete instalado y no en la del proyecto consumidor (`process.cwd()`).
2. **Descarga obligatoria de GitHub en `init` y `sync`:** `scripts/sync-playbook.mjs` y `scripts/init.mjs` descargan archivos desde `raw.githubusercontent.com` por defecto, ignorando que el paquete instalado ya contiene todos los archivos canónicos. Esto rompe entornos offline, CI/CD cerrados, proxies y versiones fijas.
3. **Bloqueo de la Pirámide de Verificación:** `gate-qa.mjs` exige que el `package.json` del consumidor declare `gate:review` y `audit:ux:strict` como pasos bloqueantes. Un proyecto consumidor no tiene estos scripts internos, por lo que `gate-qa` falla siempre con código 1.
4. **Falta de CLI router y binarios expuestos:** `package.json` solo tiene `playbook` atado a `sync-playbook.mjs` que solo acepta `init`. No hay binarios expuestos para `gate-qa`, `audit-ux`, `check-loc` ni subcomandos en el CLI.
5. **Instrucciones hardcodeadas a `node scripts/...`:** Skills, adaptadores y documentación instruyen ejecutar `node scripts/gate-qa.mjs <ID>`, obligando a copiar los scripts al proyecto consumidor en vez de permitir consumirlos como paquete npm.
6. **Residuo `human:pablo`:** `.agents/TEAM_PLAYBOOK.md` incluye el usuario `pablo` en los ejemplos de lease.

Este item implementa el Modelo Hibrido: el consumidor puede optar por usar `@gripm/playbook` como dependencia de npm pura mediante su CLI (`npx playbook <cmd>` o `npx gate-qa`) o sincronizar archivos a su repositorio, funcionando de manera transparente y desacoplada en ambos casos.

**Criterios de Aceptación:**
- [x] #1 **Resolucion dinamica de raiz en herramientas centrales:** `scripts/gate-qa.mjs`, `scripts/audit-ux-code.cjs` y `scripts/gate-review-items.mjs` resuelven la raiz del proyecto de trabajo dinamicamente (`--root`/`--cwd`, `process.env.GRIPM_ROOT`/`process.env.AUDIT_UX_ROOT`, o `process.cwd()`), permitiendo su ejecucion correcta desde `node_modules/@gripm/playbook/` contra el proyecto consumidor.
- [x] #2 **Zero-network local fallback en `init` y `sync`:** Si no se pasa `--remote` ni `--source`, `scripts/sync-playbook.mjs` e `init.mjs` detectan automaticamente los archivos del paquete local instalado (mediante `.playbook-manifest.json` en la raiz del paquete) y sincronizan localmente sin llamadas a GitHub ni requerir conexion a internet.
- [x] #3 **Desacople autonomo de la Piramide de Verificación en `gate-qa`:** Si el `package.json` del proyecto consumidor carece de scripts `audit:ux:strict` o `gate:review`, `gate-qa` ejecuta el motor empaquetado directamente (auditoria UX en modo estricto y validacion del backlog local) sin fallar falsamente por ausencia de scripts en `package.json`.
- [x] #4 **CLI Router unificado y binarios de paquete:** `package.json` expone los binarios `playbook`, `gripm-playbook`, `gate-qa`, `audit-ux` y `check-loc`. `scripts/sync-playbook.mjs` funciona como despachador para los subcomandos `init`, `sync`, `gate`, `audit`, `check-loc` y `review`.
- [x] #5 **Limpieza de residuos y adaptacion documental:** Se erradica la referencia `human:pablo` de `.agents/TEAM_PLAYBOOK.md` (sustituida por `human:<username>`). La documentacion y adaptadores (`CLAUDE.md`, `.cursor/rules/*.mdc`) instruyen la ejecucion canonica mediante el CLI `playbook gate <ID>` (y alias `gate-qa <ID>`), manteniendo retrocompatibilidad con la invocacion directa `node scripts/gate-qa.mjs <ID>`.
- [x] #6 **Suite de pruebas de portabilidad:** Se agrega `tests/package-portability.test.mjs` verificando la ejecucion de `gate-qa` y `audit-ux` simulando una instalacion en `node_modules`, la sincronizacion local zero-network, los subcomandos del router CLI y el paso de la piramide en un proyecto consumidor limpio.
- [x] #7 **Validacion integral del repositorio:** `npm run check:all` pasa con 0 errores (332+ tests, validacion de manifiesto y paridad de reglas).

---

#### [PLAY-038] El trigger de aislamiento es demasiado estrecho: GIT_RULES no cubre un arbol sucio sin lease
- **Prioridad**: `high` | **Tipo**: `bug`

`scripts/lib/adapters.mjs:39-47` define `GIT_RULES`, el set de cinco reglas de git que el init inyecta en todo consumidor. Dos de ellas forman un par incompleto:

- Regla 4: *"A `doing` item carrying a foreign `claimed_by` owns the tree: never revert or clean it."* Es **prohibicion negativa**: no hagas nada destructivo.
- Regla 5: *"Parallel work runs in isolated worktrees: `git worktree add -b <branch> ../<repo>-<task>`."* Es **mecanismo**: aislate y trabaja igual.

Ninguna de las dos dice **cuando se pasa de modo normal a modo aislado**. El unico disparador explicito es la regla 4, y su condicion es estrecha: un item en `doing` con `claimed_by` ajeno.

Incidente medido (2026-10-22, repo gripm): otro agente dejo **seis** archivos stageados (`A `) en `backlog/tasks/` con `status: ideas` y **sin `claimed_by`**. Ninguna condicion existente disparo, asi que el agente en curso se quedo en el arbol principal y lucho contra el indice compartido durante toda la certificacion de DEV-326.

El costo no fue cosmético. `BACKLOG.md` es un agregado que referencia **todas** las tareas del arbol, y el Backlog Guard exige que no referencie tareas fantasma. Con seis tareas ajenas sin commitear, **todo** commit que incluyera el consolidado quedaba bloqueado. El agente tuvo que decidir entre incluir trabajo ajeno en su commit o romper la coherencia del consolidado, y pregunto al PO porque no habia regla que lo resolviera.

Un worktree lo habria resuelto limpiamente: la rama sale de HEAD, no ve las tareas sin trackear del otro agente, y su `BACKLOG.md` no las referencia. **La cura ya esta escrita en la regla 5; lo que falta es el disparador que active la regla 5.**

La condicion actual tampoco detecta la situacion real de colision. `claimed_by` es un lease declarado; los archivos stageados en el indice de git son **estado observable**. El segundo es una evidencia mas fuerte que el primero: no requiere que el otro agente haya sido disciplinoso, solo que exista.

**Criterios de Aceptación:**
- [x] #1 `GIT_RULES` declara un disparador adicional: archivos `A ` o `M ` en `git status --porcelain` que el agente en curso no creo.
- [x] #2 Ese disparador **obliga al aislamiento en worktree** (regla 5), no solo a no revertir (regla 4). La prohibicion negativa no basta: deja al agente paralizado en el arbol principal, que es exactamente lo que ocurrio.
- [x] #3 La regla distingue explicitamente entre cambios propios del agente en curso y suciedad ajena. El disparador no puede exigir aislamiento ante los propios cambios.
- [x] #4 `AGENTS.md` y `.agents/TEAM_PLAYBOOK.md` reflejan el mismo disparador **solo si** reproducen esta seccion. Verificar antes de tocar: si la norma vive unicamente en `GIT_RULES`, no duplicarla.
- [x] #5 `npm run check:all` sale con 0 tras el cambio (validate + check:loc + test).

---

#### [PLAY-040] El gate escribe la transicion de estado sin regenerar el consolidado y el commit siguiente se rechaza
- **Prioridad**: `high` | **Tipo**: `bug`

`scripts/gate-qa.mjs` escribe `status` en disco en dos transiciones: T1 (`submit`, doing a review) y T2 (review a ready), ambas via `mutateTaskFrontmatter`. **Ninguna de las dos regenera `BACKLOG.md`.**

El Backlog Guard del consumidor (`verify-backlog-sync.js`, hook `--hook`) rechaza cualquier commit cuyo `BACKLOG.md` este desfasado respecto a las tareas. Asi que el flujo mecanico completo queda roto en un punto que nadie documenta:

```
node scripts/gate-qa.mjs submit DEV-326    -> escribe doing a review. EXIT 0.
npm run backlog:check                      -> EXIT 1: BACKLOG.md desactualizado.
npm run backlog:sync                        -> EXIT 0.
node scripts/gate-qa.mjs DEV-326           -> GATE PASSED, escribe ready. EXIT 0.
npm run backlog:check                       -> EXIT 1: BACKLOG.md desactualizado otra vez.
npm run backlog:sync                        -> EXIT 0.
git commit                                  -> recien aqui pasa el guard.
```

Medido en gripm el 2026-10-22 durante la certificacion de DEV-326: **dos** syncs de mas, ambos provocados por el propio gate. El gate es la herramienta que certifica que el repo esta listo para commitear, y cada corrida lo deja en un estado que el hook de pre-commit rechaza.

El punto ciego es estructural. El gate escribe un archivo y no conoce el consolidado que lo refleja. No es un bug de implementacion puntual: es que la transicion y el consolidado estan en capas que no se hablan.

**Nota de alcance:** `scripts/gate-qa.mjs` tiene 147 lineas de diff sin commitear en este repo por PLAY-037 (portabilidad de rutas para consumidores). Ese trabajo es ortogonal a este hallazgo, pero comparte archivo: verificar el estado antes de tocar, y re-sincronizar el alcance si PLAY-037 lo reubica.

**Criterios de Aceptación:**
- [x] #1 Despues de que el gate escribe una transicion (`submit` o T2), `npm run backlog:check` sale con codigo 0 sin que el usuario corra `backlog:sync` a mano.
- [x] #2 La regeneracion del consolidado ocurre solo si la verificacion previa paso, respetando el contrato ya documentado en `verify-backlog-sync.js:363-365`: un commit rechazado nunca deja el consolidado reescrito como efecto secundario.
- [x] #3 El gate no stagea nada. La regla "un hook verifica, no muta" aplica tambien a la CLI: regenerar el consolidado no equivale a `git add BACKLOG.md`.
- [x] #4 Un consumidor sin `BACKLOG.md` en disco (proyecto que aun no lo genero) no recibe error: la regeneracion se omite en silencio.
- [x] #5 `npm run check:all` sale con 0 tras el cambio.

---

#### [PLAY-041] Zero-Clutter architecture: confinamiento de metadata en .gripm/, erradicacion de scripts/ en consumidor y auto-poda de huérfanos
- **Prioridad**: `high` | **Tipo**: `feature`

Hoy `@gripm/playbook` invade la raíz del repositorio consumidor y el directorio `scripts/`:
1. **Contaminación de raíz:** Planta archivos sueltos como `.playbook-lock.json`, `.uxaudit.json`, `audit-ux-baseline.json`, `.locignore` y `.playbook-backups/`.
2. **Contaminación de `scripts/`:** Copia 16 archivos ejecutables de infraestructura a `scripts/` del consumidor, pese a que PLAY-037 ya implementó la ejecución vía binarios de npm en `node_modules`.
3. **Duplicación por renombre de skills:** Cuando el framework renombra un skill (como en PLAY-029: `worldclass-product-designer` a `product-designer`), el sincronizador deja ambos directorios vivos en `.agents/skills/`, forzando al desarrollador a borrar archivos obsoletos a mano.

### Principio Arquitectónico Zero-Clutter

1. **La raíz le pertenece al proyecto:** Solo conviven `package.json` y `AGENTS.md`.
2. **Metadata confinada en `.gripm/`:** Lockfiles, backups, baselines y configs del framework viven en `.gripm/`. Si el proyecto usa `gripm-board`, comparte naturalmente esa misma carpeta. Si no usa el board, la carpeta sigue siendo el namespace limpio de la suite.
3. **Ejecución desde `node_modules`:** Cero scripts copiados a `scripts/` del consumidor.
4. **Auto-poda segura de huérfanos:** Archivos y directorios de skills obsoletos que fueron instalados por el playbook y no presentan modificaciones del usuario se eliminan automáticamente durante el sync sin dejar carpetas duplicadas.

**Criterios de Aceptación:**
- [x] #1 **Metadata confinada en `.gripm/`:** `scripts/sync-playbook.mjs` lee y escribe el lockfile en `.gripm/playbook-lock.json` y los backups en `.gripm/backups/`. Mantiene retrocompatibilidad leyendo `.playbook-lock.json` en la raíz si existe y migrándolo a `.gripm/`.
- [x] #2 **Auditor UX y Check-LOC confinados:** `scripts/audit-ux-code.cjs` y `scripts/check-loc.mjs` buscan `.uxaudit.json`, `audit-ux-baseline.json` y `.locignore` preferentemente dentro de `.gripm/`, manteniendo fallback a la raíz del proyecto.
- [x] #3 **Erradicación de `scripts/` en consumidor:** `sync-playbook.mjs` e `init.mjs` no copian archivos ejecutables a la carpeta `scripts/` de proyectos consumidores. La pirámide y los scripts de `package.json` invocan exclusivamente los binarios CLI (`playbook gate`, `playbook audit`, etc.).
- [x] #4 **Auto-poda de huérfanos y renombres obsoletos:** `sync-playbook.mjs` elimina automáticamente archivos de `.agents/` presentes en el lockfile anterior que ya no formen parte del plan instalado, siempre que no registren modificaciones locales (`customizations`). Si el directorio contenedor queda vacío, es removido de disco.
- [x] #5 **Limpieza de scripts legados en actualización:** Durante `sync`, si existen scripts en `scripts/` del consumidor que coincidan con los hashes canónicos del framework, se eliminan limpiamente para retirar la deuda técnica previa.
- [x] #6 **Suite de pruebas de migración e2e:** `tests/` incluye tests que validan una actualización desde un repositorio con estructura legada (scripts en raíz y skills con nombre antiguo), verificando que la raíz quede limpia, `.gripm/` contenga el lockfile y los skills viejos sean podados sin duplicaciones.
- [x] #7 **Validación total:** `npm run check:all` pasa con 0 errores y 100% de coherencia.

---

#### [PLAY-042] Resolver contradicciones y bugs criticos en skills de stacks y auditoria
- **Prioridad**: `high` | **Tipo**: `bug`

Existen contradicciones directas entre los skills de stacks y las reglas deterministas del core, ademas de un script fantasma que causa fallos inmediatos:
1. `mobile-ux-design/SKILL.md` prescribe `pb-20` / `pb-24` para contenedores desplazables con barras inferiores fijas, cuando la regla `UX-006` en `scripts/ux-rules.json` penaliza explicitamente `pb-20` y `pb-24` como WARNING y exige `pb-32` + `safe-area-inset-bottom`.
2. `ui-radix-tailwind/SKILL.md` utiliza `text-[9px]` y `text-[10px]` en su seccion de modales oficiales, lo que dispara la regla `UX-011` (`Arbitrary font size outside the canonical type scale`) en `audit-ux-code.cjs`, y hardcodea clases de color (`text-slate-800 dark:text-slate-200`) violando su propia regla de tokens semanticos.
3. `pwa-assets-audit/SKILL.md` instruye ejecutar `node .agents/skills/pwa-assets-audit/scripts/validate-manifest.mjs`, pero dicho script no existe en el repositorio ni en `.playbook-manifest.json`. Ademas, `scripts/validate-repo.mjs` no audita los scripts referenciados dentro de `.agents/stacks/`.

**Criterios de Aceptación:**
- [x] #1 Corregir `mobile-ux-design/SKILL.md` para prescribir `pb-32` + `env(safe-area-inset-bottom)` alineado con `UX-006`.
- [x] #2 Corregir `ui-radix-tailwind/SKILL.md` eliminando `text-[9px]` / `text-[10px]` y sustituyendo colores hardcodeados por tokens semanticos del design system.
- [x] #3 Proveer la implementacion real de `validate-manifest.mjs` (o registrarla e instalarla via manifest) o corregir la invocacion documental en `pwa-assets-audit/SKILL.md`.
- [x] #4 Extender `scripts/validate-repo.mjs` en `checkDocsReferenceInstalledFiles()` para que inspeccione tambien los archivos de documentacion dentro de `.agents/stacks/`.
- [x] #5 `npm run validate` y `npm test` pasan en verde con 0 errores.

---

#### [PLAY-043] Purga de project bleed y acoplamiento residual en stack packs de react y mobile
- **Prioridad**: `high` | **Tipo**: `chore`

Los stack packs (`.agents/stacks/react`, `.agents/stacks/mobile`) presentan fuga de contexto y acoplamiento ("project bleed") procedente de una aplicacion SaaS anterior sin sanitizar:
- `forms-rhf-zod/SKILL.md` hace referencia a una skill inexistente `i18next-namespaces`, asume rutas fijas `src/locales/es.json` e importa helpers (`formatThousandsInput`, `parseThousandsInput`) desde `@/lib/utils` sin proveer su definicion.
- `ui-radix-tailwind/SKILL.md` impone que existe un componente preexistente `src/components/ui/date-range-picker.tsx`, muestra queries acopladas a columnas como `"starts_at"`, y prescribe modales rigidos propios de un producto especifico.
- `mobile-ux-design/SKILL.md` prescribe hooks internos como `usePWAInstall` y estilos CSS ultra-acoplados (`.peer[data-state="expanded"] ~ div .btn-action-label`) pertenecientes al layout de una aplicacion externa.

Es necesario sanitizar estos skills para que provean patrones canonicos autocontenidos y portables para cualquier proyecto React / Mobile.

**Criterios de Aceptación:**
- [x] #1 Sanitizar `forms-rhf-zod/SKILL.md` removiendo la dependencia a la skill inexistente `i18next-namespaces` y encapsulando los helpers de entrada de miles/decimales o documentando su contrato generico.
- [x] #2 Desacoplar `ui-radix-tailwind/SKILL.md` de rutas fijas inexistentes (`date-range-picker.tsx`) convirtiendo los ejemplos en snippets autocontenidos y neutrales.
- [x] #3 Eliminar selectores CSS hiper-especificos y referencias de hooks privados de `mobile-ux-design/SKILL.md`.
- [x] #4 Estandarizar el idioma de los skills de stacks al estandar ingles (alineado con los demas skills del playbook) o documentar formalmente su alcance.
- [x] #5 `npm run validate` ejecuta y aprueba con 0 errores.

---

#### [PLAY-044] Unificacion de formato de tareas y reduccion de duplicacion DRY en documentacion troncal
- **Prioridad**: `medium` | **Tipo**: `refactor`

Existen dos problemas de coherencia y sobrecarga de contexto en la documentacion troncal del framework:
1. En `pm-orchestrator/SKILL.md` (lineas 33-37) y `STATE_MACHINE.md` (lineas 46-50), los ejemplos de refinamiento muestran un formato plano markdown (`### [BACKLOG-001] ... - **Status:** draft`), mientras que `gate-qa.mjs` y `BACKLOG.md` operan obligatoriamente con archivos individuales en `backlog/tasks/*.md` que llevan YAML frontmatter (`id`, `status`, `dependencies`, etc.) y bloques `<!-- AC:BEGIN -->`. Esto confunde a los modelos cuando generan nuevas tareas.
2. La maquina de estados, el protocolo `claimed_by` con `git worktree`, y las politicas de `< 1000 LOC` estan duplicadas palabra por palabra a lo largo de `AGENTS.md`, `TEAM_PLAYBOOK.md`, `STATE_MACHINE.md` y las skills principales. Esto consume miles de tokens innecesarios por sesion de agente.

**Criterios de Aceptación:**
- [x] #1 Actualizar los ejemplos de definicion de tareas en `pm-orchestrator/SKILL.md` y `STATE_MACHINE.md` para reflejar fielmente la estructura real de archivo `backlog/tasks/*.md` con YAML frontmatter y bloques de criterios de aceptacion.
- [x] #2 Aplicar DRY en `AGENTS.md`, `TEAM_PLAYBOOK.md` y `pm-orchestrator/SKILL.md`, consolidando `STATE_MACHINE.md` y `git-workflow.md` como unicas fuentes de verdad referenciadas por vinculos.
- [x] #3 Reducir la sobrecarga de tokens de contexto sin debilitar las directivas no negociables del framework.
- [x] #4 `npm run validate` valida con exito enlaces y vocabulario de estados.

---

#### [PLAY-045] Enforcement mecanico de presupuesto de archivo y reglas anti-slop en gate-qa
- **Prioridad**: `medium` | **Tipo**: `feature`

Las skills `principal-engineer` y `qa-auditor` declaran reglas estrictas que hoy descansan unicamente en la inspeccion humana o semantica del subagente, sin respaldo mecanico en `scripts/gate-qa.mjs`:
1. `PYRAMID_STEPS` en `gate-qa.mjs` no incluye la ejecucion de `check-loc.mjs` ni define formalmente si el exceso de lineas (>= 1000 LOC) bloquea la certificacion o emite un aviso segun la soberania del PO.
2. No existe un chequeo mecanico rapido en el runner para detectar evasiones de tipado en el diff (`as unknown as`, `as any as`) o mocks globales de modulo (`vi.mock(` / `jest.mock(`) que simulan cobertura sin ejercitar la integracion.

Integrar estas verificaciones mecanicas en el ciclo de promocion robustece la garantia de calidad eliminando atajos inadvertidos.

**Criterios de Aceptación:**
- [x] #1 Incorporar el paso de chequeo de modularidad (`check-loc.mjs`) o inspeccion de presupuesto dentro de `scripts/gate-qa.mjs` o la piramide de verificacion, con comportamiento configurable o claramente documentado.
- [x] #2 Incorporar chequeo estatico o regex en `scripts/gate-qa.mjs` / `inspectTask` para advertir o bloquear la presencia de `as unknown as` y `as any as` en archivos modificados.
- [x] #3 Actualizar la documentacion de `qa-auditor/SKILL.md` para reflejar con precision los pasos y exit codes reales del runner mecanico.
- [x] #4 `npm test` y `npm run validate` pasan en verde.

---

#### [PLAY-046] Protocolo de systematic debugging y root cause tracing en principal-engineer
- **Prioridad**: `medium` | **Tipo**: `enhancement`

Actualmente, `principal-engineer/SKILL.md` define excelentes lineamientos de arquitectura, tipado e invariantes, pero carece de un protocolo sistematico de diagnostico y resolucion de defectos ("Systematic Debugging"). 
Los modelos de lenguaje ante un bug complejo tienden a "adivinar", alterando componentes o envolviendo codigo en condicionales defensivos sin haber aislado la causa raiz, lo que degrada la base de codigo con parches de sintomas.

Inspirado en los estandares de la industria (como los protocolos de `obra/superpowers`), este skill debe incorporar:
1. Protocolo de 4 fases para investigacion de defectos: Reproduccion aislada -> Rastreo del flujo hacia atras -> Hipotesis unica -> Test rojo.
2. Prohibicion explicita de tocar codigo de produccion antes de que exista un test que reproduzca y falle con el bug.
3. Mecanismo de disyuntor ("circuit breaker"): si tras 2 intentos de fix la prueba sigue fallando, el agente debe detenerse, revertir los parches experimentales y reevaluar supuestos o consultar al usuario.

**Criterios de Aceptación:**
- [x] #1 Incorporar la seccion "Systematic Debugging Protocol" en `principal-engineer/SKILL.md` con las fases de investigacion, reproduccion previa e hipotesis comprobable.
- [x] #2 Agregar la directiva de disyuntor ("circuit breaker" tras 2 intentos fallidos de fix) para evitar "thrashing" y parches de sintomas.
- [x] #3 Mover el bloque de configuracion `.oxlintrc.json` (lineas 153-216 de `principal-engineer/SKILL.md`) a una referencia complementaria o archivo dedicado bajo `references/oxlint-anti-slop.md` para reducir consumo de contexto.
- [x] #4 `npm run validate` valida enlaces y sintaxis con 0 errores.

---

#### [PLAY-047] Regla de git commits en ingles y guardrail mecanico commit-msg
- **Prioridad**: `medium` | **Tipo**: `feature`

Para garantizar un historial de control de versiones estándar y exportable a escala internacional:
1. Las directivas de Git en `.agents/rules/git-workflow.md` y `AGENTS.md` deben establecer explícitamente que los mensajes de commit, nombres de ramas (`feat/...`, `fix/...`), tags y PRs deben ser 100% en inglés imperativo bajo Conventional Commits. Aunque el ticket en el backlog o la interacción con el usuario sea en español, el agente tiene la obligación de traducir el título y descripción al commitear.
2. El framework `@gripm/playbook` debe proveer un script o guardrail mecánico de validación de `commit-msg` (`scripts/validate-commit-msg.mjs` o comando CLI) que verifique el formato Conventional Commits y alerte o rechace commits en español o mal formateados para el repo y sus proyectos consumidores.

**Criterios de Aceptación:**
- [x] #1 Incorporar en `.agents/rules/git-workflow.md` la directiva mandatoria de commits, ramas, tags y PRs 100% en inglés imperativo con Conventional Commits, estipulando la obligación del agente de traducir desde tickets en español.
- [x] #2 Desarrollar `scripts/validate-commit-msg.mjs` (o subcomando en el router del playbook) con soporte para validar mensajes de commit (formato conventional commits, detección de patrones o palabras clave en español en el header como `agrega`, `corrige`, `arregla`, etc.).
- [x] #3 Registrar el hook/script en `.playbook-manifest.json` y sincronizarlo a repositorios consumidores para su adopción vía hooks de Git.
- [x] #4 Añadir suite de tests automatizados para el validador de `commit-msg` en `tests/validate-commit-msg.test.mjs`.
- [x] #5 `npm test` y `npm run validate` pasan en verde con 0 errores.

---

#### [PLAY-048] Invariante Anti-Dev-Production-Deploy y protocolo de Release Deployment
- **Prioridad**: `high` | **Tipo**: `feature`

Al auditar los deployments de Vercel en Gripm Board (dogfooding), se detectó que los despliegues históricos de Producción figuraban con `branch: dev`.
La causa raíz es una contradicción metodológica no resuelta en el Playbook:
1. `git-workflow.md` estipulaba que *"The primary worktree stays on dev"*.
2. `STATE_MACHINE.md` exige despliegue real a producción para cerrar la transición T4 (`ready` ➔ `done`).
3. Al no existir una regla ni excepción explícita para la ejecución del deploy, las herramientas de despliegue (`vercel --prod`, CLIs cloud, etc.) se ejecutaban situados en `dev`, estampando en la infraestructura que producción corre desde la rama de integración y abriendo riesgo de State Lies.

Alcance:
1. Declarar la invariante **Anti-Dev-Production-Deploy** en `.agents/STATE_MACHINE.md`.
2. Documentar el protocolo canónico de Release Deployment en `.agents/rules/git-workflow.md` como la excepción controlada para la promoción a `main`.
3. Actualizar `.agents/skills/pm-orchestrator/SKILL.md` para verificar el origen en `main` antes de transicionar `ready` ➔ `done`.
4. Incorporar verificación en `tests/validate-repo.test.mjs` para garantizar la presencia y paridad de la regla en el framework.

**Criterios de Aceptación:**
- [x] #1 Declarar la invariante Anti-Dev-Production-Deploy en `.agents/STATE_MACHINE.md` estableciendo la prohibición de ejecutar herramientas de producción desde `dev`.
- [x] #2 Documentar el protocolo canónico de Release Deployment en `.agents/rules/git-workflow.md` (integración `dev` ➔ `main` vía fast-forward y origen físico de despliegue en `main`).
- [x] #3 Actualizar `.agents/skills/pm-orchestrator/SKILL.md` en el checklist de Release Delivery exigiendo la verificación de trunk `main` antes de mover a `done`.
- [x] #4 Añadir prueba automatizada en `tests/validate-repo.test.mjs` que verifique la presencia y consistencia de la invariante Anti-Dev-Production-Deploy.
- [x] #5 `npm test` y `npm run validate` pasan en verde con 0 errores.

---

#### [PLAY-049] Consolidación de pipeline de release y eliminación de workflow redundante
- **Prioridad**: `high` | **Tipo**: `bug`

Durante el ciclo de release de v2.7.0, se evidenció una colisión entre dos modelos de despliegue coexistentes en el repositorio:
1. `.github/workflows/ci.yml` automatiza el release completo desde `main` (pruebas, npm publish con provenance, creación de tag anotado y GitHub Release oficial).
2. `.github/workflows/publish.yml` operaba como workflow legado redundante activado por `push: tags: ['v*']`.
3. El protocolo de Release Deployment en `.agents/rules/git-workflow.md` y `.agents/skills/pm-orchestrator/SKILL.md` prescribía un paso manual prematuro (`git tag vX.Y.Z && git push origin vX.Y.Z`), induciendo al operador a exponer tags y releases antes de que el CI valide `main` y provocando ejecuciones duplicadas y carreras en CI.

Alcance:
1. Eliminar definitivamente el workflow legado redundante `.github/workflows/publish.yml`.
2. Actualizar `.agents/rules/git-workflow.md` formalizando que en pipelines automatizados (CI-driven), el push a `main` delega de forma atómica a CI la verificación de calidad, el despliegue a npm y la creación del tag y GitHub Release, prohibiendo el tagging manual preventivo.
3. Alinear `.agents/skills/pm-orchestrator/SKILL.md` en el checklist y ceremonia de Release Delivery.
4. Actualizar `tests/validate-repo.test.mjs` para validar la integridad del protocolo consolidado.
5. Preparar el patch 2.7.1 (`package.json`, `.playbook-manifest.json`, `CHANGELOG.md`).

**Criterios de Aceptación:**
- [x] #1 Eliminar `.github/workflows/publish.yml` consolidando el pipeline de publicación exclusivamente en `.github/workflows/ci.yml`.
- [x] #2 Actualizar `.agents/rules/git-workflow.md` eliminando el paso manual de tag/push en flujos CI-driven y declarando la prohibición de tags manuales prematuros.
- [x] #3 Actualizar `.agents/skills/pm-orchestrator/SKILL.md` en el paso de Release Ceremony Sequence.
- [x] #4 Actualizar `tests/validate-repo.test.mjs` verificando la coherencia y guardrails del protocolo consolidado.
- [x] #5 Incrementar versión a 2.7.1 en `package.json` y `.playbook-manifest.json`, y registrar sección 2.7.1 en `CHANGELOG.md`.
- [x] #6 `npm test` y `npm run validate` pasan con 0 errores.

---

#### [PLAY-050] Reestructuracion del README bajo piramide invertida y progressive disclosure
- **Prioridad**: `high` | **Tipo**: `chore`

El README.md actual supera las 500 lineas y acumula cinco responsabilidades incompatibles en un unico archivo: pagina de aterrizaje, tutorial de inicio, especificacion profunda de arquitectura, catalogo de referencia de CLI/APIs y guia de contribucion interna del repositorio.

Esta sobrecarga oculta el comando principal de inicio (`npx @gripm/playbook init`) hasta la linea 213, triplica la explicacion de los estados y roles del loop de entrega, e incluye detalles de bajo nivel (como selectores AST JSX del auditor UX o garantias de hash del sync) en el flujo de lectura inicial.

Alcance:
1. Reestructurar README.md bajo la regla de la piramide invertida y progressive disclosure, reduciendo su longitud total a menos de 250 lineas (~180-220 lineas).
2. Ubicar el pitch y el Quickstart ("One Golden Path" con `npx @gripm/playbook init`) en el primer fold (primeras ~35 lineas).
3. Consolidar la explicacion del Hub Orchestrator, la disciplina de subagentes limpios de QA y los 3 modos operativos en un unico bloque visual coherente, eliminando repeticiones y el bloque redundante "Framework Summary".
4. Encapsular la configuracion avanzada del CLI/auditor UX y el puente poliglota para otros ecosistemas en bloques `<details>` colapsables o enlaces directos a su documentacion canonica.
5. Preservar enlaces markdown relativos validos, badges, e invariante de guion simple anti-em-dash (` - `).

**Criterios de Aceptación:**
- [x] #1 README.md reestructurado con Quickstart (`npx @gripm/playbook init`) visible en las primeras 40 lineas.
- [x] #2 Extension total de README.md reducida a menos de 250 lineas (~180-220 lineas), eliminando duplicaciones de estados y el bloque final "Framework Summary".
- [x] #3 Configuraciones avanzadas del auditor UX (JSON AST, programmatic API) y puente poliglota agrupadas en bloques colapsables `<details>` o enlaces a especificacion.
- [x] #4 Enlaces relativos a documentacion interna (.agents/STATE_MACHINE.md, .agents/TEAM_PLAYBOOK.md, CONTRIBUTING.md) completamente funcionales y validados.
- [x] #5 Invariante anti-em-dash respetada al 100% (cero em-dash ni en-dash, solo guion simple ` - `).
- [x] #6 `npm run check:all` (`npm run validate`, `npm run check:loc`, `npm test`) pasa con 0 errores.

---

#### [PLAY-051] Modularizacion de playbook init y sync: seleccion granular de roles, scripts y plantillas con presets rapidos
- **Prioridad**: `high` | **Tipo**: `feature`

Actualmente `playbook init` (`scripts/init.mjs`) y `playbook sync` (`scripts/sync-playbook.mjs`) operan bajo un modelo 'todo o nada':
1. Inyectan silenciosamente 5 scripts en `package.json` del proyecto consumidor sin preguntar al usuario si los desea ni cuales prefiere.
2. Instalan invariablemente los 6 roles de agentes (`pm-orchestrator`, `principal-engineer`, `qa-auditor`, `product-designer`, `market-researcher`, `code-level-ux-auditor`) en `.agents/skills/`.
3. Copian plantillas opcionales a `docs/` (`DOMAIN_TEMPLATE.md` y `SPRINT_SPEC_TEMPLATE.md`) sin consultar si el proyecto utilizara sprints o glosario de dominio.
4. Al configurar Gripm Board, clavan una configuracion rigida (`BOARD_DEFAULTS`) sin ofrecer modulos ni opciones del Cockpit.

Bajo la vision de Gripm Suite y el principio de '100% ofrecido, 0% impuesto', esta tarea modulariza el init y sync de Gripm Playbook:
- Soporte para **Modo Rapido** (defaults de confianza) vs **Componente por Componente** (control total mediante multi-select).
- Seleccion granular de **Roles de Agentes** a instalar en `.agents/skills/`.
- Seleccion granular y opt-in de **Scripts en package.json** (`gate:qa`, `gate:review`, `audit:ux`, `check:loc`, `validate:commit`).
- Seleccion granular de **Plantillas en docs/** (`DOMAIN_TEMPLATE.md`, `SPRINT_SPEC_TEMPLATE.md`).
- Persistencia de los componentes seleccionados en `.gripm/playbook-lock.json` (`selectedSkills`, `selectedScripts`, `selectedTemplates`) para que subsecuentes `playbook sync` respeten lo que el usuario eligio no instalar y no lo vuelvan a forzar.

**Criterios de Aceptación:**
- [x] #1 scripts/init.mjs ofrece selector de modo: 'Rapido (Baterias incluidas)' y 'Componente por componente (Control total)'.
- [x] #2 En modo Componente por componente, se presenta un multi-select con los roles de agentes (coreSkills), permitiendo elegir que roles instalar en .agents/skills/.
- [x] #3 La adicion de scripts a package.json es opt-in y permite seleccionar individualmente cuales incorporar (gate:qa, gate:review, audit:ux, check:loc, validate:commit).
- [x] #4 La copia de plantillas a docs/ (DOMAIN_TEMPLATE.md, SPRINT_SPEC_TEMPLATE.md) es opt-in y seleccionable.
- [x] #5 .gripm/playbook-lock.json registra los componentes seleccionados por el usuario, y scripts/sync-playbook.mjs sincroniza unicamente los componentes activos.
- [x] #6 Soporte para flags no interactivas en init y sync (--skills <lista>, --no-scripts, --no-docs, --yes).
- [x] #7 Tests en tests/ validando que la instalacion respete la seleccion granular sin inyecciones no autorizadas.
- [x] #8 npm run check:all (validate, check:loc, test) pasa con codigo 0.

---

#### [PLAY-052] Motor Canonico de Diagnostico de Codigo, Anti-Slop y Gobernanza de Salud de Repositorio
- **Prioridad**: `high` | **Tipo**: `feature`

Épica paraguas para establecer en @gripm/playbook el motor canónico de diagnóstico estático, anti-slop y gobernanza de salud de repositorios para desarrollo con agentes de IA.

Históricamente, Playbook distribuía reglas individuales como check-loc.mjs y audit-ux-code.cjs. Esta iniciativa incorpora el motor integral audit-engine.mjs como la fuente única de la verdad (SSOT) para métricas de calidad de código, límites modulares (<1000 LOC), supresiones de tipos y detección de deuda oculta, manteniendo 0 dependencias externas y sincronización criptográfica hacia proyectos consumidores (incluido @gripm/board).

**Criterios de Aceptación:**
- [x] #1 #1 audit-engine.mjs canónico instalado en scripts/ e incluido en .playbook-manifest.json bajo core.
- [x] #2 #2 Suite de pruebas exhaustiva en tests/audit-engine.test.mjs pasando con 0 fallas (detección de stack, LOC, anti-slop, TODOs).
- [x] #3 #3 gate-qa.mjs integra la compuerta mecánica de salud de código antes de certificar tareas a ready.
- [x] #4 #4 Skills pm-orchestrator y principal-engineer actualizadas con el protocolo de diagnóstico inicial al abordar codebases.
- [x] #5 #5 selection.mjs e init.mjs ofrecen audit:repo como script modular opt-in respetando el principio 100% ofrecido, 0% impuesto.
- [x] #6 #6 npm run check:all pasa con código de salida 0 en gripm-playbook sin regresiones ni violaciones anti-em-dash.

---

#### [PLAY-053] Motor estatico canonico audit-engine.mjs, tests de unidad e inclusion en manifiesto
- **Prioridad**: `high` | **Tipo**: `feature`

Establecer scripts/audit-engine.mjs en @gripm/playbook como la fuente canónica de análisis estático del framework.

El motor inspecciona el árbol de código sin dependencias externas (usando node:fs y node:path nativos):
- Detecta el stack tecnológico (React, Vue, Node, TypeScript, Python, etc.) y frameworks de testing.
- Computa presupuesto de modularidad (archivos con más de 1000 LOC y warning a partir de 500 LOC).
- Detecta patrones de código degradado / anti-slop (@ts-ignore, @ts-nocheck, eslint-disable, console.log residuales).
- Extrae deudas técnicas comentadas en código (TODO, FIXME, HACK, XXX) con número de línea y contexto.
- Calcula el índice de salud determinista de 0 a 100 puntos y soporta flags CLI (--strict, --format json, --quiet).

**Criterios de Aceptación:**
- [x] #1 #1 audit-engine.mjs copiado canónicamente a scripts/audit-engine.mjs en @gripm/playbook con cero dependencias externas.
- [x] #2 #2 .playbook-manifest.json incluye scripts/audit-engine.mjs en la lista core para distribución universal.
- [x] #3 #3 tests/audit-engine.test.mjs implementa cobertura unitaria completa de detección de stack, conteo LOC, regexes anti-slop y TODOs.
- [x] #4 #4 package.json de playbook expone los scripts audit:repo y audit:repo:strict.
- [x] #5 #5 node --test tests/audit-engine.test.mjs ejecuta y pasa con código 0.

---

#### [PLAY-054] Integracion de compuerta mecanica de salud en gate-qa.mjs y binarios
- **Prioridad**: `high` | **Tipo**: `feature`

Integrar el motor de auditoría de código como guardrail mecánico dentro de scripts/gate-qa.mjs.

Actualmente gate-qa.mjs verifica tests, criterios de aceptación y frontmatter YAML. Esta tarea añade la verificación de salud estructural del repositorio:
- Impide que una tarea pase a ready si el agente introdujo archivos monolíticos (>1000 LOC).
- Valida que no se hayan introducido suppressions críticas de TypeScript/linter sin justificación.
- Expone el ejecutable global audit-repo en el mapa bin de package.json.

**Criterios de Aceptación:**
- [x] #1 #1 gate-qa.mjs ejecuta una comprobación de presupuesto y anti-slop invocando la lógica de audit-engine.mjs.
- [x] #2 #2 Si el código introduce archivos mayores a 1000 LOC o violaciones críticas no suprimidas, gate-qa.mjs emite fallo y aborta la promoción a ready (con bypass explícito --force si el PO lo autoriza).
- [x] #3 #3 bin en package.json de @gripm/playbook expone audit-repo apuntando a scripts/audit-engine.mjs.
- [x] #4 #4 tests de integración de gate-qa validan que la compuerta de salud detenga promociones con violaciones estructurales.

---

#### [PLAY-055] Protocolo de diagnostico inicial de repositorio en skills principal-engineer y pm-orchestrator
- **Prioridad**: `medium` | **Tipo**: `feature`

Actualizar las directivas de las skills de agentes en @gripm/playbook (.agents/skills/) para incorporar la cultura de diagnóstico estático preventivo.

Cualquier agente que adopte los roles del Playbook debe:
1. Al ingresar a un repositorio existente, ejecutar o consultar la auditoría estática para conocer la baseline (LOC, suppressions, TODOs, stack).
2. Si @gripm/board está activo, interactuar vía MCP con gripm_get_repo_health.
3. Si el proyecto no tiene @gripm/board, correr npx @gripm/playbook audit (o npm run audit:repo) para operar con la misma disciplina de Staff Engineer mecánico.

**Criterios de Aceptación:**
- [x] #1 #1 .agents/skills/principal-engineer/SKILL.md incorpora el protocolo de diagnóstico inicial estático antes de modificar código en proyectos existentes.
- [x] #2 #2 .agents/skills/pm-orchestrator/SKILL.md añade la evaluación de salud del repositorio como paso previo al refinamiento de iniciativas grandes o sprints.
- [x] #3 #3 .agents/skills/qa-auditor/SKILL.md documenta la auditoría de salud de código en el paso de verificación estructural.
- [x] #4 #4 Se instruye a los agentes a consultar gripm_get_repo_health vía MCP si detectan que @gripm/board está presente, o ejecutar audit:repo en terminal si no lo está.

---

#### [PLAY-056] Sinergia opcional con gripm board y exportacion modular en selection.mjs e init.mjs
- **Prioridad**: `medium` | **Tipo**: `feature`

Integrar el nuevo script audit:repo en el sistema modular de selección de scripts de @gripm/playbook (PLAY-051).

Garantizar:
1. 100% ofrecido, 0% impuesto: el usuario puede elegir si desea incorporar audit:repo a sus scripts en package.json tanto en modo Quick como en modo Componente por Componente.
2. Detección no invasiva de @gripm/board: si Board está presente, enlazar la configuración sin forzar dependencias.
3. Actualización de tests de selección y sincronización.

**Criterios de Aceptación:**
- [x] #1 #1 scripts/lib/selection.mjs incluye audit:repo y audit:repo:strict dentro de VALID_SCRIPTS y SCRIPT_DEFINITIONS.
- [x] #2 #2 init.mjs y sync-playbook.mjs soportan la instalación opcional de audit:repo sin imponerlo.
- [x] #3 #3 Si se detecta @gripm/board o directorio backlog/tasks/, init.mjs sincroniza umbrales de auditoría en .gripm/config.json.
- [x] #4 #4 tests unitarios de selection.test.mjs y sync.test.mjs actualizados y pasando con código 0.

---

#### [PLAY-061] Alinear el gate estructural con strict y los cambios de la tarea
- **Prioridad**: `high` | **Tipo**: `bug`

### Problem Statement
El gate de QA bloquea la certificación de tareas por violaciones de LOC y supresiones preexistentes en cualquier parte del repositorio, incluso en modo normal y cuando esos hallazgos no guardan relación con el diff de la tarea. Esto contradice la pirámide, que define LOC como advertencia fuera de `--strict`, y hace que cambios sin regresiones queden atrapados por deuda heredada.

### Alcance y decisiones
- **In-Scope:**
  1. En modo normal, mantener los hallazgos estructurales globales como advertencias y bloquear únicamente nuevas violaciones duras de LOC o supresiones introducidas por los cambios sin commit.
  2. En `--strict`, conservar el bloqueo por todas las violaciones estructurales del repositorio.
  3. Conservar `--force` como bypass explícito de autoridad PO, con advertencia.
  4. Agregar pruebas de regresión para deuda previa no bloqueante, regresiones nuevas bloqueantes y modo estricto global.
- **Out-of-Scope:**
  - Remediar LOC o supresiones preexistentes del repositorio consumidor.
  - Cambiar los criterios de auditoría UX o la detección de supresiones del auditor.
- **Decisiones:**
  - Una violación de LOC preexistente bloquea en modo normal solo si el archivo vuelve a crecer; una violación nueva también bloquea.
  - Una supresión bloquea en modo normal solo si la línea que la contiene fue añadida en el diff actual.
  - Si no puede determinarse el baseline Git, el gate informa la limitación como advertencia y no atribuye deuda histórica al cambio.

**Criterios de Aceptación:**
- [x] #1 Con hallazgos de LOC y supresiones que ya existen en `HEAD`, el gate normal los reporta como advertencias y no bloquea la tarea.
- [x] #2 En modo normal, una nueva violación de LOC o una supresión añadida por el diff bloquea la certificación.
- [x] #3 `--strict` bloquea por hallazgos estructurales preexistentes en cualquier parte del repositorio.
- [x] #4 `--force` conserva el bypass explícito y reporta que los hallazgos se omitieron.
- [x] #5 Las pruebas enfocadas de gate y `npm run check:all` terminan con código 0.

---

### 📦 Archivadas / Descartadas (3)

#### [PLAY-033] Localizacion formal en espanol (docs/es/)
- **Prioridad**: `low` | **Tipo**: `feature`

PLAY-029 dejo todo el core en ingles tecnico, y el plan original de "golden repo" lo dejo explicito: si se quiere soporte en espanol, debe existir como localizacion formal en `docs/es/`, nunca mezclado en el mismo archivo. Eso no se hizo y tampoco se registro. Queda como item exploratorio porque es una decision de producto, no una tarea de implementacion.

Contexto que la vuelve real: el backlog de este repo y `docs/BACKLOG.md` se escriben en espanol porque son del repo propio y no llegan a los consumidores. La pregunta es si esa preferencia se extiende a la capa que si se instala.

**Criterios de Aceptación:**
- [x] #1 Decision de producto registrada: el playbook declara explicitamente que su capa instalable es solo-ingles en documentacion y notas de release, permitiendo la parametrizacion de idioma del consumidor en su propio AGENTS.md.
- [x] #2 La politica queda establecida: no se mantiene docs/es/ duplicado en el core para evitar desincronizacion y deuda de traduccion.
- [x] #3 Ningun archivo mezcla dos idiomas en el mismo documento, y el sync al consumidor instala estrictamente archivos en ingles tecnico.

---

#### [PLAY-036] Resincronizar titulos y cuerpos de releases de GitHub con la norma de guion y el CHANGELOG en ingles
- **Prioridad**: `low` | **Tipo**: `decision`

La revision de `dev` tras la v2.6.0 verifico que lo publicado en GitHub diverge del CHANGELOG ya corregido:

1. **El cuerpo del release v2.6.0** todavia contiene las entradas originales en espanol de PLAY-031 ("ASCII diagrama estatico en el primer fold...") y PLAY-034 ("QA Ciega y Anti-Self-Certification..."), mientras que `CHANGELOG.md` ya las tiene en ingles tras `2b56029`. Verificado con `gh release view v2.6.0 --json body`.

2. **Cinco titulos de release usan em-dash como separador**, lo que la Standard Hyphen Rule de AGENTS.md cubre explicitamente ("release titles"): `v2.2.2 — Zero-network sync...`, `v2.2.1 — UX-010...`, `v2.2.0 — Punto de extension...`, `v2.1.0 — Anatomia de unidad...`, `v2.0.0 — Agentic Team Playbook`. Los releases desde v2.3.0 usan solo el numero, sin separador.

Los releases de GitHub son artefactos publicados e inmutables por convencion; corregirlos es decision del PO, no una consecuencia mecanica de arreglar el CHANGELOG local. Este item existe para que la decision quede registrada y no se pierda.

**Criterios de Aceptación:**
- [x] #1 Decision del PO registrada sobre el cuerpo de v2.6.0: (b) se deja como quedo en el momento de publicacion y se anota que el CHANGELOG es la fuente canonica vigente.
- [x] #2 Decision del PO registrada sobre los 5 titulos con em-dash (v2.0.0, v2.1.0, v2.2.0, v2.2.1, v2.2.2): (b) se declaran exemptos como historico inmutable y la norma aplica desde v2.3.0 en adelante.
- [x] #3 La decision tomada queda reflejada en la documentacion que el consumidor ve: los releases historicos quedan como registro historico inmutable y CHANGELOG.md rige como fuente canonica.
- [x] #4 Los cambios, si los hay, no tocan tags ni el paquete npm publicado; solo metadatos del release en GitHub.

---

#### [PLAY-039] El adaptador de Cursor declara como canonico un archivo que no existe: .agents/rules/git-workflow.md
- **Prioridad**: `medium` | **Tipo**: `bug`

`scripts/lib/adapters.mjs:118-130` define `renderCursorGitRule()`, que genera para el consumidor un archivo de reglas de Cursor con este cuerpo:

```
# Git workflow

Canonical source: `.agents/rules/git-workflow.md` - read it before any `git commit` or `git push`.

<las cinco GIT_RULES, inline>
```

La linea "Canonical source" apunta a `.agents/rules/git-workflow.md`. **Ese archivo no existe.** Verificado con un glob sobre `**/git-workflow.md` en el repo de gripm: cero resultados.

El efecto es que todo agente de Cursor recibe una orden explicita de leer un archivo ausente antes de cualquier `git commit` o `git push`. Las reglas si estan presentes, inline debajo de la referencia; pero la instruccion manda a buscarlas a otro lado.

Es doblemente ironico porque el contenido es correcto: el archivo inventado se llamaria "canonical source" del mismo texto que ya esta embebido. La referencia no aporta nada aunque existiera, salvo un segundo lugar donde mantenerlo.

Este defecto se detecto de forma indirecta: al releer `GIT_RULES` para investigar un problema de colision multi-agente (PLAY-038), la referencia canonica aparecio como primera linea de la regla generada, y su objetivo no estaba en el arbol.

**Criterios de Aceptación:**
- [ ] #1 La linea "Canonical source" se elimina de `renderCursorGitRule()`, o se sustituye por una ruta que exista y que el init realmente instale.
- [ ] #2 No queda ninguna referencia a `.agents/rules/git-workflow.md` en el repo: `grep -r "git-workflow.md"` devuelve vacio en `scripts/` y en los templates.
- [ ] #3 Si la decision es eliminar la linea, se documenta en las notas por que las reglas inline son la fuente unica y no un archivo aparte.
- [ ] #4 `npm run check:all` sale con 0 tras el cambio.

---
