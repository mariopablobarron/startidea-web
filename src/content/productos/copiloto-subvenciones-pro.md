---
title: "Copiloto de subvenciones Pro"
seoTitle: "Copiloto de subvenciones Pro con IA"
description: "La versión de pago del Copiloto de subvenciones que Startidea ofrece gratis. Añade encaje real con la organización, checklist de elegibilidad, borrador de memoria adaptado al baremo y recordatorios de plazo. Para presentarse a más convocatorias con menos horas."
metaDescription: "Copiloto de subvenciones Pro: alertas con encaje real, checklist de elegibilidad y borrador de memoria con IA para el tercer sector. Desde 19 €/mes."
pubDate: 2026-09-08
orden: 2
claim: "Cada convocatoria que encaja, con su memoria empezada."
categoria: "Financiación"
audience: ["Tercer sector", "Instituciones", "Empresas con propósito"]
modelo: "Suscripción mensual por organización"
precio_desde: "19 €/mes"
estado: "Beta"
base_hub: "Media"
rentabilidad: 5
beta: "Q4 2026"
tags: ["subvenciones", "IA", "autoservicio", "BDNS"]
tldr: "El Copiloto de subvenciones Pro convierte el buscador y las alertas gratuitas de startidea.es en un producto de suscripción. Por 19 a 39 € al mes la organización recibe solo las convocatorias en las que encaja de verdad, una checklist de elegibilidad, un borrador de memoria adaptado al baremo y recordatorios de plazo. Se apoya en el rastreo diario de la BDNS que Startidea ya mantiene."
faqs:
  - question: "¿Qué diferencia hay con el Copiloto gratuito?"
    answer: "El gratuito avisa de convocatorias y envía documentación preliminar. El Pro cruza cada convocatoria con los datos reales de la organización, dice si es elegible y por qué, y deja un borrador de memoria adaptado a los criterios de valoración."
  - question: "¿Sustituye al servicio de tramitación a éxito?"
    answer: "No. El Pro es para entidades que presentan por su cuenta. Si prefieren que Startidea gestione el expediente completo, sigue disponible el servicio a comisión de éxito del 12 %."
  - question: "¿Cubre convocatorias de toda España?"
    answer: "Sí. El rastreo cubre la Base de Datos Nacional de Subvenciones y los boletines autonómicos, con especial profundidad en Andalucía."
---

## El problema

Las entidades pequeñas pierden convocatorias por tres motivos: no se enteran a tiempo, no saben si son elegibles y no tienen a nadie que empiece la memoria. El buscador gratuito de Startidea resuelve el primero. Los otros dos siguen abiertos y son los que cuestan dinero.

## El cliente

- Asociaciones y fundaciones que presentan entre dos y diez convocatorias al año sin técnico de proyectos.
- Cooperativas y empresas con propósito que se presentan a ayudas de la Junta y del Estado.
- Ayuntamientos pequeños sin oficina de captación de fondos.

## El producto

1. **Perfil de la organización.** Forma jurídica, territorio, líneas de actividad, presupuesto, subvenciones anteriores. Se rellena una vez y se mantiene.
2. **Encaje real.** Cada convocatoria nueva se cruza con el perfil. La organización recibe solo las que encajan, con una puntuación y el motivo.
3. **Checklist de elegibilidad.** Qué requisitos cumple, cuáles no y qué documentos hacen falta.
4. **Borrador de memoria.** Estructurado según los criterios de valoración de la convocatoria, con los datos de la organización ya puestos.
5. **Recordatorios de plazo.** Por email y Telegram, con antelación configurable.

## Cómo lo construye y lo opera la IA

El rastreo diario de la BDNS, el buscador y las alertas ya funcionan en startidea.es. El Pro añade una capa de razonamiento por organización: un modelo de lenguaje lee las bases de la convocatoria y el perfil, y produce encaje, checklist y borrador. Todo el código se desarrolla con agentes de codificación sobre la base existente.

- **Lectura de bases:** extracción estructurada de requisitos, plazos y criterios de valoración.
- **Encaje:** comparación entre requisitos y perfil, con explicación en lenguaje llano.
- **Borrador:** generación guiada por el baremo, nunca una memoria "genérica".
- **Entrega:** email, Telegram y panel privado.

## Modelo de ingresos

| Plan | Precio | Incluye |
|---|---|---|
| Pro | 19 €/mes | Encaje real, checklist y recordatorios |
| Pro Memoria | 39 €/mes | Todo lo anterior y borrador de memoria por convocatoria |
| Red | A medida | Federaciones y plataformas con varias entidades |

El coste variable por organización está por debajo de 2 € al mes. El margen bruto supera el 90 %. Además, el Pro alimenta el servicio gestionado a éxito: cuando la entidad ve el trabajo que queda, muchas prefieren que Startidea lo presente.

## Salida al mercado

- **Base instalada:** las organizaciones que ya reciben alertas gratuitas. Es un cambio de plan, no una venta fría.
- **Contenido propio:** las fichas de convocatorias de startidea.es, que ya posicionan en Google y en los asistentes de IA.
- **Federaciones:** precio de grupo para redes que agrupan decenas de entidades.

## Métricas que importan

- Conversión de alerta gratuita a Pro. Objetivo del 5 % en el primer año.
- Convocatorias presentadas por organización y año.
- Paso de Pro a servicio gestionado a éxito.

## Hoja de ruta a 90 días

1. **Mes 1.** Perfil de organización y encaje real sobre las alertas actuales.
2. **Mes 2.** Checklist de elegibilidad y recordatorios. Beta con las cincuenta organizaciones más activas del buscador.
3. **Mes 3.** Borrador de memoria adaptado al baremo y apertura del plan Pro Memoria.

## Riesgos

- **Falsos positivos en el encaje.** Una organización que recibe convocatorias en las que no encaja deja de confiar. Se mitiga con puntuación explicada y umbral conservador.
- **Cambios en la BDNS.** El rastreo ya lleva meses en producción y se vigila a diario.
- **Expectativa de "memoria terminada".** El borrador es un punto de partida. Se comunica así en todo el producto.

## Qué necesita Startidea para lanzarlo

Definir el perfil de organización, cobro por Stripe y elegir las organizaciones de la beta entre las que ya usan las alertas. El rastreo y el buscador ya existen.
