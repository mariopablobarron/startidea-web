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
  // Bloquea APIs sensibles
  if (!headers.has('permissions-policy')) {
    headers.set(
      'permissions-policy',
      'geolocation=(), camera=(), microphone=(), payment=()',
    );
  }

  // Content-Security-Policy — defensa XSS + clickjacking + data exfiltration.
  //
  // Trade-offs explícitos:
  //  - 'unsafe-inline' en script-src: necesario por Astro inline scripts
  //    (component <script> tags) y por algunos handlers inline en formularios.
  //    Sin esto, el wizard de subvenciones no funciona.
  //  - 'unsafe-inline' en style-src: necesario por style props inline de
  //    Tailwind + style="color:..." en componentes server.
  //  - img-src https: amplio porque las OG images y posibles referencias a
  //    imágenes externas (BOJA, gov.es) deben cargar.
  //  - frame-ancestors 'none': más estricto que el x-frame-options=SAMEORIGIN
  //    anterior. Bloquea totalmente embeddings en iframes externos.
  //  - form-action: permite el form de Buttondown para suscripción newsletter.
  //
  // Hosts externos legítimos:
  //  - analytics.hubstartidea.es → Umami analytics (script + beacon)
  //  - buttondown.email → suscripción newsletter
  if (!headers.has('content-security-policy')) {
    const csp = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' https://analytics.hubstartidea.es`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: https:`,
      `font-src 'self' data:`,
      `connect-src 'self' https://analytics.hubstartidea.es`,
      `form-action 'self' https://buttondown.email`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `object-src 'none'`,
      `upgrade-insecure-requests`,
    ].join('; ');
    headers.set('content-security-policy', csp);
  }

  return response;
});
