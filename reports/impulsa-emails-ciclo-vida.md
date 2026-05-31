# Startidea Impulsa — Emails del ciclo de vida

> Plantillas para acompañar a cada solicitante. El motor comercial vive aquí: **todo el mundo recibe valor (su diagnóstico), y eso abre la conversación de servicios**.
> Español neutro, sin "nosotros". Sustituye `[corchetes]`. From: hola@startidea.es · Reply-to: impulsa@startidea.es

---

## 0. Confirmación automática (YA CABLEADA en el formulario)

Se envía sola al recibir la solicitud (no hay que hacer nada). Confirma recepción y explica los siguientes pasos. Ver `src/pages/api/impulsa-solicitud.ts`.

---

## 1. Entrega del diagnóstico — A TODAS las entidades (el email clave)

> Este es el email que convierte. Aporta valor real (la hoja de ruta) y, desde esa autoridad ganada, abre la puerta comercial sin vender de forma agresiva.
> Se envía manualmente (o semi-automatizado) tras preparar el diagnóstico. Adjuntar PDF de 1-2 páginas con la valoración.

**Asunto:** El diagnóstico de comunicación de [Entidad] — Startidea Impulsa

```
Hola [nombre]:

Aquí tienes el diagnóstico de comunicación de [Entidad], dentro del programa Startidea Impulsa. Lo adjuntamos en PDF, pero te resumo lo esencial:

→ Dónde estáis hoy: [1-2 frases honestas sobre el punto de partida]
→ Las 3 palancas con más recorrido: [palanca 1], [palanca 2], [palanca 3]
→ Por dónde empezar: [la primera acción concreta, la de mayor impacto/menor esfuerzo]

Esta hoja de ruta es vuestra, la pongáis en marcha con quien la pongáis. Si os sirve, ya ha cumplido su función.

[Si seleccionada → ver email 2. Si no → ver email 3, este bloque cambia.]

Cualquier cosa, respóndeme directamente.

Un abrazo,
Mario Pablo Sánchez Barrón
Fundador · Startidea
startidea.es
```

---

## 2. Entidad SELECCIONADA

**Asunto:** [Entidad] entra en Startidea Impulsa 🎉

```
Hola [nombre]:

Buenas noticias: [Entidad] es una de las entidades seleccionadas en esta edición de Startidea Impulsa.

Según el diagnóstico, el paquete propuesto incluye:
→ [Servicio 1] — [qué resuelve]
→ [Servicio 2] — [qué resuelve]
[…]

Valor del paquete: [X] € en servicios profesionales, sin coste para [Entidad].

El siguiente paso es una reunión de 30-45 minutos para concretar alcance y plazos, y designar a la persona de contacto por vuestra parte. ¿Te viene bien alguno de estos huecos?
→ [opción 1]
→ [opción 2]

Enhorabuena, y gracias por el trabajo que hacéis.

Mario Pablo Sánchez Barrón
Fundador · Startidea
```

---

## 3. Entidad NO seleccionada (mantener caliente — aquí está el negocio recurrente)

> Importante: una "no seleccionada" no es un "no". Es un lead cualificado con un diagnóstico en la mano. Este email mantiene la relación y abre la vía de contratar parte del plan.

**Asunto:** Tu hoja de ruta de comunicación — Startidea Impulsa

```
Hola [nombre]:

En esta edición de Startidea Impulsa hemos recibido muchas más solicitudes que plazas, y [Entidad] no ha entrado en el reparto de esta convocatoria. Lo sentimos: la decisión ha sido difícil.

Dicho esto, el diagnóstico es vuestro y queremos que lo aprovechéis. Tres caminos posibles:

1. Ponerlo en marcha por vuestra cuenta con la hoja de ruta adjunta. Está pensada para eso.
2. Avisaros en la próxima edición del programa (te apuntamos si quieres).
3. Si hay una pieza que no puede esperar —la web, las redes, un vídeo—, Startidea puede ejecutarla en condiciones pensadas para el tercer sector. Sin compromiso: te cuento opciones en una llamada de 30 minutos.

¿Te interesa alguno? Respóndeme y lo vemos.

Gracias por presentar [Entidad], y por lo que hacéis.

Mario Pablo Sánchez Barrón
Fundador · Startidea
```

---

## 4. Seguimiento (si no responde al email 3, a los ~10 días)

**Asunto:** ¿Echamos un vistazo juntos a [la web / las redes] de [Entidad]?

```
Hola [nombre]:

Vuelvo sobre el diagnóstico de [Entidad]. Si tuviera que elegir una sola cosa por la que empezar, sería [la palanca de mayor impacto del diagnóstico].

Si te apetece, te propongo una llamada corta para verlo sin compromiso. ¿La semana que viene?

Mario
```

---

## Notas de uso

- **No prometer plazos imposibles** en el email 2: el paquete se ejecuta según capacidad.
- **Email 3 es el de mayor ROI comercial**: la mayoría de entidades no entrarán en el reparto, y ahí está el grueso de leads. Cuidarlo.
- Cumplir RGPD: quien pida baja, fuera de la lista (la base jurídica del contacto comercial está en el consentimiento del formulario).
- Si se automatiza el envío del diagnóstico, puede integrarse con la tabla `solicitudes_impulsa` (estado por entidad). Ampliación futura: panel admin `/admin/impulsa` con estados (recibida → diagnóstico_enviado → seleccionada/no → contactada → cliente).
```
