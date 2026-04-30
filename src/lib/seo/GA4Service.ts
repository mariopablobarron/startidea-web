/**
 * GA4Service — descarga métricas de Google Analytics 4.
 *
 * Usa:
 *   - Google Analytics Admin API v1 → listProperties
 *   - Google Analytics Data API v1  → runReport (métricas diarias por página)
 *
 * Métricas extraídas (por propertyId × fecha × pagePath):
 *   activeUsers, sessions, screenPageViews, eventCount, conversions
 *
 * Persiste con INSERT OR REPLACE → idempotente, segura para resync.
 */

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { getDb } from './db';

export type GA4Property = {
  propertyId: string;       // formato 'properties/123456789'
  displayName: string;
  parent?: string;          // 'accounts/...'
};

export async function listProperties(client: OAuth2Client): Promise<GA4Property[]> {
  const admin = google.analyticsadmin({ version: 'v1beta', auth: client });
  // Listamos cuentas, luego propiedades por cuenta.
  const accs = await admin.accounts.list({ pageSize: 200 });
  const accounts = accs.data.accounts || [];
  const all: GA4Property[] = [];
  for (const acc of accounts) {
    if (!acc.name) continue;
    const props = await admin.properties.list({
      filter: `parent:${acc.name}`,
      pageSize: 200,
    });
    for (const p of props.data.properties || []) {
      if (!p.name) continue;
      all.push({
        propertyId: p.name,
        displayName: p.displayName || p.name,
        parent: acc.name,
      });
    }
  }
  return all;
}

/**
 * Descarga métricas para una propiedad GA4 entre dos fechas (YYYY-MM-DD)
 * desglosadas por fecha + pagePath. Persiste e devuelve nº filas escritas.
 */
export async function syncDailyMetrics(
  client: OAuth2Client,
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const data = google.analyticsdata({ version: 'v1beta', auth: client });
  const propId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;

  let pageToken: string | undefined;
  let totalWritten = 0;
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO ga4_daily_metrics
      (property_id, date, page_path, active_users, sessions, page_views, event_count, conversions, synced_at)
    VALUES (@property_id, @date, @page_path, @active_users, @sessions, @page_views, @event_count, @conversions, strftime('%s','now'))
    ON CONFLICT(property_id, date, page_path) DO UPDATE SET
      active_users = excluded.active_users,
      sessions = excluded.sessions,
      page_views = excluded.page_views,
      event_count = excluded.event_count,
      conversions = excluded.conversions,
      synced_at = strftime('%s','now')
  `);

  do {
    const resp = await data.properties.runReport({
      property: propId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }, { name: 'pagePath' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'eventCount' },
          { name: 'conversions' },
        ],
        limit: '50000',
        offset: pageToken ? Number(pageToken) : '0',
        keepEmptyRows: false,
      },
    });

    const rows = resp.data.rows || [];
    const tx = db.transaction((arr: any[]) => {
      for (const r of arr) {
        const dims = r.dimensionValues || [];
        const mets = r.metricValues || [];
        const dateRaw = dims[0]?.value || ''; // YYYYMMDD
        if (!/^\d{8}$/.test(dateRaw)) continue;
        const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;
        const pagePath = dims[1]?.value || '';
        insert.run({
          property_id: propId,
          date,
          page_path: pagePath,
          active_users: parseInt(mets[0]?.value || '0', 10),
          sessions: parseInt(mets[1]?.value || '0', 10),
          page_views: parseInt(mets[2]?.value || '0', 10),
          event_count: parseInt(mets[3]?.value || '0', 10),
          conversions: parseFloat(mets[4]?.value || '0'),
        });
      }
    });
    tx(rows);
    totalWritten += rows.length;

    // Paginación: GA4 API v1 devuelve `rowCount`. Si rows < limit, no hay más.
    const limit = 50000;
    const offset = pageToken ? Number(pageToken) : 0;
    if (rows.length < limit) {
      pageToken = undefined;
    } else {
      pageToken = String(offset + rows.length);
    }
  } while (pageToken);

  return totalWritten;
}

/** Devuelve YYYY-MM-DD de hoy menos N días, en zona Europa/Madrid (suficientemente UTC para GA4). */
export function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
