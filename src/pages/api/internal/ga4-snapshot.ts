/**
 * POST /api/internal/ga4-snapshot
 *
 * Endpoint que recibe el resumen diario de GA4 procesado en el HUB y lo
 * guarda en la BD local de startidea-web. Esto evita que el panel /admin
 * tenga que ir al Postgres del HUB en cada carga.
 *
 * Flujo:
 *   06:00 UTC cron VPS → POST a HUB /api/admin/seo/sync-all
 *                     → HUB sincroniza GA4 → Postgres
 *                     → cron VPS hace SELECT desde Postgres con psql
 *                     → cron VPS hace POST aquí con el resumen JSON
 *                     → guardamos en expedientes.db (tabla ga4_snapshot)
 *
 * Body esperado: array de filas, una por día:
 * [
 *   {
 *     date: "2026-05-28",
 *     sessions_total: 25,
 *     page_views_total: 60,
 *     sessions_subvenciones: 6,
 *     sessions_diagnostico: 1,
 *     sessions_presentar: 2,
 *     sessions_catalogo: 0,
 *     top_path: "/subvenciones/presentar/nuevo",
 *     top_path_sessions: 6
 *   },
 *   ...
 * ]
 *
 * Auth: header `x-admin-token` con sha256(ADMIN_TOKEN) — mismo mecanismo
 * que el resto de endpoints admin del repo. El cron VPS conoce el token
 * porque puede hacer `docker exec startidea-web printenv ADMIN_TOKEN`.
 *
 * Idempotente: el upsert por date permite reenviar el mismo día sin duplicar.
 */

import type { APIRoute } from 'astro';
import { upsertGa4Snapshot } from '@/lib/expedientes-db';
import { isValidAdminHeader } from '@/lib/admin-session';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  // Auth: mismo mecanismo que el resto de endpoints admin — sha256(ADMIN_TOKEN)
  // en header x-admin-token. Reutiliza el token que el cron VPS ya conoce
  // del container, en lugar de exigir otra variable de entorno.
  if (!isValidAdminHeader(request.headers.get('x-admin-token') ?? '')) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let rows: unknown;
  try {
    rows = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  if (!Array.isArray(rows)) {
    return json({ ok: false, error: 'array_required' }, 400);
  }

  let upserted = 0;
  const errors: string[] = [];

  for (const r of rows) {
    if (!r || typeof r !== 'object') {
      errors.push('row_not_object');
      continue;
    }
    const row = r as Record<string, unknown>;
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      errors.push(`bad_date: ${row.date}`);
      continue;
    }
    try {
      upsertGa4Snapshot({
        date:                  row.date,
        sessions_total:        Number(row.sessions_total ?? 0),
        page_views_total:      Number(row.page_views_total ?? 0),
        sessions_subvenciones: Number(row.sessions_subvenciones ?? 0),
        sessions_diagnostico:  Number(row.sessions_diagnostico ?? 0),
        sessions_presentar:    Number(row.sessions_presentar ?? 0),
        sessions_catalogo:     Number(row.sessions_catalogo ?? 0),
        top_path:              typeof row.top_path === 'string' ? row.top_path : null,
        top_path_sessions:     Number(row.top_path_sessions ?? 0),
      });
      upserted++;
    } catch (e) {
      errors.push(`upsert ${row.date}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return json({
    ok: true,
    upserted,
    received: rows.length,
    errors: errors.slice(0, 10),
  });
};
