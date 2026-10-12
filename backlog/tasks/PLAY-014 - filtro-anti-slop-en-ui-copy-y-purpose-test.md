---
id: PLAY-014
title: "Filtro anti-slop en UI, copy y diseño: Purpose Test y erradicación de clichés estéticos de IA"
status: review
created_date: '2026-10-12'
updated_date: '2026-10-12'
labels:
  - "anti-slop"
  - "design"
  - "copywriting"
  - "product-designer"
dependencies: []
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
El diseño y contenido generado por IA adolece de patrones cliché repetitivos ("UI slop") que le dan un aspecto genérico y carente de identidad propia:

1. **Clichés estéticos universales:** Fondo oscuro por defecto con orbes de gradiente radial azul-púrpura o cian, efecto glassmorphism en cards, barra de navegación y modales en simultáneo, border-radius excesivo donde cada elemento es una píldora y sombras sobredimensionadas que hacen flotar la pantalla sin jerarquía.
2. **Copywriting inflado e inverosímil:** Métricas fabricadas ("10,000% ROI", "500,000 founders trust us"), titulares hiperbólicos sin sustancia ("Unlock the power of next-gen workflows") y viñetas cargadas de emojis genéricos.
3. **Técnica visual sin propósito:** Aplicación de artificios estéticos únicamente porque "lucen modernos" en lugar de comunicar jerarquía, contraste o accesibilidad.

### Solución
Inspirado en los principios de filtro de `miqdadbadjuber/anti-slop`:
- Establecer que el playbook opera como un **filtro, no una guía de estilo**: no impone colores fijos ni tipografías, pero somete toda decisión visual al **Purpose Test** (*"¿Qué propósito de jerarquía o legibilidad cumple esta técnica?"*). Si la respuesta es solo decorativa o por inercia de IA, se retira.
- Actualizar la skill `.agents/skills/worldclass-product-designer/SKILL.md` para proscribir paletas genéricas de IA y exigir veracidad estricta en el copy (datos reales o no mostrarlos).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Incorporar el 'Purpose Test' en .agents/skills/worldclass-product-designer/SKILL.md para descartar técnicas visuales no justificadas
- [x] #2 Documentar en la skill de diseño la prohibición de clichés de IA (orbes de gradiente azul-violeta por defecto, glassmorphism masivo, sombras desmedidas)
- [x] #3 Establecer la regla de veracidad en copy: prohibir la invención de estadísticas, testimonios y afirmaciones hiperbólicas en componentes o mockups
- [x] #4 Incorporar en .agents/skills/code-level-ux-auditor/SKILL.md la auditoría estática o heurística de sobrecarga decorativa que afecte el contraste y la jerarquía
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Actualizar `.agents/skills/worldclass-product-designer/SKILL.md` con las secciones de Purpose Test y catálogo de patrones de UI slop a evitar.
2. Añadir pautas de copywriting sobrio y basado en evidencia a la documentación de diseño.
3. Reforzar el checklist de auditoría UX en `.agents/skills/code-level-ux-auditor/SKILL.md`.
4. Validar el repositorio con `npm run validate` y `npm test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:END -->
