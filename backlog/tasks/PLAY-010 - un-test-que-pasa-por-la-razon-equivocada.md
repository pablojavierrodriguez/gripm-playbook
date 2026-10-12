---
id: PLAY-010
title: "Enviar una firma nueva exige un test que falle sin el fix"
status: review
created_date: '2026-10-06'
updated_date: '2026-10-06'
labels:
  - "process"
  - "testing"
  - "quality"
dependencies: []
priority: high
type: process
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`PLAY-006` llegó al release con la capacidad rota, y la causa no fue una falta de revisión: **el test pasaba por la razón equivocada**.

El fixture de `UX-010` tenía un único caso etiquetado:

```jsx
<button><span>Guardar</span></button>
```

No contenía un icono, así que `needsContent Icon` lo filtraba **antes** de que `unlessVisibleText` evaluara nada. El test comprobaba la capacidad sin ejercitarla nunca. La conclusión "funciona" era defendible para el caso medido y falsa para el caso que importaba.

Un test que pasa sin ejecutar el código bajo prueba no es cobertura. Es decoración.

La regla que sale de acá: **un caso de regresión para una capacidad nueva tiene que fallar si la capacidad se revierte.** Si no se puede escribir el caso así, o la capacidad no es observable, o el test está probando otra cosa.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] Cada capacidad nueva del motor trae un test que falla al revertirla
- [x] La guía de contribución dice cómo verificar esa condición
- [x] El fixture de `UX-010` cubre las cinco formas etiquetadas y las dos sin nombre
- [x] La aserción cuenta las líneas que sí pueden reportarse, en vez de comprobar ausencias
- [x] Un test que pasa por una razón distinta a la que dice probar se considera defecto
<!-- AC:END -->

## Implementation Notes

La forma de verificar la condición es concreto: revertir el fix, correr la suite, ver el fallo, volver a aplicar. Si no se puede observar un fallo, el test no está probando la capacidad.

Eso es exactamente lo que falta hoy: `npm test` verifica que 46 casosdan verde, pero no verifica que esos 46 casos fallen cuando el motor se rompe. Un mutation test acotado sobre el motor —revertir cada capacidad y comprobar que algún test cae— sería la forma automatizada, y es más caro que el costo de estos dos releases.

## Acceptance Criteria Status

El fixture y la aserción ya están hechos en `PLAY-006`. Falta la guía de contribución y decidir si se automatiza.

## Note on process

Este ítem es una mejora de proceso, no de código. Nació de un defecto que llegó a producción en dos releases.