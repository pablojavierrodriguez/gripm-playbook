---
name: worldclass-product-designer
description: Diseña interfaces y micro-interacciones de calibre mundial. Jerarquía visual, tokens semánticos, tipografía de precisión, feedback táctil, motion con propósito y estados completos. Usar al diseñar o revisar un componente, flujo, pantalla o sistema de diseño.
---

# World-Class Product Designer Skill

## Misión

Que el producto se sienta tan pulido, reactivo y sobrio de usar como los mejores herramientas de su categoría. Cero interfaces genéricas: cada elemento interactivo debe comunicar artesanía, solidez y cuidado.

> Esta skill define **criterio de diseño**. El design system concreto (tokens, librería de componentes, framework de motion) es el del proyecto: consultalo antes de proponer valores concretos.

---

## 1. Filosofía y microcopy

La interfaz **asiste, no juzga**.

- Microcopy afirmativo y específico. Nombrar la acción, no la ausencia: "Sin actividad en este período" o "Sin elementos registrados", no "Sin datos".
- **Anti-paternalismo:** el diseño respeta la autonomía del usuario. En onboarding o hard resets nunca se imponen defaults; se ofrece siempre una bifurcación explícita entre la opción recomendada y el lienzo en blanco.
- **Estado cero:** ante ausencia de actividad o 0 registros, nunca emitir alerta ni color de error. Un estado vacío es un estado **válido**: comunícalo con serenidad y ofrecé el siguiente paso.
- Empty states proactivos: guían al primer uso con contexto y una acción concreta, no con un "no hay nada".

---

## 2. Jerarquía visual y tipografía

- Nada de grises planos ni contrastes muertos. Tokens semánticos (`primary`, `accent`, `muted-foreground`) para que el tema cambie sin tocar componentes.
- Escala tipográfica cerrada. Un tamaño arbitrario es deuda: promovelo a token o usá la escala.
- **Cifras tabulares** (`tabular-nums` o token monoespaciado de datos) en **toda** columna numérica, y en todo valor que cambie en vivo. Sin esto, los dígitos bailan.
- Separadores de miles y decimales coherentes en todos los surfaces, incluido export y gráficos.
- Tracking fino en mayúsculas pequeñas para etiquetas; nunca mayúsculas en párrafos.

---

## 3. Micro-interacciones y motion

- **Feedback inmediato al toque:** toda acción táctil responde en el mismo frame (`active:scale-[0.98]`, cambio de fondo).
- **Motion con propósito:** entrada de sheets y modales con curvas que comuniquen origen. Nada de animación decorativa que delays la respuesta.
- Transiciones cortas (150 - 250ms) para estado; más largas solo para entrada/salida de superficies.
- Respetar `prefers-reduced-motion`: es una accesibilidad, no un extra.

---

## 4. Ergonomía táctil

- **Target táctil efectivo ≥ 44×44px** en cualquier elemento clickeable. Verificado con `getBoundingClientRect()`, no con la clase CSS.
- Acciones primarias al alcance del pulgar en móvil: bottom sheets y bottom action bars.
- **Nunca más de 2 acciones visibles por fila** en listas y tarjetas. Las secundarias van a un menú con target cómodo.
- Inputs numéricos: teclado declarado según el tipo de dato (`inputMode="decimal"`, `inputMode="tel"`), con parseo por locale. Nunca `type="number"` para valores numéricos con coma o decimales.
- Sheets y modales con scroll seguro: alto máximo acotado, `overflow-y-auto`, y padding inferior que respete la safe area.

---

## 5. Layout móvil

- **Arquitectura de dos niveles en tarjetas:** desacoplar metadatos del header principal. Fila 1 = identidad y valor. Fila 2 = contexto y chips. Evita el quiebre vertical forzado de títulos largos.
- Todo contenedor scrolleable con **despeje suficiente contra la UI fija inferior** (`pb-32` + `env(safe-area-inset-bottom)`), no `pb-16`.
- Sin desbordes horizontales en 375px/390px. Probado, no asumido.
- Densidad responsive: en móvil menos columnas, más scroll vertical. Nunca una tabla de 6 columnas en 375px.

---

## 6. Estados

Todo componente interactivo define **todos** estos estados, explícitamente:

| Estado | Contenido |
| :--- | :--- |
| Default | - |
| Hover | Solo en dispositivos con puntero |
| Active / Focus | Focus ring **siempre visible** para navegación por teclado |
| Disabled | Con motivo comunicado, no solo atenuado |
| Loading | Skeleton o spinner según la latencia esperada |
| Empty | Estado cero sereno + acción siguiente |
| Error | Qué pasó + qué hacer + si es recuperable |

---

## 7. El playbook es un filtro, no una guía de estilo

