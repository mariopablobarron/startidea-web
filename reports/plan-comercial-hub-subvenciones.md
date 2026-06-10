# Plan comercial — explotar el hub de subvenciones (2026-06-04)

> Objetivo: convertir las herramientas del hub en (a) un servicio que ofrecer a
> clientes y (b) una máquina de captación y prospección. Aterrizado en lo que
> ya existe, no en humo.

## Activos reales del hub (inventario)

| Activo | Qué hace | Estado |
|---|---|---|
| Buscador BDNS | 3.4k+ convocatorias abiertas, filtrado tercer sector | ✅ vivo (/subvenciones) |
| Backfill tercer sector | Indexa convocatorias viejas-pero-abiertas a diario | ✅ recién arreglado |
| Matcher | Puntúa encaje convocatoria ↔ entidad (scoreSubsidyForWatch) | ✅ existe |
| SubsidyWatch (alertas) | Alerta por entidad, email/Telegram | ✅ existe |
| Tramitación a éxito + Copiloto | Encontrar→formular→presentar con certificado, 12% a éxito | ✅ vivo (/subvenciones/presentar) |
| Enriquecimiento de leads | Scrapling sobre cuentas/contactos | ✅ vivo (enrich) |
| Notas + landings SEO | Tráfico orgánico (Agenda 2030, guías) | ✅ posicionando |
| Reels de marca | Difusión social | ✅ 6 hechos |

La pieza única y difícil de copiar: **cruzar "convocatoria abierta que cierra pronto" × "entidad a la que le encaja"**. Eso es prospección caliente con motivo y urgencia.

## Los 3 motores

### 1. OFERTA — qué se vende (el "suelo")
- **Producto estrella:** Subvenciones a éxito — Startidea encuentra, avisa y tramita; **12% solo si se concede**. Dos modalidades: tramitación puntual / iguala anual de fundraising.
- **Herramientas hub:** buscador + copiloto + tramitación.
- **Entregable:** one-pager comercial + afinar /subvenciones/presentar.
- **Esfuerzo:** bajo. **ROI:** inmediato (es lo que ya hacéis, mejor empaquetado).

### 2. CAPTACIÓN — que entren solos (inbound)
- **Gancho:** alerta gratuita de subvenciones para tu entidad (SubsidyWatch). Captura email + perfil → embudo a tramitación. Buscador gratis + notas SEO + reels traen el tráfico.
- **Herramientas hub:** SubsidyWatch + buscador + notas + reels.
- **Entregable:** CTA de alerta más visible en /subvenciones + secuencia de email cuando hay match (avisar de la convocatoria → ofrecer tramitarla).
- **Esfuerzo:** bajo-medio. **ROI:** medio, recurrente.

### 3. PROSPECCIÓN — proactivo (outbound, el diferenciador)
- **Núcleo:** cruzar convocatorias abiertas × lista de entidades objetivo con el matcher → tabla *(entidad, convocatoria que encaja, días para cierre, importe)*. Enriquecer contacto con Scrapling. Mensaje personalizado por entidad.
- **Mensaje tipo:** "La convocatoria X (cierra en N días) encaja con vuestro proyecto Y. Startidea la tramita a éxito — solo se cobra si se concede." (Nunca "te la conseguimos".)
- **Herramientas hub:** buscador + matcher + Scrapling + plantillas.
- **Entregable:** proceso/script que genera la lista priorizada + plantilla de mensaje. **Startidea envía; Claude nunca manda nada en su nombre.**
- **Esfuerzo:** medio-alto. **ROI:** el más alto a medio plazo.

## Mapa de priorización (la secuencia importa)

```
Semana 1  →  MOTOR 1 (oferta: one-pager) + MOTOR 2 (alerta gratis visible)
              Quick wins. Montan el "dónde aterrizan" antes de empujar.
Semana 2-3 →  MOTOR 3 (prospección con matcher)
              El diferenciador. Mayor curro, mayor retorno.
Transversal → Difusión (reels ya hechos) + nota/landing por convocatoria estrella.
```

**Por qué este orden:** prospectar (motor 3) sin oferta clara ni landing donde aterrizar (motores 1-2) quema leads. Primero el suelo, luego el empuje.

## Riesgos / honestidad (leer antes de ejecutar)

1. **Capacidad = cuello de botella.** Cada tramitación es un sprint de 2 semanas. La prospección debe calibrarse a cuántas tramitaciones se pueden cerrar BIEN, no generar más leads de los absorbibles. Mejor 10 prospectos calientes bien atendidos que 200 fríos.
2. **RGPD en el outbound.** A quién se escribe y con qué base legal importa (datos de contacto de entidades). Irónicamente, es el propio nuevo servicio RGPD de Startidea — predicar con el ejemplo.
3. **No prometer concesión.** El mensaje es "encaje + tramitación a éxito", nunca "te la conseguimos". Expectativas honestas = marca intacta.
4. **Claude no envía nada en nombre de Startidea.** Prepara listas, plantillas y materiales; Mario revisa y envía.

## Primer paso recomendado

Arrancar por el **Motor 1 (one-pager comercial)** — tangible, en hojas, listo para enseñar esta semana — y en paralelo dejar el **Motor 3** diseñado (el proceso de prospección) para empezar a generar listas la semana siguiente.
