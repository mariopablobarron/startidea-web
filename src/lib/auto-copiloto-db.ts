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
  // Campos de contexto adicional para mejorar la generación IA
  anos_activos: number;              // años que lleva activa la org
  beneficiarios_anuales: number;     // nº beneficiarios directos/año
  presupuesto_anual: string;         // rango ej: "50.000-100.000"
  proyectos_anteriores: string;      // texto libre: proyectos financiados anteriores
  logros_principales: string;        // indicadores de impacto históricos
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
  deadline: string | null;       // ISO date "YYYY-MM-DD" del plazo de presentación
  reminded_7d: number;           // 0/1 — si ya se envió recordatorio de 7 días
  reminded_2d: number;           // 0/1 — si ya se envió recordatorio de 2 días
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
      id                   TEXT PRIMARY KEY,
      manage_token         TEXT NOT NULL UNIQUE,
      confirm_token        TEXT,
      confirmed            INTEGER NOT NULL DEFAULT 0,
      active               INTEGER NOT NULL DEFAULT 1,
      email                TEXT NOT NULL,
      org_nombre           TEXT NOT NULL,
      org_cif              TEXT NOT NULL DEFAULT '',
      org_tipo             TEXT NOT NULL DEFAULT 'asociacion',
      org_descripcion      TEXT NOT NULL DEFAULT '',
      representante        TEXT NOT NULL DEFAULT '',
      telefono             TEXT NOT NULL DEFAULT '',
      web                  TEXT NOT NULL DEFAULT '',
      ccaa                 TEXT NOT NULL DEFAULT '',
      keywords             TEXT NOT NULL DEFAULT '',
      finalidades          TEXT NOT NULL DEFAULT '[]',
      territorios          TEXT NOT NULL DEFAULT '["nacional"]',
      importe_min          INTEGER NOT NULL DEFAULT 0,
      importe_max          INTEGER,
      auto_generar         INTEGER NOT NULL DEFAULT 1,
      created_at           INTEGER NOT NULL,
      last_run_at          INTEGER,
      anos_activos         INTEGER NOT NULL DEFAULT 0,
      beneficiarios_anuales INTEGER NOT NULL DEFAULT 0,
      presupuesto_anual    TEXT NOT NULL DEFAULT '',
      proyectos_anteriores TEXT NOT NULL DEFAULT '',
      logros_principales   TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS auto_copiloto_log (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id          TEXT NOT NULL,
      convocatoria_slug   TEXT NOT NULL,
      convocatoria_title  TEXT NOT NULL DEFAULT '',
      expediente_id       TEXT,
      sent                INTEGER NOT NULL DEFAULT 0,
      error               TEXT,
      created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
      deadline            TEXT,
      reminded_7d         INTEGER NOT NULL DEFAULT 0,
      reminded_2d         INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_acp_log_profile
      ON auto_copiloto_log (profile_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_acp_log_dedup
      ON auto_copiloto_log (profile_id, convocatoria_slug);
  `);

  // Migraciones seguras para columnas añadidas tras el despliegue inicial
  const colMigrations = [
    `ALTER TABLE auto_copiloto_profiles ADD COLUMN anos_activos INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE auto_copiloto_profiles ADD COLUMN beneficiarios_anuales INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE auto_copiloto_profiles ADD COLUMN presupuesto_anual TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE auto_copiloto_profiles ADD COLUMN proyectos_anteriores TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE auto_copiloto_profiles ADD COLUMN logros_principales TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE auto_copiloto_log ADD COLUMN deadline TEXT`,
    `ALTER TABLE auto_copiloto_log ADD COLUMN reminded_7d INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE auto_copiloto_log ADD COLUMN reminded_2d INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const sql of colMigrations) {
    try { _db.exec(sql); } catch { /* columna ya existe — ignorar */ }
  }
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
  anos_activos?: number;
  beneficiarios_anuales?: number;
  presupuesto_anual?: string;
  proyectos_anteriores?: string;
  logros_principales?: string;
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
    anos_activos: data.anos_activos ?? 0,
    beneficiarios_anuales: data.beneficiarios_anuales ?? 0,
    presupuesto_anual: data.presupuesto_anual ?? '',
    proyectos_anteriores: data.proyectos_anteriores ?? '',
    logros_principales: data.logros_principales ?? '',
  };

  db.prepare(`
    INSERT INTO auto_copiloto_profiles (
      id, manage_token, confirm_token, confirmed, active, email, org_nombre, org_cif,
      org_tipo, org_descripcion, representante, telefono, web, ccaa, keywords,
      finalidades, territorios, importe_min, importe_max, auto_generar, created_at,
      anos_activos, beneficiarios_anuales, presupuesto_anual, proyectos_anteriores, logros_principales
    ) VALUES (
      @id, @manage_token, @confirm_token, @confirmed, @active, @email, @org_nombre, @org_cif,
      @org_tipo, @org_descripcion, @representante, @telefono, @web, @ccaa, @keywords,
      @finalidades, @territorios, @importe_min, @importe_max, @auto_generar, @created_at,
      @anos_activos, @beneficiarios_anuales, @presupuesto_anual, @proyectos_anteriores, @logros_principales
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
  deadline?: string | null;  // ISO "YYYY-MM-DD"
}): boolean {
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO auto_copiloto_log
        (profile_id, convocatoria_slug, convocatoria_title, expediente_id, sent, error, deadline)
      VALUES
        (@profile_id, @convocatoria_slug, @convocatoria_title, @expediente_id, @sent, @error, @deadline)
    `).run({
      profile_id: data.profile_id,
      convocatoria_slug: data.convocatoria_slug,
      convocatoria_title: data.convocatoria_title ?? '',
      expediente_id: data.expediente_id ?? null,
      sent: data.sent ? 1 : 0,
      error: data.error ?? null,
      deadline: data.deadline ?? null,
    });
    return true;
  } catch {
    return false; // UNIQUE violation = ya procesado
  }
}

