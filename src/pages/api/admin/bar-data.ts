// GET /api/admin/bar-data — KPIs ligeros para la AdminBar
//
// Devuelve JSON con métricas que se muestran en la barra superior:
//   - subsidies_total: convocatorias abiertas en BDNS (cache 15 min en HUB)
//   - matches_new: matches detectados en los últimos 7 días para workspace startidea
//   - leads_today: leads del diagnóstico que cayeron hoy
//   - visits_today: visitas hoy (cuando se reactive sync de seo.db)
//
// Auth: cookie de admin. Sin cookie válida → 401.
// Las llamadas al HUB usan ADMIN_TOKEN del container, nunca expuesto al cliente.

import type { APIRoute } from "astro";
import { isAdminLoggedIn, getAdminToken } from "@/lib/admin-session";

export const prerender = false;

const HUB_URL =
  (import.meta as { env?: Record<string, string> }).env?.PUBLIC_HUB_URL ??
  process.env.PUBLIC_HUB_URL ??
  "https://hub.startidea.tech";

async function fetchWithTimeout<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T | null> {
  const { timeoutMs = 3000, ...rest } = init;
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...rest, signal: ctl.signal });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminLoggedIn(cookies)) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = getAdminToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const [statsPublic, matches, leads] = await Promise.all([
    fetchWithTimeout<{
      ok: boolean;
      total: number;
      by_geo?: Record<string, number>;
    }>(`${HUB_URL}/api/public/subsidies/stats`),
    fetchWithTimeout<{ ok: boolean; total: number }>(
      `${HUB_URL}/api/admin/subsidies/matches?since_days=7`,
      { headers: authHeader },
    ),
    fetchWithTimeout<{ ok: boolean; total: number }>(
      `${HUB_URL}/api/admin/leads?since=today`,
      { headers: authHeader },
    ),
  ]);

  return new Response(
    JSON.stringify({
      ok: true,
      subsidies_total: statsPublic?.total ?? null,
      matches_new: matches?.total ?? null,
      leads_today: leads?.total ?? null,
      visits_today: null, // pendiente sync seo.db local
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    },
  );
};
