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

  return response;
});
