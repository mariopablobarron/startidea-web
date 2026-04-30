/**
 * SearchConsoleService — descarga datos de Google Search Console.
 *
 * Usa: webmasters v3
 *   - sites.list           → propiedades disponibles
 *   - searchanalytics.query → datos por query / page / device / country / date
 *
 * Persiste en gsc_daily_queries y gsc_daily_pages con INSERT OR REPLACE.
 */

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { getDb } from './db';

export type GSCSite = {
  siteUrl: string;
  permissionLevel: string;
};

export async function listSites(client: OAuth2Client): Promise<GSCSite[]> {
  const wm = google.webmasters({ version: 'v3', auth: client });
  const r = await wm.sites.list();
  return (r.data.siteEntry || [])
    .filter((s) => !!s.siteUrl)
    .map((s) => ({
      siteUrl: s.siteUrl!,
      permissionLevel: s.permissionLevel || 'unknown',
    }));
}

type GSCRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

async function queryGsc(
  client: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
): Promise<GSCRow[]> {
  const wm = google.webmasters({ version: 'v3', auth: client });
  const all: GSCRow[] = [];
  let startRow = 0;
  const rowLimit = 25000;

  while (true) {
    const r = await wm.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions,
        rowLimit,
        startRow,
        dataState: 'final',
      },
    });
    const rows = (r.data.rows || []) as GSCRow[];
    all.push(...rows);
    if (rows.length < rowLimit) break;
    startRow += rows.length;
    if (startRow >= 250000) break; // safety
  }
  return all;
}

/**
 * Sync diario por query (date × query × country × device).
 * @returns nº de filas insertadas/actualizadas
 */
export async function syncDailyQueries(
  client: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const rows = await queryGsc(client, siteUrl, startDate, endDate, [
    'date',
    'query',
    'country',
    'device',
  ]);

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO gsc_daily_queries
      (site_url, date, query, country, device, clicks, impressions, ctr, position, synced_at)
    VALUES (@site_url, @date, @query, @country, @device, @clicks, @impressions, @ctr, @position, strftime('%s','now'))
    ON CONFLICT(site_url, date, query, country, device) DO UPDATE SET
      clicks = excluded.clicks,
      impressions = excluded.impressions,
      ctr = excluded.ctr,
      position = excluded.position,
      synced_at = strftime('%s','now')
  `);

  const tx = db.transaction((arr: GSCRow[]) => {
    for (const r of arr) {
      const k = r.keys || [];
      insert.run({
        site_url: siteUrl,
        date: k[0] || '',
        query: k[1] || '',
        country: k[2] || '',
        device: k[3] || '',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr || 0,
        position: r.position || 0,
      });
    }
  });
  tx(rows);
  return rows.length;
}

/**
 * Sync diario por página (date × page × country × device).
 */
export async function syncDailyPages(
  client: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const rows = await queryGsc(client, siteUrl, startDate, endDate, [
    'date',
    'page',
    'country',
    'device',
  ]);

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO gsc_daily_pages
      (site_url, date, page, country, device, clicks, impressions, ctr, position, synced_at)
    VALUES (@site_url, @date, @page, @country, @device, @clicks, @impressions, @ctr, @position, strftime('%s','now'))
    ON CONFLICT(site_url, date, page, country, device) DO UPDATE SET
      clicks = excluded.clicks,
      impressions = excluded.impressions,
      ctr = excluded.ctr,
      position = excluded.position,
      synced_at = strftime('%s','now')
  `);

  const tx = db.transaction((arr: GSCRow[]) => {
    for (const r of arr) {
      const k = r.keys || [];
      insert.run({
        site_url: siteUrl,
        date: k[0] || '',
        page: k[1] || '',
        country: k[2] || '',
        device: k[3] || '',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr || 0,
        position: r.position || 0,
      });
    }
  });
  tx(rows);
  return rows.length;
}
