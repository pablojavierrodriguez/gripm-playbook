---
id: PLAY-039
title: "El adaptador de Cursor declara como canonico un archivo que no existe: .agents/rules/git-workflow.md"
status: dismissed
dismissed_reason: "Dismissed: premise false. The file .agents/rules/git-workflow.md exists on disk (5651 bytes). The report relied on a POSIX glob that omits dot-directories, so it under-reported. No defect."
created_date: '2026-10-22'
updated_date: '2026-10-24'
labels:
  - "cursor"
  - "adapters"
  - "docs"
priority: medium
type: bug
estimate: 1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 La linea "Canonical source" se elimina de `renderCursorGitRule()`, o se sustituye por una ruta que exista y que el init realmente instale.
- [ ] #2 No queda ninguna referencia a `.agents/rules/git-workflow.md` en el repo: `grep -r "git-workflow.md"` devuelve vacio en `scripts/` y en los templates.
- [ ] #3 Si la decision es eliminar la linea, se documenta en las notas por que las reglas inline son la fuente unica y no un archivo aparte.
- [ ] #4 `npm run check:all` sale con 0 tras el cambio.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decidir entre eliminar la linea o instalar el archivo que promete.
2. Aplicar la decision en `renderCursorGitRule()`.
3. Buscar referencias residuales en templates y docs.
4. Correr `check:all`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Por que probablemente corresponde eliminarla y no instalar el archivo.** Las `GIT_RULES` viajan inline en la misma generacion. Instalar ademas un `.agents/rules/git-workflow.md` crearia dos copias del mismo texto en el consumidor, con la divergencia que el propio playbook combate en otros frentes (ver DEV-326 en gripm: skills y herramienta quedaron fuera de sincronia porque el sync actualizo unos y protegio otro).

**Por que es prioridad media y no alta.** El contenido de las reglas esta presente y es correcto; lo que falla es una instruccion de indireccion que un agente puede ignorar siguiendo el texto que le sigue. No bloquea ningun flujo mecanico.
<!-- SECTION:NOTES:END -->

## Verification (2026-10-24) - Premise false, dismissed

<!-- SECTION:VERIFY:BEGIN -->
The task's central claim - "`git-workflow.md` does not exist, glob returns 0 results" -
is **false**. The file is present on disk:

```
C:\Users\Pablo\Proyectos\gripm-playbook\.agents\rules\git-workflow.md   (5651 bytes)
```

Opening lines confirm real content:

```
# Git Workflow & Commit Governance

Strict rules governing Git operations to prevent unintentional code loss or vague commit histories.
```

**Why the original report missed it.** The report was produced with a POSIX-style glob
(`**/git-workflow.md`) that returns "No files found". That pattern omits dot-directories:
`.agents/` is a hidden folder, so `**/` never descends into it. A `Get-ChildItem -Recurse -Force`
or any hidden-inclusive listing finds the file immediately. The diagnosis error was a tooling
default, not a missing artifact.

**Cross-checks that also confirm presence (all clean):**
- `sync-playbook.mjs:70` lists it in `FALLBACK_CORE_FILES`; a dry-run sync into a temp repo
  exits 0 with no "not found" / "upstream" warnings for this path.
- `.playbook-manifest.json:7` declares it; the manifest is validated green by `validate-repo.mjs`.
- `validate-repo.mjs:146,238` reference it; both loops `continue` when absent, but presence means
  the core-purity and doc-claim checks actually run against it.

**Conclusion.** The adapter's "Canonical source" line points to a file that exists and is
installed. AC #1 (eliminate/replace the line) and AC #2 (grep returns empty) target a non-problem
and would in fact *degrade* correctness by removing a valid pointer. No code change is warranted;
the item is dismissed with a `dismissed_reason` per STATE_MACHINE T_dismiss.
<!-- SECTION:VERIFY:END -->
