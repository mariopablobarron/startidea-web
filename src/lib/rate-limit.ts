/**
 * rate-limit.ts
 *
 * Rate limiter en memoria (single-instance) para endpoints públicos críticos.
 *
 * Limitaciones conocidas:
 *  - El estado vive en memoria del proceso. Si el container se reinicia,
 *    los contadores se resetean. Para una app single-instance como esta
 *    (Coolify + Astro Node SSR) es suficiente; si pasamos a multi-instance
 *    habría que migrar a Redis o similar.
 *  - No protege contra ataques distribuidos (DDoS). Para eso, ya hay
 *    Cloudflare/Traefik delante.
 *
 * Uso:
 *   import { rateLimit } from '@/lib/rate-limit';
 *
 *   const limit = rateLimit({ key: ip, bucket: 'register', maxHits: 3, windowMs: 60 * 60 * 1000 });
 *   if (!limit.ok) {
 *     return new Response(JSON.stringify({ ok: false, error: 'rate_limit', retry_after_s: limit.retryAfter }), {
 *       status: 429,
 *       headers: { 'retry-after': String(limit.retryAfter) },
 *     });
 *   }
 */

interface BucketEntry {
  count: number;
  expiresAt: number;
}

// Mapa global. Key = `${bucket}:${key}` (ej. "register:1.2.3.4")
const buckets = new Map<string, BucketEntry>();

// Limpieza periódica de entradas expiradas (cada 5 min)
// Evita que el Map crezca indefinidamente.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets.entries()) {
    if (v.expiresAt <= now) buckets.delete(k);
  }
}, 5 * 60 * 1000).unref?.();

export interface RateLimitOpts {
  /** Identificador del cliente (normalmente IP, también puede ser email u otra clave) */
  key: string;
  /** Identificador del endpoint o tipo de operación (ej. 'register', 'expediente') */
  bucket: string;
  /** Número máximo de hits en la ventana */
  maxHits: number;
  /** Tamaño de la ventana en ms */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Hits realizados hasta ahora (incluyendo el actual si ok=true) */
  count: number;
  /** Segundos hasta que expire la ventana */
  retryAfter: number;
}

/**
 * Comprueba (y registra) un hit. Devuelve `ok: false` si se ha superado el límite.
 *
 * Importante: si el key viene como `'unknown'` o vacío, NO se aplica rate limit
 * (mejor no bloquear que bloquear todo el tráfico tras un proxy mal configurado).
 */
export function rateLimit(opts: RateLimitOpts): RateLimitResult {
  if (!opts.key || opts.key === 'unknown') {
    return { ok: true, count: 0, retryAfter: 0 };
  }

  const fullKey = `${opts.bucket}:${opts.key}`;
  const now = Date.now();
  const entry = buckets.get(fullKey);

  if (!entry || entry.expiresAt <= now) {
    buckets.set(fullKey, { count: 1, expiresAt: now + opts.windowMs });
    return { ok: true, count: 1, retryAfter: 0 };
  }

  if (entry.count >= opts.maxHits) {
    return {
      ok: false,
      count: entry.count,
      retryAfter: Math.ceil((entry.expiresAt - now) / 1000),
    };
  }

  entry.count += 1;
  return { ok: true, count: entry.count, retryAfter: 0 };
}

/**
 * Extrae la IP del cliente de manera robusta detrás de proxies (Traefik en Coolify).
 * Prefiere x-forwarded-for (primera IP), luego x-real-ip, luego unknown.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}
