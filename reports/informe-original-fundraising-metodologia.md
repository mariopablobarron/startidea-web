# Informe original citable — metodología y plan de recogida de datos

> Objetivo: producir un **dato propio** que medios, blogs y motores de IA puedan **citar como fuente** ("según Startidea, el X% de las ONG pequeñas…"). Es la palanca de autoridad más potente para GEO/AEO: las citas con fuente y cifra son lo que los LLMs reproducen.
> Problema actual: los 4 diagnósticos del Laboratorio son datos reales pero **n=4** — insuficiente para afirmar nada como estudio. Este plan recoge una muestra honesta antes de publicar.

---

## 1. Tema del informe (el que más encaja con la autoridad de Startidea)

**"Radiografía de la dependencia pública en las entidades pequeñas del tercer sector en España"**

Pregunta central citable: *¿qué porcentaje de su presupuesto depende del dinero público una entidad pequeña, y cuántas sobrevivirían si perdieran su principal subvención?*

Por qué este tema:
- Conecta con los dos pilares fuertes (fundraising + subvenciones).
- Nadie publica este dato segmentado por tamaño pequeño en España.
- Da titulares citables: "X de cada 10 asociaciones pequeñas no sobrevivirían a perder su mayor subvención".

---

## 2. Muestra mínima para poder afirmar algo

- **Objetivo realista:** 80–150 respuestas de entidades (asociaciones/fundaciones < 300k€/año).
- **Mínimo publicable con honestidad:** 50 respuestas, declarando siempre n y método ("encuesta no probabilística a la red de Startidea").
- **Nunca** redondear ni extrapolar a "el tercer sector español" si la muestra es de conveniencia. Se dice "entre las entidades encuestadas".

---

## 3. Cuestionario (10 preguntas, < 4 min — clave para tasa de respuesta)

1. Tipo de entidad: Asociación / Fundación / Federación / Cooperativa de iniciativa social.
2. Presupuesto anual aproximado: <50k / 50–150k / 150–300k / 300k–1M / >1M €.
3. Nº de personas contratadas: 0 / 1–3 / 4–10 / >10.
4. ¿Qué % de tus ingresos viene de **dinero público** (subvenciones, convenios, contratos)? (0–100, deslizador)
5. ¿Cuál es tu **mayor fuente única** y qué % representa? (texto + %)
6. Si perdieras tu mayor fuente este año, ¿cuántos meses aguantaría la organización? <1 / 1–3 / 3–6 / 6–12 / >12.
7. ¿Tienes **base social** (socios con cuota recurrente)? Sí/No. Si sí, ¿cuántos?
8. ¿Cuántas fuentes de ingreso distintas tienes? 1 / 2 / 3 / 4+.
9. ¿Has tenido problemas de **tesorería** por retraso en el pago de la Administración en los últimos 2 años? Sí/No.
10. ¿Cuál es tu mayor reto de financiación ahora mismo? (texto libre — da citas cualitativas para el informe).

Opcional al final: email (para enviarles el informe → además capta leads/base de newsletter, con consentimiento).

---

## 4. Herramienta y montaje

- **Opción rápida:** Google Forms o Tally (gratis, export a CSV).
- **Opción integrada (mejor):** formulario propio en startidea.es (`/encuesta-fundraising`) con los datos a SQLite/Postgres → control total y otra URL indexable. Si se elige esta vía, Claude la puede montar (endpoint + tabla + página).
- Consentimiento RGPD claro: "datos anónimos para un informe agregado; el email solo para enviarte el resultado".

---

## 5. Distribución (conseguir las 50–150 respuestas)

- **Newsletter** de Startidea (Buttondown) — el canal más directo.
- **LinkedIn** de Mario + página de Startidea (post + recordatorio a la semana).
- Red de **clientes y entidades del Hub**; pedir reenvío a federaciones.
- Grupos/foros del tercer sector, plataformas autonómicas.
- Incentivo honesto: "quien participa recibe el informe completo antes que nadie".
- Ventana de recogida: 3–4 semanas.

---

## 6. Del dato al informe citable

Cuando haya muestra:
1. Claude procesa el CSV → tablas y 5–8 hallazgos con su cifra y su n.
2. Página `/informe/dependencia-publica-tercer-sector-2026` con:
   - Resumen ejecutivo con los **3 datos titulares** (lo que se cita).
   - Gráficos simples + tabla descargable.
   - Metodología transparente (n, fechas, "muestra de conveniencia").
   - Schema JSON-LD: `Dataset` + `Article` (autor #founder) → citabilidad técnica.
3. Bloque "respuesta corta" (tldr) y FAQs con los datos clave.
4. Nota de prensa breve + difusión a medios del sector y locales (Granada).
5. Cada cifra enlazada internamente desde las notas pilar de fundraising.

---

## 7. Siguiente paso (decisión de Mario)

- [ ] ¿Montamos el formulario en la web (`/encuesta-fundraising`, Claude lo construye) o usamos Tally/Google Forms para arrancar ya?
- [ ] ¿Lanzamos en la próxima newsletter? (fija fecha)
- [ ] Texto del email/post de difusión: Claude lo redacta cuando se decida el canal.

> Honestidad metodológica = parte de la autoridad. Un informe con n declarado y método transparente se cita; uno con cifras infladas se desmonta y daña la marca.
