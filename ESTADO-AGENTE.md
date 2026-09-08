# Estado del trabajo — startidea-web

Foto de relevo · 8 de septiembre de 2026.

## Encargo actual

Terminada la corrección de medición y privacidad del loop autorizado por Mario.
No crear otra automatización. La coordinación existente conserva la siguiente acción.

## Código e integración

- PR #103 integrada: `dca237f7dc88703a1c08376d9ad45930a8de3311`.
  Base `652b0a3`; fuentes validadas en `c5ae252` y equivalentes tras el squash.
- La primera tanda SEO permanece en PR #101 (`2d0a714`): recorridos de notas,
  servicios y cursos, recomendaciones estables y limpieza de sitemap/utilidades.
- Trabajo en worktree propio `codex-seo-medicion-privacidad-20260908`.
  Observador y worktree Claude `plano` intactos; no integrar aquel trabajo en bloque.

## Resultado

- Tras aceptación probada del receptor y consentimiento se guarda una marca
  mínima de un uso (tipo y hora, cinco minutos). Gracias la elimina antes de
  medir con consentimiento vigente. Visitar o recargar no equivale a aceptación.
- Sin IDs del receptor, campos del formulario o tokens en la señal. Bloqueo de
  doble clic; sin esperar a Analytics antes de navegar. Un fallo de medición no
  interrumpe la solicitud. El receptor HUB no se ha modificado.
- SDK analíticos tras aceptación explícita, fuera de utilidades; única excepción
  mínima de confirmación con marca válida, sin pageview de esa página.
  URL/referente saneados; atribución minimizada. Revocación con recarga avisada.
- La muestra de GA4/Umami cambia: una bajada de visitas medidas no prueba pérdida SEO.
  No se han cambiado títulos comerciales, canonical, sitemap, noindex, precios,
  checkout, Lazo, vídeo ni textos de política en esta corrección.

## Despliegue y validación

- Pull automático KVM8 iniciado 15:58:03 UTC. Código de build completo `dca237f…`;
  imagen `cmoh7d8hi001bp2a4qwjobhzy:dca237f`, contenedor `running/healthy` y deploy OK
  comprobados hacia 16:03 UTC. Home HTTPS 200. Este cierre documental no pide deploy.
- Local: 150 pruebas y build completo (374 s); ocho recorridos con transporte
  simulado, seis con SDK Google real y seis comprobaciones de privacidad pasan.
- Producción: seis recorridos con SDK real, seis comprobaciones de privacidad
  y diez URL con estado, títulos, canonical e indexación correctos. Sin errores JS.
  Éxitos consentidos: una señal cada uno; rechazo/error/bot y recargas: ninguna nueva.
- Todos los receptores y colecciones se interceptaron: sin leads, correos ni pagos
  de prueba. Evidencias en `../seo-baseline-privado-20260908/`, fuera del repo público.

## Límites y siguiente acción

La recepción/procesamiento en los informes de Google sigue sin acreditarse. El
receptor tampoco garantiza idempotencia ante respuesta de red perdida. Las
nuevas definiciones de GA4 y el JOIN de consultas/páginas de GSC en HUB siguen
pendientes; no usar aquella alerta para decidir canibalización. Las demás mejoras
SEO siguen pausadas hasta cerrar la comprobación de medición.

Única siguiente acción: verificar en GA4 la próxima aceptación real consentida,
sin fabricar conversiones. No requiere una nueva autorización de Mario.

Detalle: `docs/seo-medicion-privacidad-2026-09.md`.
