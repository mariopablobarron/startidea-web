import { defineMiddleware } from 'astro:middleware';

// Cabeceras de seguridad aplicadas a TODAS las respuestas.
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  const headers = response.headers;

  // HSTS: fuerza HTTPS durante 1 año + subdominios
  if (!headers.has('strict-transport-security')) {
    headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }
  // No permite que el navegador adivine MIME types
  if (!headers.has('x-content-type-options')) {
    headers.set('x-content-type-options', 'nosniff');
  }
  // Solo el propio sitio puede embeberlo en iframe
  if (!headers.has('x-frame-options')) {
    headers.set('x-frame-options', 'SAMEORIGIN');
  }
  // Referrer mínimo para terceros
  if (!headers.has('referrer-policy')) {
    headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  }
  // Bloquea APIs sensibles. microphone=(self): el agente de voz (VoiceAgent)
  // necesita getUserMedia en el propio origen. NUNCA microphone=() o lo rompe.
  if (!headers.has('permissions-policy')) {
    headers.set(
      'permissions-policy',
      'geolocation=(), camera=(), microphone=(self), payment=()',
    );
  }

  // Content-Security-Policy — defensa XSS + clickjacking + data exfiltration.
  //
  // IMPORTANTE: en producción Traefik fija estas mismas cabeceras a nivel de
  // proxy (cubre TODAS las respuestas, también las páginas estáticas que NO
  // pasan por este middleware) y SOBREESCRIBE lo que ponga aquí. Este bloque
  // es la fuente de verdad de respaldo (rutas SSR / dev local). DEBE mantenerse
  // idéntico al label `startidea-sec` del docker-compose de la VPS — si tocas
  // uno, toca el otro.
  //
  // Trade-offs y orígenes (verificados en navegador con tráfico real):
  //  - 'unsafe-inline' (script+style): Astro inline scripts/estilos y handlers
  //    inline (wizard subvenciones, banner cookies, tracking).
  //  - script-src: GA4/GTM (googletagmanager.com), Clarity (*.clarity.ms),
  //    Umami (analytics.hubstartidea.es), Tailwind CDN (admin convocatorias-stats).
  //  - connect-src: beacons GA4 (*.google-analytics.com), Clarity, Umami y el
  //    agente de voz → hub.startidea.tech (transcribe/chat/speak).
  //  - media-src data: blob: → VoiceAgent: primer de audio (data:) + TTS (blob:).
  //  - img-src: self + data: + pixeles de analítica (sin imágenes externas reales).
  //  - form-action: alta de newsletter por POST directo a buttondown.email
  //    (Footer + notas). Sin esto el alta se bloquea.
  //  - frame-ancestors 'self': coherente con x-frame-options=SAMEORIGIN.
  if (!headers.has('content-security-policy')) {
    const csp = [
      `default-src 'self'`,
      `base-uri 'self'`,
      `object-src 'none'`,
      `frame-ancestors 'self'`,
      `form-action 'self' https://buttondown.email`,
      `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.googletagmanager.com https://www.clarity.ms https://*.clarity.ms https://analytics.hubstartidea.es https://cdn.tailwindcss.com`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: https://www.googletagmanager.com https://*.google-analytics.com https://www.google-analytics.com https://*.clarity.ms`,
      `font-src 'self' data:`,
      `connect-src 'self' https://analytics.hubstartidea.es https://www.googletagmanager.com https://*.google-analytics.com https://www.google-analytics.com https://analytics.google.com https://*.clarity.ms https://hub.startidea.tech`,
      `media-src 'self' data: blob:`,
      `worker-src 'self' blob:`,
      `frame-src 'self' https://www.googletagmanager.com`,
      `manifest-src 'self'`,
    ].join('; ');
    headers.set('content-security-policy', csp);
  }

  return response;
});
