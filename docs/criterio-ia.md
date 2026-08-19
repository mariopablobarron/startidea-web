# Criterio interno de evaluación de herramientas de IA

**Documento interno. No se publica ni se enlaza desde la web.**

La rama pública «IA para el bien común» (`/laboratorio/ia`) evalúa herramientas con
cinco principios formulados en lenguaje civil. Este documento deja constancia de su
fundamento real: los principios de la **Doctrina Social de la Iglesia (DSI)**, con
*Antiqua et Nova* (Dicasterios para la Doctrina de la Fe y para la Cultura y la
Educación, enero 2025) y el *Rome Call for AI Ethics* como referencias aplicadas a IA.

La decisión editorial (Mario, 2026-08-19) es que la fuente no se explicita en la web:
el marco se comunica como «bien común» sin confesionalidad. Este mapeo existe para que
la redacción de fichas y valoraciones sea coherente con el fundamento, no decorativa.

## Mapeo principio público ↔ principio DSI

| # | Principio público (web) | Raíz DSI | Qué exige al evaluar |
|---|---|---|---|
| 1 | La persona en el centro | **Dignidad de la persona humana** — la persona es fin, nunca medio. *Antiqua et Nova*: la IA debe complementar la inteligencia humana, no sustituir su juicio. | ¿La herramienta amplifica a la persona o la reemplaza donde su presencia era el valor? ¿Degrada un trato humano que alguien necesitaba (atención, escucha, acompañamiento)? |
| 2 | Al servicio del bien común | **Bien común y destino universal de los bienes** — el beneficio de unos no puede construirse sobre el daño estructural a otros. | ¿Quién paga el coste real de la herramienta (datos de terceros, trabajo no consentido, opacidad)? ¿El ahorro se reinvierte en la misión o solo optimiza? |
| 3 | Quien la usa manda | **Subsidiariedad** — las decisiones deben quedarse en el nivel más cercano a quien las vive; la dependencia estructural de un tercero lejano es una forma de pérdida de agencia. | ¿La organización puede entender, corregir, exportar y abandonar? Preferencia por código abierto, autoalojable, europeo. La dependencia (lock-in) puntúa en contra. |
| 4 | Verdad y transparencia | **Veracidad** — la mentira y la apariencia de verdad dañan el tejido de confianza que sostiene la vida común. | ¿La herramienta facilita el engaño (contenido sintético no declarado, invención con apariencia de dato)? ¿Sus fichas y límites son honestos? Uso recomendado: verificar y declarar. |
| 5 | Cuidado del más vulnerable | **Opción preferencial por los pobres** — la medida de una estructura es cómo trata a los más frágiles. | ¿Qué pasa con los datos y la dignidad de beneficiarios, menores, víctimas? Ningún criterio de eficiencia justifica un atajo aquí. Es el principio con poder de veto. |

## Cómo se traduce en la valoración (1-5)

- La valoración de cada ficha (`valoracion` en el frontmatter) es un juicio editorial
  global contra los cinco principios, no una media aritmética.
- El principio 5 actúa como **veto**: una herramienta excelente con riesgo serio para
  personas vulnerables no pasa de 3 (ej.: ElevenLabs, por la clonación de voz).
- Los principios 2 y 3 explican por qué las opciones europeas, abiertas o autoalojables
  (Mistral, n8n, Whisper, Brevo, DeepL) puntúan alto aun cuando técnicamente no sean
  las líderes: la soberanía y la jurisdicción del dato son parte del bien común.
- La transparencia (4) exige que las fichas digan «para qué no» y «ojo con» con la misma
  claridad que «para qué sí». Una ficha sin contras es propaganda, no evaluación.

## Reglas de redacción de fichas

1. Nada entra al directorio sin haberse usado de verdad.
2. Toda ficha lleva: para qué sí, para qué no, riesgos, alternativa (si existe) y valoración.
3. Español neutro; Startidea como sujeto (nunca «nosotros»).
4. Los datos verificables (precios, planes nonprofit, jurisdicción) se comprueban antes
   de publicar y se revisan al actualizar la ficha (`updatedDate`).
5. Cuando el uso de una herramienta exige reglas éticas explícitas (consentimiento,
   declaración de contenido sintético), la ficha las nombra como condición, no como nota.