/**
 * Devuelve entradas del log cuyo deadline cae en los próximos `daysAhead` días
 * y que todavía no han recibido ese recordatorio.
 */
export function getPendingReminders(daysAhead: 7 | 2): Array<AutoCopilotoLog & {
  email: string;
  org_nombre: string;
  representante: string;
  manage_token: string;
}> {
  const db = getDb();
  const col = daysAhead === 7 ? 'reminded_7d' : 'reminded_2d';
  return db.prepare(`
    SELECT l.*, p.email, p.org_nombre, p.representante, p.manage_token
    FROM auto_copiloto_log l
    JOIN auto_copiloto_profiles p ON p.id = l.profile_id
    WHERE l.sent = 1
      AND l.deadline IS NOT NULL
      AND l.${col} = 0
      AND date(l.deadline) = date('now', '+${daysAhead} days')
      AND p.active = 1 AND p.confirmed = 1
  `).all() as Array<AutoCopilotoLog & { email: string; org_nombre: string; representante: string; manage_token: string }>;
}

/**
 * Marca el recordatorio de N días como enviado para una entrada del log.
 */
export function markReminded(logId: number, daysAhead: 7 | 2): void {
  const db = getDb();
  const col = daysAhead === 7 ? 'reminded_7d' : 'reminded_2d';
  db.prepare(`UPDATE auto_copiloto_log SET ${col} = 1 WHERE id = ?`).run(logId);
}

export function isAlreadyProcessed(profile_id: string, convocatoria_slug: string): boolean {
  const db = getDb();
  const row = db
    .prepare('SELECT 1 FROM auto_copiloto_log WHERE profile_id = ? AND convocatoria_slug = ?')
    .get(profile_id, convocatoria_slug);
  return row !== undefined;
}

/**
 * Reactiva un perfil pausado (active = 1).
 * Devuelve false si el token no existe.
 */
export function reactivateProfile(manageToken: string): boolean {
  const db = getDb();
  const info = db
    .prepare('UPDATE auto_copiloto_profiles SET active = 1 WHERE manage_token = ?')
    .run(manageToken);
  return info.changes > 0;
}

/**
 * Devuelve las últimas N entradas del log para un perfil (más reciente primero).
 */
export function getLogByProfile(profile_id: string, limit = 20): AutoCopilotoLog[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM auto_copiloto_log WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(profile_id, limit) as AutoCopilotoLog[];
}

/**
 * Lista TODOS los perfiles para el panel admin (activos, pausados, no confirmados).
 */
export function listAllProfiles(limit = 200): AutoCopilotoProfile[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM auto_copiloto_profiles ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as AutoCopilotoProfile[];
}

/**
 * Estadísticas de perfiles para el panel admin.
 */
export function statsProfiles(): {
  total: number;
  active: number;
  confirmed: number;
  pendingConfirm: number;
  paused: number;
} {
  const db = getDb();
  const all = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN active = 1 AND confirmed = 1 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN confirmed = 1 THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN confirmed = 0 THEN 1 ELSE 0 END) AS pendingConfirm,
      SUM(CASE WHEN active = 0 AND confirmed = 1 THEN 1 ELSE 0 END) AS paused
    FROM auto_copiloto_profiles
  `).get() as { total: number; active: number; confirmed: number; pendingConfirm: number; paused: number };
  return all;
}

/**
 * Devuelve el primer perfil (más antiguo) asociado a un email.
 * Incluye perfiles inactivos y no confirmados (para el CRM admin).
 */
export function getProfileByEmail(email: string): AutoCopilotoProfile | null {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM auto_copiloto_profiles WHERE LOWER(email) = LOWER(?) ORDER BY created_at ASC LIMIT 1`)
    .get(email) as AutoCopilotoProfile | null;
}
