---
id: PLAY-017
title: "Disciplina de ingeniería senior y diff mínimo (ponytail): erradicación de la sobre-ingeniería en Principal Engineer"
status: review
created_date: '2026-10-12'
updated_date: '2026-10-12'
labels:
  - "engineering"
  - "anti-bloat"
  - "principal-engineer"
  - "best-practices"
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Los agentes de IA sufren de una tendencia compulsiva hacia la sobre-ingeniería especulativa ("code inflation"): cuando se les pide un cambio o corrección puntual, con frecuencia introducen adaptadores innecesarios, factories abstractas, helpers no solicitados e instalan dependencias de terceros para resolver operaciones que requieren apenas unas pocas líneas de código nativo. Esto incrementa el consumo de tokens, eleva los costos operativos y amplía el radio de impacto (*blast radius*) de posibles regresiones.

### Solución
Inspirado en la filosofía de `DietrichGebert/ponytail` (*"The lazy senior dev: writes one line, it works"*) y el patrón *Minimal Change Engineer*:
1. **La mejor línea de código es la que no se escribe:** La solución óptima es la que resuelve el 100% de la necesidad con la menor cantidad de código nuevo posible.
2. **Reutilización obligatoria:** Antes de escribir una función auxiliar o instalar un paquete, el agente debe inspeccionar el repositorio en busca de utilidades existentes o aprovechar la standard library del lenguaje.
3. **Mapeo de blast radius antes de editar:** Identificar todos los puntos de contacto que el cambio puede afectar (llamadores, tests, fixtures, exports y configuración) antes de modificar código.
4. **Cierre honesto obligatorio:** Al finalizar cualquier intervención, el agente debe concluir declarando explícitamente en una o dos líneas qué no probó, qué salteó conscientemente y qué riesgos operativos o de compatibilidad quedan para el usuario.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Actualizar .agents/skills/principal-engineer/SKILL.md incorporando la sección 'Disciplina Ponytail & Diff Mínimo Viable' (prohibición de sobre-ingeniería y código especulativo)
- [x] #2 Incorporar el protocolo de búsqueda previa y reutilización de componentes/helpers existentes antes de crear código nuevo o instalar paquetes
- [x] #3 Exigir el mapeo explícito de blast radius en la planificación del Principal Engineer antes de ejecutar ediciones
- [x] #4 Establecer el requisito de cierre honesto en los reportes de desarrollo (declarar lo no probado y riesgos remanentes)
- [x] #5 Actualizar AGENTS.md (Reglas Generales) reforzando la política de diffs mínimos y soluciones simples que escalan
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Redactar las directrices de diff mínimo y anti-inflación en `.agents/skills/principal-engineer/SKILL.md`.
2. Actualizar `AGENTS.md` con los lineamientos de reutilización y cierre honesto.
3. Actualizar la sección de Mode 1 (Surgical Focus) en `.agents/TEAM_PLAYBOOK.md`.
4. Validar el repositorio con `npm run validate` y `npm test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:END -->
