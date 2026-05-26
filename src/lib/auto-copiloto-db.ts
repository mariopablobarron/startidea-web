/**
 * auto-copiloto-db.ts
 *
 * Tablas SQLite para el sistema de Copiloto Autónomo.
 * Las organizaciones registran su perfil una vez; el cron diario detecta
 * convocatorias que encajan y genera los documentos automáticamente.
 *
 * Tablas:
 *   auto_copiloto_profiles — perfiles de organización registrados
 *   auto_copiloto_log      — registro de generaciones (deduplicación)
 *
 * Usa la misma BD que expedientes.db para evitar WAL múltiple.
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export interface AutoCopilotoProfile {
  id: string;
  manage_token: string;
  confirm_token: string | null;
  confirmed: number;       // 0/1
  active: number;          // 0/1
  email: string;
  org_nombre: string;
  org_cif: string;
  org_tipo: string;        // asociacion | fundacion | cooperativa | empresa | otro
  org_descripcion: string; // descripción de actividades — clave para el prompt IA
  representante: string;
  telefono: string;
  web: string;
  ccaa: string;            // CCAA principal de la org
  keywords: string;        // palabras clave separadas por comas (para matching)
  finalidades: string;     // JSON array de slugs
  territorios: string;     // JSON array: ['andalucia','nacional','europa',...]
  importe_min: number;     // 0 = sin mínimo
  importe_max: number | null;
  auto_generar: number;    // 1=genera+envía docs, 0=solo notifica
  created_at: number;
  last_run_at: number | null;
}

export interface AutoCopilotoLog {
  id: number;
  profile_id: string;
  convocatoria_slug: string;
  convocatoria_title: string;
  expediente_id: string | null;
  sent: number;
  error: string | null;
  created_at: number;
}

// ─── DB singleton ──────────────────────────────────────────────────────────

function getDir(): string {
  return process.env.EXPEDIENTES_DIR ?? '/data/expedientes';
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = getDir();
  mkdirSync(dir, { recursive: true });
  _db = new Database(join(dir, 'expedientes.db'));
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS auto_copiloto_profiles (
      id              TEXT PRIMARY KEY,
      manage_token    TEXT NOT NULL UNIQUE,
      confirm_token   TEXT,
      confirmed       INTEGER NOT NULL DEFAULT 0,
      active          INTEGER NOT NULL DEFAULT 1,
      email           TEXT NOT NULL,
      org_nombre      TEXT NOT NULL,
      org_cif         TEXT NOT NULL DEFAULT '',
      org_tipo        TEXT NOT NULL DEFAULT 'asociacion',
      org_descripcion TEXT NOT NULL DEFAULT '',
      representante   TEXT NOT NULL DEFAULT '',
      telefono        TEXT NOT NULL DEFAULT '',
      web             TEXT NOT NULL DEFAULT '',
      ccaa            TEXT NOT NULL DEFAULT '',
      keywords        TEXT NOT NULL DEFAULT '',
      finalidades     TEXT NOT NULL DEFAULT '[]',
      territorios     TEXT NOT NULL DEFAULT '["nacional"]',
      importe_min     INTEGER NOT NULL DEFAULT 0,
      importe_max     INTEGER,
      auto_generar    INTEGER NOT NULL DEFAULT 1,
      created_at      INTEGER NOT NULL,
      last_run_at     INTEGER
    );

    CREATE TABLE IF NOT EXISTS auto_copiloto_log (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id          TEXT NOT NULL,
      convocatoria_slug   TEXT NOT NULL,
      convocatoria_title  TEXT NOT NULL DEFAULT '',
      expediente_id       TEXT,
      sent                INTEGER NOT NULL DEFAULT 0,
      error               TEXT,
      created_at          INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_acp_log_profile
      ON auto_copiloto_log (profile_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_acp_log_dedup
      ON auto_copiloto_log (profile_id, convocatoria_slug);
  `);
  return _db;
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export function createProfile(data: {
  email: string;
  org_nombre: string;
  org_cif?: string;
  org_tipo: string;
  org_descripcion: string;
  representante: string;
  telefono?: string;
  web?: string;
  ccaa?: string;
  keywords?: string;
  finalidades?: string[];
  territorios?: string[];
  importe_min?: number;
  importe_max?: number | null;
  auto_generar?: boolean;
}): AutoCopilotoProfile {
  const db = getDb();
  const id = randomUUID();
  const manage_token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const confirm_token = randomUUID().replace(/-/g, '');
  const now = Math.floor(Date.now() / 1000);

  const profile: AutoCopilotoProfile = {
    id,
    manage_token,
    confirm_token,
    confirmed: 0,
    active: 1,
    email: data.email,
    org_nombre: data.org_nombre,
    org_cif: data.org_cif ?? '',
    org_tipo: data.org_tipo,
    org_descripcion: data.org_descripcion,
    representante: data.representante,
    telefono: data.telefono ?? '',
    web: data.web ?? '',
    ccaa: data.ccaa ?? '',
    keywords: data.keywords ?? '',
    finalidades: JSON.stringify(data.finalidades ?? []),
    territorios: JSON.stringify(data.territorios ?? ['nacional']),
    importe_min: data.importe_min ?? 0,
    importe_max: data.importe_max ?? null,
    auto_generar: data.auto_generar !== false ? 1 : 0,
    created_at: now,
    last_run_at: null,
  };

  db.prepare(`
    INSERT INTO auto_copiloto_profiles (
      id, manage_token, confirm_token, confirmed, active, email, org_nombre, org_cif,
      org_tipo, org_descripcion, representante, telefono, web, ccaa, keywords,
      finalidades, territorios, importe_min, importe_max, auto_generar, created_at
    ) VALUES (
      @id, @manage_token, @confirm_token, @confirmed, @active, @email, @org_nombre, @org_cif,
      @org_tipo, @org_descripcion, @representante, @telefono, @web, @ccaa, @keywords,
      @finalidades, @territorios, @importe_min, @importe_max, @auto_generar, @created_at
    )
  `).run(profile);

  return profile;
}

export function confirmProfile(token: string): AutoCopilotoProfile | null {
  const db = getDb();
  const profile = db
    .prepare('SELECT * FROM auto_copiloto_profiles WHERE confirm_token = ? AND confirmed = 0')
    .get(token) as AutoCopilotoProfile | null;
  if (!profile) return null;
  db.prepare(
    'UPDATE auto_copiloto_profiles SET confirmed = 1, confirm_token = NULL WHERE id = ?',
  ).run(profile.id);
  return { ...profile, confirmed: 1, confirm_token: null };
}

export function getProfileByManageToken(token: string): AutoCopilotoProfile | null {
  const db = getDb();
  return db
    .prepare('SELECT * FROM auto_copiloto_profiles WHERE manage_token = ?')
    .get(token) as AutoCopilotoProfile | null;
}

export function deactivateProfile(manageToken: string): boolean {
  const db = getDb();
  const info = db
    .prepare('UPDATE auto_copiloto_profiles SET active = 0 WHERE manage_token = ?')
    .run(manageToken);
  return info.changes > 0;
}

export function getActiveProfiles(): AutoCopilotoProfile[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM auto_copiloto_profiles WHERE active = 1 AND confirmed = 1')
    .all() as AutoCopilotoProfile[];
}

export function markLastRun(id: string): void {
  const db = getDb();
  db.prepare('UPDATE auto_copiloto_profiles SET last_run_at = ? WHERE id = ?').run(
    Math.floor(Date.now() / 1000),
    id,
  );
}

/**
 * Registra una generación en el log.
 * Devuelve false si ya estaba registrado (UNIQUE constraint en profile+slug).
 */
export function logGeneration(data: {
  profile_id: string;
  convocatoria_slug: string;
  convocatoria_title?: string;
  expediente_id?: string;
  sent?: boolean;
  error?: string;
}): boolean {
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO auto_copiloto_log
        (profile_id, convocatoria_slug, convocatoria_title, expediente_id, sent, error)
      VALUES
        (@profile_id, @convocatoria_slug, @convocatoria_title, @expediente_id, @sent, @error)
    `).run({
      profile_id: data.profile_id,
      convocatoria_slug: data.convocatoria_slug,
      convocatoria_title: data.convocatoria_title ?? '',
      expediente_id: data.expediente_id ?? null,
      sent: data.sent ? 1 : 0,
      error: data.error ?? null,
    });
    return true;
  } catch {
    return false; // UNIQUE violation = ya procesado
  }
}

export function isAlreadyProcessed(profile_id: string, convocatoria_slug: string): boolean {
  const db = getDb();
  const row = db
    .prepare('SELECT 1 FROM auto_copiloto_log WHERE profile_id = ? AND convocatoria_slug = ?')
    .get(profile_id, convocatoria_slug);
  return row !== undefined;
}
