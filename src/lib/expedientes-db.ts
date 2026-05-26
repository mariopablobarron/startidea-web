/**
 * expedientes-db.ts
 *
 * SQLite local para gestión de expedientes del Copiloto de subvenciones.
 * Usa better-sqlite3 (ya en el proyecto para seo.db).
 * La BD vive en EXPEDIENTES_DIR (default /data/expedientes) junto a los archivos.
 *
 * Status del expediente:
 *   recibido → analizando_ia → docs_listos → entregado → presentado | rechazado
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export type ExpedienteStatus =
  | 'recibido'
  | 'analizando_ia'
  | 'docs_listos'
  | 'entregado'
  | 'presentado'
  | 'rechazado';

export interface Expediente {
  id: string;
  convocatoria_slug: string | null;
  convocatoria_title: string | null;
  convocatoria_url: string | null;
  org_nombre: string;
  org_cif: string;
  org_tipo: string;
  representante: string;
  email: string;
  telefono: string;
  provincia: string;
  descripcion_proyecto: string;
  importe_solicitado: string;
  experiencia: string;
  apoderamiento: number; // 0/1
  comentarios: string;
  como_conocio: string;
  docs_adjuntos: string; // JSON array de nombres
  ip: string;
  status: ExpedienteStatus;
  ai_memoria: string | null;
  ai_presupuesto: string | null;
  ai_checklist: string | null;
  ai_guia: string | null;
  ai_notas: string | null;
  ai_elegibilidad: string | null;    // resultado del check de requisitos
  ai_datos_faltantes: string | null; // preguntas que la IA no puede responder sin más datos
  // Contrato de comisión a éxito
  contrato_token: string | null;     // token único para enlace de aceptación
  contrato_at: number | null;        // timestamp de aceptación por el cliente
  contrato_ip: string | null;        // IP desde la que se aceptó
  contrato_sent_at: number | null;   // timestamp de envío del contrato
  // Resolución y factura
  importe_concedido: string | null;  // importe efectivamente concedido por la Admin.
  factura_num: string | null;        // número de factura (FAC-YYYY-NNN)
  factura_at: number | null;         // timestamp de generación de la factura
  created_at: number;
  updated_at: number;
  ai_at: number | null;
  delivered_at: number | null;
}

let _db: Database.Database | null = null;

function getDir(): string {
  return process.env.EXPEDIENTES_DIR ?? '/data/expedientes';
}

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = getDir();
  try {
    mkdirSync(dir, { recursive: true });
  } catch { /* already exists */ }
  const dbPath = join(dir, 'expedientes.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS expedientes (
      id                  TEXT PRIMARY KEY,
      convocatoria_slug   TEXT,
      convocatoria_title  TEXT,
      convocatoria_url    TEXT,
      org_nombre          TEXT NOT NULL,
      org_cif             TEXT NOT NULL,
      org_tipo            TEXT NOT NULL DEFAULT '',
      representante       TEXT NOT NULL,
      email               TEXT NOT NULL,
      telefono            TEXT NOT NULL DEFAULT '',
      provincia           TEXT NOT NULL DEFAULT '',
      descripcion_proyecto TEXT NOT NULL DEFAULT '',
      importe_solicitado  TEXT NOT NULL DEFAULT '',
      experiencia         TEXT NOT NULL DEFAULT '',
      apoderamiento       INTEGER NOT NULL DEFAULT 0,
      comentarios         TEXT NOT NULL DEFAULT '',
      como_conocio        TEXT NOT NULL DEFAULT '',
      docs_adjuntos       TEXT NOT NULL DEFAULT '[]',
      ip                  TEXT NOT NULL DEFAULT '',
      status              TEXT NOT NULL DEFAULT 'recibido',
      ai_memoria          TEXT,
      ai_presupuesto      TEXT,
      ai_checklist        TEXT,
      ai_guia             TEXT,
      ai_notas            TEXT,
      ai_elegibilidad     TEXT,
      ai_datos_faltantes  TEXT,
      contrato_token      TEXT,
      contrato_at         INTEGER,
      contrato_ip         TEXT,
      contrato_sent_at    INTEGER,
      importe_concedido   TEXT,
      factura_num         TEXT,
      factura_at          INTEGER,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL,
      ai_at               INTEGER,
      delivered_at        INTEGER
    );
    CREATE TABLE IF NOT EXISTS factura_counter (
      year    INTEGER PRIMARY KEY,
      last_n  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_exp_status ON expedientes (status);
    CREATE INDEX IF NOT EXISTS idx_exp_created ON expedientes (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_exp_email ON expedientes (email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exp_contrato_token ON expedientes (contrato_token)
      WHERE contrato_token IS NOT NULL;
  `);
  // Migraciones seguras — columnas añadidas tras despliegue inicial
  for (const sql of [
    `ALTER TABLE expedientes ADD COLUMN ai_elegibilidad TEXT`,
    `ALTER TABLE expedientes ADD COLUMN ai_datos_faltantes TEXT`,
    `ALTER TABLE expedientes ADD COLUMN contrato_token TEXT`,
    `ALTER TABLE expedientes ADD COLUMN contrato_at INTEGER`,
    `ALTER TABLE expedientes ADD COLUMN contrato_ip TEXT`,
    `ALTER TABLE expedientes ADD COLUMN contrato_sent_at INTEGER`,
    `ALTER TABLE expedientes ADD COLUMN importe_concedido TEXT`,
    `ALTER TABLE expedientes ADD COLUMN factura_num TEXT`,
    `ALTER TABLE expedientes ADD COLUMN factura_at INTEGER`,
  ]) {
    try { _db.exec(sql); } catch { /* columna ya existe */ }
  }
  // Tabla de contador de facturas (puede ya existir)
  try {
    _db.exec(`CREATE TABLE IF NOT EXISTS factura_counter (year INTEGER PRIMARY KEY, last_n INTEGER NOT NULL DEFAULT 0)`);
  } catch { /* ya existe */ }
  return _db;
}

// ─── Escritura ────────────────────────────────────────────────────────────────

export function insertExpediente(
  data: Omit<
    Expediente,
    | 'status'
    | 'ai_memoria' | 'ai_presupuesto' | 'ai_checklist' | 'ai_guia'
    | 'ai_notas' | 'ai_elegibilidad' | 'ai_datos_faltantes' | 'ai_at'
    | 'delivered_at'
    | 'contrato_token' | 'contrato_at' | 'contrato_ip' | 'contrato_sent_at'
    | 'importe_concedido' | 'factura_num' | 'factura_at'
  >,
): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO expedientes (
      id, convocatoria_slug, convocatoria_title, convocatoria_url,
      org_nombre, org_cif, org_tipo, representante, email, telefono,
      provincia, descripcion_proyecto, importe_solicitado, experiencia,
      apoderamiento, comentarios, como_conocio, docs_adjuntos, ip,
      status, created_at, updated_at
    ) VALUES (
      @id, @convocatoria_slug, @convocatoria_title, @convocatoria_url,
      @org_nombre, @org_cif, @org_tipo, @representante, @email, @telefono,
      @provincia, @descripcion_proyecto, @importe_solicitado, @experiencia,
      @apoderamiento, @comentarios, @como_conocio, @docs_adjuntos, @ip,
      'recibido', @created_at, @updated_at
    )
  `).run({ ...data, created_at: now, updated_at: now });
}

export function updateStatus(id: string, status: ExpedienteStatus): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const extra = status === 'entregado' ? ', delivered_at = @now' : '';
  db.prepare(`UPDATE expedientes SET status = @status, updated_at = @now${extra} WHERE id = @id`)
    .run({ id, status, now });
}

