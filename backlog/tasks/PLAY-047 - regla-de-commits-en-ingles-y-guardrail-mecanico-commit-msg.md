---
id: PLAY-047
title: "Regla de git commits en ingles y guardrail mecanico commit-msg"
status: done
created_date: '2026-10-25'
updated_date: '2026-10-26'
labels: ["git-workflow", "guardrails", "cli"]
dependencies: []
priority: medium
type: feature
claimed_by: "antigravity:dev"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Para garantizar un historial de control de versiones estándar y exportable a escala internacional:
1. Las directivas de Git en `.agents/rules/git-workflow.md` y `AGENTS.md` deben establecer explícitamente que los mensajes de commit, nombres de ramas (`feat/...`, `fix/...`), tags y PRs deben ser 100% en inglés imperativo bajo Conventional Commits. Aunque el ticket en el backlog o la interacción con el usuario sea en español, el agente tiene la obligación de traducir el título y descripción al commitear.
2. El framework `@gripm/playbook` debe proveer un script o guardrail mecánico de validación de `commit-msg` (`scripts/validate-commit-msg.mjs` o comando CLI) que verifique el formato Conventional Commits y alerte o rechace commits en español o mal formateados para el repo y sus proyectos consumidores.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] Incorporar en `.agents/rules/git-workflow.md` la directiva mandatoria de commits, ramas, tags y PRs 100% en inglés imperativo con Conventional Commits, estipulando la obligación del agente de traducir desde tickets en español.
- [x] Desarrollar `scripts/validate-commit-msg.mjs` (o subcomando en el router del playbook) con soporte para validar mensajes de commit (formato conventional commits, detección de patrones o palabras clave en español en el header como `agrega`, `corrige`, `arregla`, etc.).
- [x] Registrar el hook/script en `.playbook-manifest.json` y sincronizarlo a repositorios consumidores para su adopción vía hooks de Git.
- [x] Añadir suite de tests automatizados para el validador de `commit-msg` en `tests/validate-commit-msg.test.mjs`.
- [x] `npm test` y `npm run validate` pasan en verde con 0 errores.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Redactar regla canónica de inglés obligatorio en `.agents/rules/git-workflow.md`.
2. Implementar script validador con regex de Conventional Commits y diccionario de términos en español para el header.
3. Incorporar tests unitarios para casos válidos e inválidos.
4. Integrar en el manifest y CLI de Playbook.
5. Ejecutar validación y tests.
<!-- SECTION:PLAN:END -->
