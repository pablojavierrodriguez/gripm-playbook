# DOMAIN.md - Glosario Ubicuo de Dominio

> Plantilla **opt-in** para proyectos que adoptan el playbook. No es obligatoria: un proyecto sin glosario sigue siendo válido. Se recomienda cuando dos o más agentes trabajen sobre el mismo dominio.

Copiar como `DOMAIN.md` en la raíz del proyecto y completar.

---

## Por qué existe

Un glosario de dominio no es documentación. Es una **palanca de concisión y precisión**:

1. **Concisión.** El término canónico reemplaza el párrafo. "Una reserva se cancela" dice más que tres líneas explicando el flujo de cancelación.
2. **Precisión.** Evita alucinaciones conceptuales: el agente no inventa un concepto que el proyecto ya nombró de otra manera.

Cuando existe, los agentes lo consultan **antes de usar un término**, y usan el vocabulario canónico en código, mensajes de commit, ACs y conversaciones.

---

## Cómo escribir una entrada

Cada concepto sigue la misma plantilla. La disciplina es lo que lo hace útil: sin la regla del nombre, el glosario degenera en un documento más.

```markdown
### <Término canónico en PascalCase o snake_case>

**Qué es:** Una frase. El significado operativo, no la definición de diccionario.

**Por qué existe:** El problema del usuario que existe. Si no hay problema, no hay término.

**No es:** El concepto parece gemelo y no lo es. Esta línea es la que más valor entrega:
previene la confusión con el término vecino.

**Ejemplo:** Un caso concreto y real del dominio.
```

### Reglas

| Regla | Por qué |
| :--- | :--- |
| **El nombre es el identificador del código.** El término canónico se usa literal en variables, tipos y funciones. Si el nombre del glosario y el del código difieren, uno de los dos está mal. |
| **"No es" es obligatorio.** El error más caro en un dominio es la confusión entre dos conceptos vecinos. |
| **Un término, un significado.** Si necesita dos significados, son dos términos. |
| **Sin sinónimos.** Si dos palabras significan lo mismo, queda una. |
| **Ejemplos reales, no inventados.** Un ejemplo fabricado es peor que ningún ejemplo. |
| **Fecha de revisión.** Los glosarios envejecen mal. Un término sin verificar en seis meses es una fuente de alucinación. |

> [!CAUTION]
> **Un glosario desactualizado es peor que no tener glosario.** Un término que ya no se usa induces al agente a usar código muerto. Cuando un término deja de ser parte del dominio, se **borra**; no se marca como obsoleto.

---

## Estructura del archivo

```markdown
# Domain - <Nombre del Producto>

<!-- Actualizado por última vez: YYYY-MM-DD por <rol> -->

## Glosario

### Booking
### Guest
### Reservation
### Cancellation

## Invariantes del dominio

<!-- Reglas que no se negocian. Cross-reference a las de .agents/rules/ si ya existen. -->

- Una reserva no puede solaparse con otra para la misma habitación.
- Cancelar una reserva libera el inventario de forma atómica.

## Lenguaje prohibido

<!-- Palabras que el proyecto NO usa, para evitar que el agente las reintroduzca. -->

| No usar | Usar en su lugar | Por qué |
| :--- | :--- | :--- |
| "usuario" | "guest" | Un usuario puede ser staff; un guest no. |
| "pedido" | "order" | Terminología del dominio, no de la plataforma. |
```

---

## Mantenimiento

- **Lo escribe el PO**, no el agente. El agente puede proponer entradas, pero el vocabulario del negocio es una decisión de producto.
- **Se actualiza con el dominio, no con el sprint.** Si el glosario cambia cada sprint, no era un glosario: era un changelog.
- **El agente señala las brechas.** Si encontrás un concepto del proyecto que no está en el glosario y lo usás dos o más veces, es una entrada faltante: proponela.