export function saveAiOutput(
  id: string,
  output: {
    memoria: string;
    presupuesto: string;
    checklist: string;
    guia: string;
    notas?: string;
    elegibilidad?: string;
    datosFaltantes?: string;
  },
): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE expedientes
    SET ai_memoria = @memoria, ai_presupuesto = @presupuesto,
        ai_checklist = @checklist, ai_guia = @guia,
        ai_notas = @notas, ai_elegibilidad = @elegibilidad,
        ai_datos_faltantes = @datosFaltantes,
        ai_at = @now, updated_at = @now,
        status = 'docs_listos'
    WHERE id = @id
  `).run({
    id,
    ...output,
    notas: output.notas ?? null,
    elegibilidad: output.elegibilidad ?? null,
    datosFaltantes: output.datosFaltantes ?? null,
    now,
  });
}

// ─── Lectura ──────────────────────────────────────────────────────────────────

export function getExpediente(id: string): Expediente | null {
  const db = getDb();
  return db.prepare('SELECT * FROM expedientes WHERE id = ?').get(id) as Expediente | null;
}

export function listExpedientes(opts: {
  status?: ExpedienteStatus;
  limit?: number;
  offset?: number;
}): { items: Expediente[]; total: number } {
  const db = getDb();
  const where = opts.status ? 'WHERE status = ?' : '';
  const params = opts.status ? [opts.status] : [];
  const total = (db.prepare(`SELECT COUNT(*) as n FROM expedientes ${where}`).get(...params) as { n: number }).n;
  const items = db.prepare(
    `SELECT * FROM expedientes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).all(...params, opts.limit ?? 50, opts.offset ?? 0) as Expediente[];
  return { items, total };
}

