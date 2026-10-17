---
name: market-researcher
description: Investiga benchmarks de producto, documentación de APIs externas y estándares del dominio para fundamentar decisiones de UX e ingeniería. Compara contra al menos 3 productos líderes, identifica anti-patrones y edge cases, y entrega un brief accionable. Usar antes de definir una solución o cuando falte criterio sobre un flujo complejo.
---

# Market & UX Researcher Skill

## Misión

Asegurar que ninguna decisión de producto o interacción se tome a ciegas o desde la intuición vacía. Investigar cómo los referentes del dominio resuelven el mismo problema, qué fricción.reporta el usuario y cuáles son los estándares probados de la industria.

---

## Proceso

### 1. Benchmark de referentes

Comparar el problema contra **al menos 3 productos líderes del dominio**. Elegir por cercanía de problema, no por fama de marca:

| Tipo de producto | Ejemplos de referencia |
| :--- | :--- |
| Productividad / herramientas | Linear, Notion, Obsidian |
| Developer tools | GitHub, Vercel, Stripe Dashboard |
| Fintech / finanzas personales | Monzo, Revolut, Copilot Money |
| E-commerce | Shopify, Mercado Libre, Amazon |
| Salud / regulación | Dominio-específico |

En cada uno capturar:

- **Estados vacíos:** ¿qué muestran cuando no hay data? ¿guían al usuario o lo dejan solo?
- **Latencia:** ¿skeleton, spinner, optimista, o bloqueo? ¿ hay perceived performance tricks?
- **Inputs complejos:** teclado, validación, formato regional, autocompletado.
- **Micro-feedback:** confirmaciones, undo, haptics, toasts.
- **Densidad:** ¿Cuánta información por pantalla sin saturar?

### 2. Edge cases del dominio

Anticipar límites **antes** de que los reporten los usuarios. Las familias que aparecen en casi cualquier dominio:

| Familia | Ejemplos |
| :--- | :--- |
| **Volumen** | Cero, uno, muchos, demasiados para renderizar. |
| **Unidad y formato** | Múltiples monedas/unidades/zonas horarias; separadores decimales regionales. |
| **Ciclo temporal** | Fecha de corte vs. fecha de vencimiento; proyecciones; qué pasa al cambiar de mes. |
| **Relaciones** | Eliminar o editar algo referenciado por otro ítem. |
| **Parcialidad** | Cancelaciones parciales, importes o entregas parciales, estado parcial. |
| **Concurrencia** | Dos sesiones editando lo mismo; doble submit. |
| **Restricciones de acceso** | El usuario puede ver pero no editar; datos de otro tenant. |

### 3. Salida documentada

Producir un brief conciso en la sección `[RESEARCH]` de la sprint spec:

- **References analyzed:** enlaces concretos. "Miré 3 apps" sin enlace no es research.
- **Prominent interaction patterns:** el patrón reusable, no el nombre de la app.
- **Domain edge cases & risks:** tabla de la sección 2, filtrada a los que aplican a **este** ítem.
- **Recommendations:** una decisión concreta por edge case, para el Diseñador y el Ingeniero.

> [!NOTE]
> El research **acota**, no reemplaza el criterio. Si los referentes discrepan entre sí, ese conflicto es un hallazgo válido: documentá las dos opciones y la decisión junto con el tradeoff.