# Estado del trabajo — startidea-web

Foto de relevo · 8 de septiembre de 2026.

## Encargo actual

Corrección de la señal de diagnóstico/presupuesto y privacidad de su medición,
por continuación del loop autorizado por Mario. Las demás mejoras están en pausa.
No crear otra automatización; esta tarea conserva el ownership de implementación.

## Base y coordinación

- Base remota: `652b0a3`, cierre documental de PR #102. La primera tanda SEO
  publicada es `2d0a714` (PR #101), con runtime comprobado antes de esta iteración.
- Worktree propio `codex-seo-medicion-privacidad-20260908`, rama
  `codex/seo-medicion-privacidad-20260908`. Observador y worktree Claude intactos.
- El trabajo restante de Claude en `plano` no se integra en bloque. La auditoría
  revisada sigue en `8f48dec`; las cautelas sobre JOIN de GSC, landings masivas
  y promesas GEO siguen vigentes.

## Corrección

- Tras respuesta aceptada del receptor, identificador válido y honeypot vacío,
  se guarda con consentimiento una marca mínima de un solo uso (tipo y hora).
  Gracias la elimina, valida y emite `form_submit` con consentimiento vigente.
  La visita o recarga no convierten. Sin identificadores, campos libres ni tokens.
- Bloqueo durante petición y tras éxito. Redirección sin espera analítica; emitir
  en el documento estable evita el batch perdido al navegar reproducido en Chrome.
  Un fallo de etiqueta no interrumpe la solicitud. No se promete idempotencia HUB.
- SDK solo con aceptación explícita y fuera de páginas privadas. Excepción
  mínima de confirmación con marca válida, sin pageview ni tracking genérico de utilidad.
- Visitas GA4/Umami saneadas; Clarity/Spotify/GTM omitidos con contexto sensible.
  Atribución opcional minimizada. Revocar detiene las instancias con recarga,
  avisada en el banner; no se alteran sus opciones ni textos de política.
- Umami pasa a muestra consentida: el panel y los documentos explican que el
  histórico no es directamente comparable. No atribuir su descenso a SEO.

## Validación y estado

- 150 pruebas focalizadas y build completo (374 s) pasan. Ocho escenarios de
  formularios con transporte simulado y seis comprobaciones de consentimiento
  con SDK real pasan. Seis escenarios de formularios con SDK real también pasan:
  una señal mínima por aceptación consentida, sin automáticos ni datos privados.
  Todas las solicitudes y mediciones de prueba se interceptan.
- Sin integración ni despliegue de esta corrección todavía.
- No cambios en HUB, políticas comerciales, precios, checkout, noindex, Lazo,
  vídeo ni regalos ocultos. Las pruebas no crean leads, correos ni pagos.
- Evidencias privadas en `../seo-baseline-privado-20260908/`, fuera del repo público.

## Siguiente acción

Integrar y verificar versión/runtime con el mecanismo
real de pull del VPS. Después cerrar el relevo. La recepción en Google y las
nuevas definiciones de GA4 siguen pendientes si no pueden probarse sin datos reales.

Detalle: `docs/seo-medicion-privacidad-2026-09.md`.
