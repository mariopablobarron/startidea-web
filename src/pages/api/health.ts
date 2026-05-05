import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Endpoint de salud para monitores de uptime externos.
 *
 * - GET /api/health           → 200 { ok: true, ts, build, checks }
 * - GET /api/health?deep=1    → además comprueba conectividad a OpenRouter
 *                                (timeout 4 s; degraded si falla, no error)
 *
 * Nunca loguea ni expone secretos. Devuelve siempre JSON, jamás HTML.
 *
 * Uso típico desde UptimeRobot / BetterStack:
 *   - URL:        https://startidea.es/api/health
 *   - Método:     GET
 *   - Esperar:    body contiene "\"ok\":true"
 *   - Intervalo:  60 s
 */

interface CheckResult {
  ok: boolean;
  latency_ms?: number;
  detail?: string;
}

async function checkOpenRouter(): Promise<CheckResult> {
  const key = process.env.OPENROUTER_API_KEY || import.meta.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, detail: 'no_api_key' };
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return { ok: r.ok, latency_ms: Date.now() - t0, detail: `http_${r.status}` };
  } catch (e: any) {
    return { ok: false, latency_ms: Date.now() - t0, detail: e?.name || 'fetch_error' };
  }
}

export const GET: APIRoute = async ({ url }) => {
  const deep = url.searchParams.get('deep') === '1';

  const checks: Record<string, CheckResult | { ok: boolean }> = {
    telegram_config: {
      ok: Boolean(process.env.TELEGRAM_BOT_TOKEN || import.meta.env.TELEGRAM_BOT_TOKEN),
    },
    openrouter_config: {
      ok: Boolean(process.env.OPENROUTER_API_KEY || import.meta.env.OPENROUTER_API_KEY),
    },
  };

  if (deep) {
    checks.openrouter_reachable = await checkOpenRouter();
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  const body = {
    ok: allOk,
    ts: new Date().toISOString(),
    build: process.env.IMAGE_TAG || 'unknown',
    checks,
  };

  return new Response(JSON.stringify(body), {
    status: allOk ? 200 : 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};
