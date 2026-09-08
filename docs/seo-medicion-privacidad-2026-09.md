# Medición de solicitudes y privacidad

Esta corrección resuelve la señal de diagnóstico/presupuesto que el filtro de
páginas de utilidad suprimía tras la primera tanda SEO. Conserva el noindex y
los recorridos comerciales.

## Qué acredita una señal

Los formularios de `/diagnostico` y `/presupuesto/nuevo` llaman al receptor
existente. Solo una respuesta HTTP correcta con `ok: true`, identificador de recepción
no vacío distinto de `bot_silent` y honeypot enviado vacío permite preparar la
señal, si existe aceptación analítica. El identificador se comprueba únicamente
en memoria: no se envía a Analytics ni se guarda para medir.

El evento lleva únicamente `form_type=diagnostico|presupuesto` y contexto de
página saneado. Significa solicitud aceptada por el receptor, no correo
entregado, lead cualificado, presupuesto cerrado ni venta. Tras esa aceptación
se guarda en la pestaña una marca de un solo uso con `form_type` y hora, sin
datos del formulario. La página de confirmación la elimina antes de comprobar
su validez (máximo cinco minutos) y solo emite con consentimiento vigente.
La visita, el parámetro `kind` o los resultados visibles no acreditan recepción.
Recargar no vuelve a emitir; sin marca, con error, bot o rechazo no hay señal.

Un bloqueo impide doble clic y reentrada mientras hay una petición o una
aceptación completada. Un fallo permite reintentar. No garantiza idempotencia
del receptor ante una respuesta de red perdida. El formulario redirige sin
esperar a Analytics: la señal se intenta en el documento de confirmación.
Si el almacenamiento o la etiqueta fallan, la solicitud continúa y la señal
puede omitirse; no se reintenta una marca consumida para evitar duplicaciones.

Esta ubicación resuelve un límite reproducido con el SDK real: su callback
se ejecuta antes del envío por lotes y, en el Chrome de prueba, la navegación
del diagnóstico ocurría sin intento de transporte de la conversión. No se
añade una espera de varios segundos al visitante ni se afirma entrega garantizada.

## Elección y datos

- Se mantienen texto y opciones del banner. GA4, GTM opcional, Umami, Clarity
  y Spotify esperan aceptación explícita. «Solo esenciales» no activa SDK.
- No se recuperan eventos ocurridos antes de aceptar. La atribución comercial
  se guarda solo tras aceptación, omite términos libres y reduce referentes
  al origen; se elimina al rechazar.
- Páginas noindex y rutas personales no cargan SDK ni generan visitas. La
  única excepción es la señal mínima en `/diagnostico/gracias` tras consumir
  la marca de aceptación, con consentimiento; nunca habilita visitas ni otros
  eventos de esa página. El formulario de presupuesto no carga SDK.
- GA4 usa URL sin parámetros/fragmentos y referente reducido al origen. Se
  desactiva su pageview inicial implícito y se emite una sola vista saneada.
  No se activan Google Signals ni personalización publicitaria.
- Umami sanea sus visitas antes del envío. Clarity, Spotify y GTM opcional
  se omiten cuando la URL o su referente presentan contexto sensible.
- CTA y descargas no transmiten texto capturado, nombres de archivos ni URL
  de descarga. El evento de recepción no contiene campos libres del formulario.
- Al revocar una aceptación con SDK cargados se guarda la nueva elección y
  se recarga la página para detener esa instancia. La recarga puede descartar
  un formulario que todavía no se haya enviado. No borra datos ya enviados;
  tampoco se afirma eliminación de todas las cookies antiguas de proveedores.

## Cómo interpretar los informes

GA4 y Umami pasan a una muestra con consentimiento. Una bajada frente al
histórico anterior a esta corrección no demuestra pérdida de posicionamiento.
El diagnóstico SEO debe contrastarse con Search Console y periodos comparables.
Las definiciones personalizadas de GA4 siguen siendo una tarea distinta.

Las pruebas usan respuestas interceptadas y datos ficticios: no crean
solicitudes, correos ni pagos. Ver una llamada en la etiqueta o su callback
no demuestra recepción, procesamiento o atribución en los informes de Google.
La recepción externa debe declararse pendiente mientras no se haya comprobado.

La referencia de Google explica el [envío agrupado de eventos](https://support.google.com/analytics/answer/9322688?hl=es). La prueba de navegador diferencia la cola de la etiqueta, el intento de transporte interceptado y la recepción externa.

## Validación de esta corrección

- 150 pruebas focalizadas: 42 de aceptación, 38 de integración de consentimiento,
  20 de terceros, 9 de recorridos analíticos y 41 de sitemap.
- Build completo correcto (374 segundos), con las mismas fuentes comprobadas.
- Ocho escenarios de formularios con transporte simulado y seis con SDK Google
  real: una señal tras aceptación consentida, ninguna por error, bot, rechazo o
  recarga, y sin campos privados en los intentos de colección.
- Seis comprobaciones adicionales con SDK real cubren visitas saneadas, páginas
  de utilidad y revocación. Ninguna produjo errores JavaScript.

Los receptores y colecciones se interceptaron. Estas pruebas acreditan el
comportamiento del navegador y el intento de transporte, no recepción en Google.
