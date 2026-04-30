/**
 * SQLite — base de datos del conector SEO.
 *
 * Por qué SQLite y no MySQL/Postgres:
 * - Caso de uso de un solo escritor (sync diaria) y pocas lecturas.
 * - Cero servicios externos, cero coste, backup = copiar 1 fichero.
 * - Si crece el equipo o el volumen, migrar a Postgres es directo (mismo SQL).
 *
 * Migrations idempotentes al primer uso.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.SEO_DB_PATH || path.resolve(process.cwd(), 'data/seo.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    -- Conexiones OAuth a Google (1 fila por cuenta de Google conectada)
    CREATE TABLE IF NOT EXISTS google_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_account_email TEXT NOT NULL UNIQUE,
      refresh_token_encrypted TEXT NOT NULL,
      access_token_encrypted TEXT,
      access_token_expires_at INTEGER,
      scopes TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      revoked_at INTEGER
    );

    -- Propiedades GA4 / GSC seleccionadas para sincronizar
    CREATE TABLE IF NOT EXISTS seo_properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL REFERENCES google_connections(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('ga4', 'gsc')),
      property_id TEXT NOT NULL,
      property_name TEXT,
      site_url TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(connection_id, kind, property_id)
    );

    -- Métricas diarias GA4 por página
    CREATE TABLE IF NOT EXISTS ga4_daily_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id TEXT NOT NULL,
      date TEXT NOT NULL,           -- YYYY-MM-DD
      page_path TEXT NOT NULL,
      active_users INTEGER NOT NULL DEFAULT 0,
      sessions INTEGER NOT NULL DEFAULT 0,
      page_views INTEGER NOT NULL DEFAULT 0,
      event_count INTEGER NOT NULL DEFAULT 0,
      conversions REAL NOT NULL DEFAULT 0,
      synced_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(property_id, date, page_path)
    );

    -- Métricas diarias GSC por consulta de búsqueda
    CREATE TABLE IF NOT EXISTS gsc_daily_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_url TEXT NOT NULL,
      date TEXT NOT NULL,
      query TEXT NOT NULL,
      country TEXT,
      device TEXT,
      clicks INTEGER NOT NULL DEFAULT 0,
      impressions INTEGER NOT NULL DEFAULT 0,
      ctr REAL NOT NULL DEFAULT 0,
      position REAL NOT NULL DEFAULT 0,
      synced_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(site_url, date, query, country, device)
    );

    -- Métricas diarias GSC por página
    CREATE TABLE IF NOT EXISTS gsc_daily_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_url TEXT NOT NULL,
      date TEXT NOT NULL,
      page TEXT NOT NULL,
      country TEXT,
      device TEXT,
      clicks INTEGER NOT NULL DEFAULT 0,
      impressions INTEGER NOT NULL DEFAULT 0,
      ctr REAL NOT NULL DEFAULT 0,
      position REAL NOT NULL DEFAULT 0,
      synced_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(site_url, date, page, country, device)
    );

    -- Oportunidades SEO detectadas por el analizador
    CREATE TABLE IF NOT EXISTS seo_opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,           -- p4_20, low_ctr, traffic_drop, growing_imp, cannibalization, low_conv, high_conv_low_traffic, content_gap, title_meta, internal_linking
      priority INTEGER NOT NULL,    -- 1 (alta) — 5 (baja)
      url TEXT,
      keyword TEXT,
      metric_summary TEXT NOT NULL, -- JSON con cifras que justifican la oportunidad
      recommendation TEXT NOT NULL,
      detected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      resolved_at INTEGER,
      run_id INTEGER REFERENCES seo_agent_runs(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_opportunities_priority ON seo_opportunities(priority, detected_at DESC);
    CREATE INDEX IF NOT EXISTS idx_opportunities_url ON seo_opportunities(url);

    -- Auditoría de ejecuciones del agente SEO
    CREATE TABLE IF NOT EXISTS seo_agent_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      finished_at INTEGER,
      status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
      ga4_rows_synced INTEGER NOT NULL DEFAULT 0,
      gsc_query_rows_synced INTEGER NOT NULL DEFAULT 0,
      gsc_page_rows_synced INTEGER NOT NULL DEFAULT 0,
      opportunities_created INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_runs_started ON seo_agent_runs(started_at DESC);
  `);
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
