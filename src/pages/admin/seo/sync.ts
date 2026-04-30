/**
 * POST /admin/seo/sync
 *
 * Dispara una sincronización completa para TODAS las propiedades habilitadas
 * de TODAS las conexiones Google activas:
 *   - GA4: últimos 28 días por property × date × pagePath
 *   - GSC: últimos 28 días por site × date × query/page × country × device
 * Después corre el analizador de oportunidades.
 *
 * Respuesta JSON con el resumen de la run.
 *
 * Para uso vía cron externo, también acepta GET con ?token=ADMIN_TOKEN.
 */
import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/seo/auth';
import { getDb } from '@/lib/seo/db';
import { listActiveConnections, getOAuthClient } from '@/lib/seo/GoogleOAuthService';
import * as GA4 from '@/lib/seo/GA4Service';
import * as GSC from '@/lib/seo/SearchConsoleService';
import { analyze } from '@/lib/seo/SeoOpportunityService';

export const prerender = false;

async function runSync(): Promise<any> {
  const db = getDb();
  const startRow = db.prepare(
    `INSERT INTO seo_agent_runs (status) VALUES ('running')`,
  ).run();
  const runId = Number(startRow.lastInsertRowid);

  const startDate = GA4.dateNDaysAgo(28);
  const endDate = GA4.dateNDaysAgo(1);

  let ga4Rows = 0;
  let gscQueryRows = 0;
  let gscPageRows = 0;
  let opps = 0;
  let errorMessage: string | null = null;

  try {
    const conns = listActiveConnections();
    if (conns.length === 0) {
      throw new Error('Ninguna cuenta Google conectada — visita /admin/google/status');
    }

    for (const conn of conns) {
      const client = getOAuthClient(conn);

      // GA4: descubrir o usar las propiedades guardadas
      const ga4Props = db
        .prepare(`SELECT property_id FROM seo_properties WHERE connection_id = ? AND kind = 'ga4' AND enabled = 1`)
        .all(conn.id) as { property_id: string }[];

      const ga4Targets = ga4Props.length > 0
        ? ga4Props.map((p) => p.property_id)
        : (await GA4.listProperties(client)).map((p) => p.propertyId);

      // Si no había propiedades guardadas, las descubrimos y registramos.
      if (ga4Props.length === 0) {
        const discovered = await GA4.listProperties(client);
        const upsert = db.prepare(
          `INSERT OR IGNORE INTO seo_properties (connection_id, kind, property_id, property_name)
           VALUES (?, 'ga4', ?, ?)`,
        );
        for (const p of discovered) upsert.run(conn.id, p.propertyId, p.displayName);
      }

      for (const propId of ga4Targets) {
        ga4Rows += await GA4.syncDailyMetrics(client, propId, startDate, endDate);
      }

      // GSC: descubrir o usar las propiedades guardadas
      const gscProps = db
        .prepare(`SELECT site_url FROM seo_properties WHERE connection_id = ? AND kind = 'gsc' AND enabled = 1`)
        .all(conn.id) as { site_url: string }[];

      let gscTargets: string[];
      if (gscProps.length === 0) {
        const discovered = await GSC.listSites(client);
        const upsert = db.prepare(
          `INSERT OR IGNORE INTO seo_properties (connection_id, kind, property_id, property_name, site_url)
           VALUES (?, 'gsc', ?, ?, ?)`,
        );
        for (const s of discovered) upsert.run(conn.id, s.siteUrl, s.siteUrl, s.siteUrl);
        gscTargets = discovered.map((s) => s.siteUrl);
      } else {
        gscTargets = gscProps.map((p) => p.site_url);
      }

      for (const site of gscTargets) {
        gscQueryRows += await GSC.syncDailyQueries(client, site, startDate, endDate);
        gscPageRows += await GSC.syncDailyPages(client, site, startDate, endDate);
      }
    }

    opps = await analyze(runId);

    db.prepare(
      `UPDATE seo_agent_runs
       SET finished_at = strftime('%s','now'), status = 'success',
           ga4_rows_synced = ?, gsc_query_rows_synced = ?, gsc_page_rows_synced = ?, opportunities_created = ?
       WHERE id = ?`,
    ).run(ga4Rows, gscQueryRows, gscPageRows, opps, runId);
  } catch (err) {
    errorMessage = (err as Error).message;
    db.prepare(
      `UPDATE seo_agent_runs
       SET finished_at = strftime('%s','now'), status = 'failed', error_message = ?
       WHERE id = ?`,
    ).run(errorMessage.slice(0, 1000), runId);
  }

  return {
    ok: !errorMessage,
    runId,
    period: { startDate, endDate },
    ga4_rows_synced: ga4Rows,
    gsc_query_rows_synced: gscQueryRows,
    gsc_page_rows_synced: gscPageRows,
    opportunities_created: opps,
    error: errorMessage,
  };
}

export const POST: APIRoute = async (context) => {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const result = await runSync();
  return new Response(JSON.stringify(result, null, 2), {
    status: result.ok ? 200 : 500,
    headers: { 'content-type': 'application/json' },
  });
};

export const GET = POST;
