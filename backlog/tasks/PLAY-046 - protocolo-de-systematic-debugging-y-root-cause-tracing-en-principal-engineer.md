---
id: PLAY-046
title: "Protocolo de systematic debugging y root cause tracing en principal-engineer"
status: done
created_date: '2026-10-25'
updated_date: '2026-10-26'
labels: ["engineering", "methodology", "debugging"]
dependencies: []
priority: medium
type: enhancement
claimed_by: "antigravity:host"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Actualmente, `principal-engineer/SKILL.md` define excelentes lineamientos de arquitectura, tipado e invariantes, pero carece de un protocolo sistematico de diagnostico y resolucion de defectos ("Systematic Debugging"). 
Los modelos de lenguaje ante un bug complejo tienden a "adivinar", alterando componentes o envolviendo codigo en condicionales defensivos sin haber aislado la causa raiz, lo que degrada la base de codigo con parches de sintomas.

Inspirado en los estandares de la industria (como los protocolos de `obra/superpowers`), este skill debe incorporar:
1. Protocolo de 4 fases para investigacion de defectos: Reproduccion aislada -> Rastreo del flujo hacia atras -> Hipotesis unica -> Test rojo.
2. Prohibicion explicita de tocar codigo de produccion antes de que exista un test que reproduzca y falle con el bug.
3. Mecanismo de disyuntor ("circuit breaker"): si tras 2 intentos de fix la prueba sigue fallando, el agente debe detenerse, revertir los parches experimentales y reevaluar supuestos o consultar al usuario.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] Incorporar la seccion "Systematic Debugging Protocol" en `principal-engineer/SKILL.md` con las fases de investigacion, reproduccion previa e hipotesis comprobable.
- [x] Agregar la directiva de disyuntor ("circuit breaker" tras 2 intentos fallidos de fix) para evitar "thrashing" y parches de sintomas.
- [x] Mover el bloque de configuracion `.oxlintrc.json` (lineas 153-216 de `principal-engineer/SKILL.md`) a una referencia complementaria o archivo dedicado bajo `references/oxlint-anti-slop.md` para reducir consumo de contexto.
- [x] `npm run validate` valida enlaces y sintaxis con 0 errores.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Diseniar la seccion de Systematic Debugging y redactarla de forma concisa en `principal-engineer/SKILL.md`.
2. Extraer la receta extensa de Oxlint a `references/oxlint-anti-slop.md`.
3. Validar consistencia global con `npm run validate`.
<!-- SECTION:PLAN:END -->
