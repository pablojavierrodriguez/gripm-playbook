---
id: PLAY-049
title: "Consolidación de pipeline de release y eliminación de workflow redundante"
status: done
created_date: '2026-10-26'
updated_date: '2026-10-26'
labels: ["governance", "git-workflow", "ci-cd", "release-management"]
dependencies: []
priority: high
type: bugfix
claimed_by: "antigravity:dev"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] Eliminar `.github/workflows/publish.yml` consolidando el pipeline de publicación exclusivamente en `.github/workflows/ci.yml`.
- [x] Actualizar `.agents/rules/git-workflow.md` eliminando el paso manual de tag/push en flujos CI-driven y declarando la prohibición de tags manuales prematuros.
- [x] Actualizar `.agents/skills/pm-orchestrator/SKILL.md` en el paso de Release Ceremony Sequence.
- [x] Actualizar `tests/validate-repo.test.mjs` verificando la coherencia y guardrails del protocolo consolidado.
- [x] Incrementar versión a 2.7.1 en `package.json` y `.playbook-manifest.json`, y registrar sección 2.7.1 en `CHANGELOG.md`.
- [x] `npm test` y `npm run validate` pasan con 0 errores.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Crear tarea PLAY-049 en `backlog/tasks/` en estado `draft`.
2. Iniciar tarea con `node scripts/gate-qa.mjs start PLAY-049 --by antigravity:dev`.
3. Eliminar `.github/workflows/publish.yml`.
4. Editar `.agents/rules/git-workflow.md` y `.agents/skills/pm-orchestrator/SKILL.md`.
5. Actualizar `tests/validate-repo.test.mjs`.
6. Actualizar versión a 2.7.1 en `package.json`, `.playbook-manifest.json` y `CHANGELOG.md`.
7. Ejecutar `npm run validate` y `npm test`.
8. Marcar ACs como completados en PLAY-049 y transicionar a `review` con `node scripts/gate-qa.mjs submit PLAY-049`.
9. Invocar subagente limpio de QA (`qa-auditor`) para certificar la tarea y promover a `ready`.
<!-- SECTION:PLAN:END -->