Esta skill **no prescribe** colores, tipografías, radios ni valores concretos. El proyecto es dueño de su sistema visual; el playbook define el criterio con el que se juzga.

Lo que sí define es un filtro. Ante **toda** decisión visual (una técnica que ya está en el repo, una que propone el stack de diseño, o una que "se ve moderna") se aplica el **Purpose Test**:

> **¿Qué propósito de jerarquía, legibilidad o accesibilidad cumple esta técnica?**

- Si la respuesta nombra un propósito verificable (distinguir el elemento primario del secundario, sostener el contraste mínimo, marcar el elemento con foco), la técnica se queda y se documenta su función.
- Si la respuesta es decorativa, o "se ve moderno", o no se puede responder, la técnica **se retira**. No se degrada, no se matiza: se quita.

El test **quita decisiones; no agrega reglas**. Su resultado por defecto es una interfaz más sobria. Agregar una excepción exige una firma nueva en el catálogo (`UX-NNN`) declarada en ambos lados, o un capítulo nuevo con su justificación: nunca un atajo de "es cuestión de gusto".

Cuando el propósito de una técnica no es obvio, preferí la versión sin ella: el mismo resultado con menos superficie visual es mejor resultado.

---

## 8. Catálogo de clichés por defecto

Estos defaults se rechazan **a primera vista** salvo que el diseño demuestre el propósito que los justifica. No son valores prohibidos: son defaults que hay que **justificar**.

| Default | Por qué se rechaza | Pregunta antes de conservarlo |
| :--- | :--- | :--- |
| Fondo oscuro con orbes de gradiente radial azul-púrpura o cian | Es la firma visual del output genérico; no jerarquiza nada y compite con el texto que corona | ¿El gradiente separa superficies o solo decora? Si no separa, es ruido |
| Glassmorphism en cards, barra de navegación y modales **en simultáneo** | El desenfoque repetido en tres planos apila translucidez donde se necesita opacidad: el texto pierde contraste y la profundidad se vuelve ilegible | ¿En qué superficie hace falta translucidez, y cuál está por debajo? Un único plano translúcido, y el resto opaco |
| `border-radius` uniforme de tipo píldora en **todo** elemento | La cápsula comunica continuidad de forma; aplicada universalmente borra el contraste entre tipos de superficie (contenedor, control, chip, avatar) | ¿El radio está distinguiendo superficies o es un valor global por omisión? |
| Sombras sobredimensionadas en todas las capas | Cuando todo flota, nada destaca: la jerarquía se aplana y el usuario no sabe dónde tocar primero | ¿Qué capa debe estar por delante? Solo esa lleva sombra |

La prueba de conjunto: **si dos pantallas distintas del producto se ven igual, algo no está comunicando.** Un producto se reconoce por la que se parece a su categoría, no por la que se parece al resto.

---

## 9. Veracidad del copy

En componentes, copy y mockups, el contenido cumple la misma ley: **lo que se afirma es verdad o no se afirma.**

- **Prohibido** inventar estadísticas, métricas o porcentajes de ejemplo ("+10.000% ROI", "500.000 equipos confían en esto") en pantallas que se presentan como producto real.
- **Prohibido** fabricar testimonios, logos de cliente, avatars, nombres propios ni citas.
- **Prohibido** la afirmación hiperbólica o el titular sin sustancia ("desbloquea el poder de los workflows de nueva generación"). Si el titular puede pegarse a cualquier producto del sector, no dice nada.
- **Prohibido** el relleno de layout: nunca completar una tarjeta, un gráfico o un badge con un número fabricado para que la maqueta se vea poblada.

Si no hay dato real, el camino es uno de dos, y ambos son válidos:

1. Mostrar el **estado cero** real (sección 1) - sereno, con el siguiente paso - cuando el cero es un dato verdadero.
2. **Omitir** la afirmación y dejar que la superficie respire.

El placeholder de maquetado se marca como tal (`Lorem`, `-`, `0`) para que nadie lo confunda con un dato de producción. Un mockup que parece real y no lo es es un bug de contenido, no un atajo.

---

## Entregables

Especificación en la sección `[DESIGN SPEC]` de la sprint spec:

- Tokens y jerarquía visual definidos.
- Targets táctiles declarados.
- Micro-interacciones y feedback sensorial especificados.
- Los 7 estados de la sección 6 resueltos, con nombre de token donde aplique.
- Tokens como **variables semánticas**, nunca hex hardcodeado en el componente.
- Veredicto del **Purpose Test** (sección 7) para cada técnica no obvia: el propósito que la justifica, o constancia de que se retiró.
- Constancia de que el copy cumple la **veracidad** (sección 9): todo dato mostrado proviene de una fuente real, o la afirmación se omitió.