// ─── Contrato ────────────────────────────────────────────────────────────────

export function setContratoToken(id: string, token: string): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`UPDATE expedientes SET contrato_token = @token, contrato_sent_at = @now, updated_at = @now WHERE id = @id`)
    .run({ id, token, now });
}

export function getExpedienteByContratoToken(token: string): Expediente | null {
  const db = getDb();
  return db.prepare('SELECT * FROM expedientes WHERE contrato_token = ?').get(token) as Expediente | null;
}

export function markContratoAceptado(id: string, ip: string): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`UPDATE expedientes SET contrato_at = @now, contrato_ip = @ip, updated_at = @now WHERE id = @id`)
    .run({ id, ip, now });
}

// ─── Factura ──────────────────────────────────────────────────────────────────

/**
 * Genera un número de factura secuencial del año en curso.
 * Formato: FAC-YYYY-NNN (ej: FAC-2026-001)
 * Transacción atómica para evitar duplicados bajo concurrencia.
 */
export function nextFacturaNum(): string {
  const db = getDb();
  const year = new Date().getFullYear();
  const result = db.transaction(() => {
    db.prepare(`INSERT INTO factura_counter (year, last_n) VALUES (?, 1)
      ON CONFLICT(year) DO UPDATE SET last_n = last_n + 1`).run(year);
    const row = db.prepare('SELECT last_n FROM factura_counter WHERE year = ?').get(year) as { last_n: number };
    return row.last_n;
  })();
  return `FAC-${year}-${String(result).padStart(3, '0')}`;
}

export function saveFactura(id: string, facturaNum: string, importeConcedido: string): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE expedientes
    SET factura_num = @facturaNum, factura_at = @now,
        importe_concedido = @importeConcedido, updated_at = @now
    WHERE id = @id
  `).run({ id, facturaNum, importeConcedido, now });
}

export function setImporteConcedido(id: string, importe: string): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`UPDATE expedientes SET importe_concedido = @importe, updated_at = @now WHERE id = @id`)
    .run({ id, importe, now });
}

// ─── Estadísticas ─────────────────────────────────────────────────────────────

export function statsExpedientes(): Record<ExpedienteStatus | 'total', number> {
  const db = getDb();
  const rows = db.prepare(
    `SELECT status, COUNT(*) as n FROM expedientes GROUP BY status`,
  ).all() as { status: string; n: number }[];
  const total = (db.prepare('SELECT COUNT(*) as n FROM expedientes').get() as { n: number }).n;
  const result: Record<string, number> = { total };
  for (const row of rows) result[row.status] = row.n;
  return result as Record<ExpedienteStatus | 'total', number>;
}
