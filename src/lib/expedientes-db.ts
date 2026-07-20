/**
 * expedientes-db.ts
 *
 * SQLite local para gestión de expedientes del Copiloto de subvenciones.
 * Usa better-sqlite3. La BD (expedientes.db) vive en EXPEDIENTES_DIR
 * (default /data/expedientes) junto a los archivos de cada expediente.
 *
 * Status del expediente:
 *   recibido → analizando_ia → docs_listos → entregado → presentado | rechazado
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { CONVOCATORIAS_SEED } from './convocatorias-seed';

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

/**
 * Backup online consistente de la BD a `destPath`, respetando el WAL.
 *
 * Usa la API `.backup()` de better-sqlite3 (no un `readFileSync` del .db):
 * en modo WAL los writes recientes viven en `expedientes.db-wal` hasta que
 * ocurre un checkpoint, así que copiar solo el archivo principal puede dar
 * una copia incompleta o inconsistente. `.backup()` produce un snapshot
 * completo y coherente aunque haya escrituras en curso.
 */
export function backupDb(destPath: string): Promise<void> {
  return getDb().backup(destPath).then(() => undefined);
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
    CREATE INDEX IF NOT EXISTS idx_exp_como_conocio ON expedientes (como_conocio);
    CREATE INDEX IF NOT EXISTS idx_exp_convocatoria_slug ON expedientes (convocatoria_slug);
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
    // Catch acotado: solo "duplicate column" es esperable; cualquier otro error
    // de migración debe verse en logs, no desaparecer en silencio.
    try { _db.exec(sql); } catch (e) {
      if (!/duplicate column/i.test(String(e))) console.error('[expedientes-db] migración falló:', sql, e);
    }
  }
  // Tabla de contador de facturas (puede ya existir)
  try {
    _db.exec(`CREATE TABLE IF NOT EXISTS factura_counter (year INTEGER PRIMARY KEY, last_n INTEGER NOT NULL DEFAULT 0)`);
  } catch { /* ya existe */ }
  // Tablas del portal de clientes
  _db.exec(`
    CREATE TABLE IF NOT EXISTS portal_magic_tokens (
      token      TEXT PRIMARY KEY,
      email      TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portal_sessions (
      token      TEXT PRIMARY KEY,
      email      TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portal_users (
      id           TEXT PRIMARY KEY,
      email        TEXT UNIQUE NOT NULL,
      nombre       TEXT NOT NULL,
      org_nombre   TEXT NOT NULL,
      org_cif      TEXT NOT NULL DEFAULT '',
      org_tipo     TEXT NOT NULL DEFAULT '',
      telefono     TEXT NOT NULL DEFAULT '',
      provincia    TEXT NOT NULL DEFAULT '',
      como_conocio TEXT NOT NULL DEFAULT '',
      consent_at   INTEGER,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_portal_magic_email  ON portal_magic_tokens (email);
    CREATE INDEX IF NOT EXISTS idx_portal_session_email ON portal_sessions (email);
    CREATE INDEX IF NOT EXISTS idx_portal_users_email  ON portal_users (email);
  `);
  // Migración de portal_users — DEBE ir tras su CREATE TABLE (antes corría antes
  // de crear la tabla: en BD nueva fallaba contra tabla inexistente).
  try { _db.exec(`ALTER TABLE portal_users ADD COLUMN consent_at INTEGER`); } catch (e) {
    if (!/duplicate column/i.test(String(e))) console.error('[expedientes-db] migración portal_users falló:', e);
  }
  // Tabla de mensajes expediente (puede ya existir — migración segura)
  _db.exec(`
    CREATE TABLE IF NOT EXISTS expediente_messages (
      id         TEXT PRIMARY KEY,
      exp_id     TEXT NOT NULL,
      direction  TEXT NOT NULL DEFAULT 'admin',
      body       TEXT NOT NULL,
      leido      INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_exp_msg ON expediente_messages (exp_id, created_at);
  `);
  // Tabla CRM — siempre inicializada en la misma apertura de BD
  _db.exec(`
    CREATE TABLE IF NOT EXISTS crm_notes (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL,
      text       TEXT NOT NULL,
      author     TEXT NOT NULL DEFAULT 'admin',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_crm_notes_email ON crm_notes (LOWER(email), created_at DESC);
  `);
  // Tabla ga4_snapshot — snapshot diario agregado de GA4 desde el HUB.
  // Replica el resumen relevante para el funnel/admin sin depender de Postgres
  // remoto. El cron del VPS (seo-sync-daily.sh) hace POST con los totales
  // tras sincronizar con Google. Guardamos UNA fila por día (PK=date).
  _db.exec(`
    CREATE TABLE IF NOT EXISTS ga4_snapshot (
      date                   TEXT PRIMARY KEY,
      sessions_total         INTEGER NOT NULL DEFAULT 0,
      page_views_total       INTEGER NOT NULL DEFAULT 0,
      sessions_subvenciones  INTEGER NOT NULL DEFAULT 0,
      sessions_diagnostico   INTEGER NOT NULL DEFAULT 0,
      sessions_presentar     INTEGER NOT NULL DEFAULT 0,
      sessions_catalogo      INTEGER NOT NULL DEFAULT 0,
      top_path               TEXT,
      top_path_sessions      INTEGER NOT NULL DEFAULT 0,
      synced_at              INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ga4_snap_date ON ga4_snapshot (date DESC);
  `);
  // Tabla scraper_runs — histórico de ejecuciones de scrapers (BDNS, IDAE, BOJA...)
  // Permite mostrar en /admin si los scrapers están vivos, cuántas convocatorias
  // han traído y si han fallado. Sin esta tabla solo se podía inferir por
  // created_at de la tabla convocatorias, lo cual no distingue 0-resultados
  // legítimos de scraper-caído.
  _db.exec(`
    CREATE TABLE IF NOT EXISTS scraper_runs (
      id              TEXT PRIMARY KEY,
      scraper         TEXT NOT NULL,
      started_at      INTEGER NOT NULL,
      finished_at     INTEGER,
      ok              INTEGER NOT NULL DEFAULT 0,
      total_found     INTEGER NOT NULL DEFAULT 0,
      total_new       INTEGER NOT NULL DEFAULT 0,
      total_updated   INTEGER NOT NULL DEFAULT 0,
      duration_ms     INTEGER,
      error           TEXT,
      triggered_by    TEXT NOT NULL DEFAULT 'cron'
    );
    CREATE INDEX IF NOT EXISTS idx_scraper_runs_scraper_started ON scraper_runs (scraper, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scraper_runs_started ON scraper_runs (started_at DESC);
  `);
  // ─── Tabla de convocatorias ──────────────────────────────────────────────────
  _db.exec(`
    CREATE TABLE IF NOT EXISTS convocatorias (
      slug                TEXT PRIMARY KEY,
      codigo              TEXT NOT NULL DEFAULT '',
      titulo              TEXT NOT NULL,
      titulo_full         TEXT NOT NULL DEFAULT '',
      organo              TEXT NOT NULL DEFAULT '',
      tipo_beneficiario   TEXT NOT NULL DEFAULT 'privada',
      beneficiario_label  TEXT NOT NULL DEFAULT '',
      deadline            TEXT NOT NULL DEFAULT '',
      deadline_short      TEXT NOT NULL DEFAULT '',
      deadline_note       TEXT,
      deadline_iso        TEXT,
      importe_min         INTEGER,
      importe_max         INTEGER,
      importe_range       TEXT NOT NULL DEFAULT '',
      importe_detalle     TEXT NOT NULL DEFAULT '',
      tipo_entidades      TEXT NOT NULL DEFAULT '',
      financia_resumen    TEXT NOT NULL DEFAULT '[]',
      gastos_ok           TEXT NOT NULL DEFAULT '[]',
      gastos_no           TEXT NOT NULL DEFAULT '[]',
      requisitos          TEXT NOT NULL DEFAULT '[]',
      nota                TEXT,
      url_boja            TEXT,
      url_bases           TEXT,
      url_sede            TEXT,
      fuente              TEXT NOT NULL DEFAULT 'manual',
      fuente_id           TEXT,
      activa              INTEGER NOT NULL DEFAULT 1,
      destacada           INTEGER NOT NULL DEFAULT 0,
      created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_conv_activa      ON convocatorias (activa, deadline_iso);
    CREATE INDEX IF NOT EXISTS idx_conv_tipo        ON convocatorias (tipo_beneficiario, activa);
    CREATE INDEX IF NOT EXISTS idx_conv_fuente      ON convocatorias (fuente, activa);
  `);
  // Seed inicial — solo si la tabla está vacía
  const nConv = (_db.prepare('SELECT COUNT(*) as n FROM convocatorias').get() as { n: number }).n;
  if (nConv === 0) {
    const insertConv = _db.prepare(`
      INSERT OR IGNORE INTO convocatorias
        (slug, codigo, titulo, titulo_full, organo, tipo_beneficiario, beneficiario_label,
         deadline, deadline_short, deadline_note, deadline_iso,
         importe_min, importe_max, importe_range, importe_detalle,
         tipo_entidades, financia_resumen, gastos_ok, gastos_no, requisitos,
         nota, url_boja, url_bases, url_sede, fuente, fuente_id, activa, destacada)
      VALUES
        (@slug, @codigo, @titulo, @titulo_full, @organo, @tipo_beneficiario, @beneficiario_label,
         @deadline, @deadline_short, @deadline_note, @deadline_iso,
         @importe_min, @importe_max, @importe_range, @importe_detalle,
         @tipo_entidades, @financia_resumen, @gastos_ok, @gastos_no, @requisitos,
         @nota, @url_boja, @url_bases, @url_sede, @fuente, @fuente_id, @activa, @destacada)
    `);
    const seedTx = _db.transaction(() => {
      for (const c of CONVOCATORIAS_SEED) {
        insertConv.run({
          ...c,
          financia_resumen: JSON.stringify(c.financia_resumen),
          gastos_ok:        JSON.stringify(c.gastos_ok),
          gastos_no:        JSON.stringify(c.gastos_no),
          requisitos:       JSON.stringify(c.requisitos),
        });
      }
    });
    seedTx();
  }

  // Tabla de logs de consultas al widget de eligibilidad — sin PII (sin CIF, sin descripción)
  _db.exec(`
    CREATE TABLE IF NOT EXISTS eligibilidad_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      tipo_entidad TEXT NOT NULL DEFAULT '',
      beneficiario TEXT NOT NULL DEFAULT '',  -- privada|local|institucional|persona|empresa|desconocido
      lineas       TEXT NOT NULL DEFAULT '[]', -- JSON array de IDs aplicables
      n_lineas     INTEGER NOT NULL DEFAULT 0,
      aplica       INTEGER NOT NULL DEFAULT 0  -- 1=sí aplica, 0=no
    );
    CREATE INDEX IF NOT EXISTS idx_eleg_log_date ON eligibilidad_log (created_at DESC);
  `);
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
  // Guard anti-regresión: regenerar la IA sobre un expediente ya 'entregado' o
  // 'presentado' NO debe devolverlo a 'docs_listos' en silencio (corrompía el
  // pipeline y las estadísticas). Los documentos se actualizan igual; el status
  // solo avanza a 'docs_listos' desde estados anteriores.
  const current = db.prepare(`SELECT status FROM expedientes WHERE id = ?`).get(id) as
    | { status: string }
    | undefined;
  const keepStatus = current?.status === 'entregado' || current?.status === 'presentado';
  if (keepStatus) {
    console.warn(`[expedientes-db] saveAiOutput sobre expediente ${id} en status '${current?.status}': se actualizan los docs pero NO se regresa el status.`);
  }
  db.prepare(`
    UPDATE expedientes
    SET ai_memoria = @memoria, ai_presupuesto = @presupuesto,
        ai_checklist = @checklist, ai_guia = @guia,
        ai_notas = @notas, ai_elegibilidad = @elegibilidad,
        ai_datos_faltantes = @datosFaltantes,
        ai_at = @now, updated_at = @now,
        status = CASE WHEN status IN ('entregado', 'presentado') THEN status ELSE 'docs_listos' END
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

/**
 * Guarda el borrador de memoria técnica que el cliente generó en el wizard
 * antes de enviar el formulario. Solo actualiza si el campo está vacío
 * (no sobreescribe la memoria completa generada por Startidea).
 */
export function saveWizardMemoria(id: string, text: string): void {
  if (!text?.trim()) return;
  const db  = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `UPDATE expedientes
     SET ai_memoria = @text, updated_at = @now
     WHERE id = @id AND (ai_memoria IS NULL OR ai_memoria = '')`,
  ).run({ id, text: text.slice(0, 30000), now });
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

/**
 * Conversión Copiloto Autónomo → cliente de pago.
 *
 * Mide cuántos perfiles del Copiloto Autónomo han generado un expediente real
 * desde el wizard (es decir, han pedido el servicio gestionado con comisión 12%).
 *
 * "Expedientes auto-generados" = creados por el cron del Copiloto (no convertidos).
 * "Expedientes manuales del Copiloto" = wizards con como_conocio='copiloto-autonomo'
 *   (un perfil del Copiloto vio el email y decidió pasarlo a servicio gestionado).
 * "Con contrato firmado" = de esos manuales, cuántos llegaron a contrato.
 */
export function statsCopilotoConversion(): {
  perfilesActivos: number | null;        // se rellena externamente desde auto-copiloto-db
  expedientesAutogenerados: number;      // creados por el cron (no clientes de pago)
  expedientesConversion: number;         // gente que vino del Copiloto al wizard
  conversionContratoFirmado: number;     // de esos, cuántos firmaron contrato
  conversionPresentados: number;         // de esos, cuántos están presentados
  facturadoConversion: number;           // facturas emitidas a expedientes "conversion"
} {
  const db = getDb();
  const autogen = (db.prepare(
    `SELECT COUNT(*) as n FROM expedientes WHERE como_conocio = 'copiloto-autonomo'`,
  ).get() as { n: number }).n;

  // Wizard manual con tracking del Copiloto. El cron usa "copiloto-autonomo" tal cual,
  // pero el wizard con UTM lo prefija con "copiloto-autonomo-cta" o el select trae el valor.
  // Para distinguir, los autogenerados tienen ip='auto-copiloto' o 'auto-copiloto-catalog'.
  const conversion = (db.prepare(
    `SELECT COUNT(*) as n FROM expedientes
     WHERE como_conocio = 'copiloto-autonomo'
       AND ip NOT LIKE 'auto-copiloto%'`,
  ).get() as { n: number }).n;

  const conContrato = (db.prepare(
    `SELECT COUNT(*) as n FROM expedientes
     WHERE como_conocio = 'copiloto-autonomo'
       AND ip NOT LIKE 'auto-copiloto%'
       AND contrato_at IS NOT NULL`,
  ).get() as { n: number }).n;

  const presentados = (db.prepare(
    `SELECT COUNT(*) as n FROM expedientes
     WHERE como_conocio = 'copiloto-autonomo'
       AND ip NOT LIKE 'auto-copiloto%'
       AND status = 'presentado'`,
  ).get() as { n: number }).n;

  const facturado = (db.prepare(
    `SELECT COALESCE(SUM(CAST(importe_concedido AS REAL)), 0) as t FROM expedientes
     WHERE como_conocio = 'copiloto-autonomo'
       AND ip NOT LIKE 'auto-copiloto%'
       AND factura_at IS NOT NULL`,
  ).get() as { t: number }).t;

  return {
    perfilesActivos: null,
    expedientesAutogenerados: autogen - conversion,
    expedientesConversion: conversion,
    conversionContratoFirmado: conContrato,
    conversionPresentados: presentados,
    facturadoConversion: Math.round(facturado * 0.12), // 12% comisión
  };
}

/** Estadísticas de contratos para el panel admin */
export function statsContratos(): {
  sinEnviar: number;
  enviados: number;
  aceptados: number;
} {
  const db = getDb();
  const sinEnviar = (db.prepare(
    `SELECT COUNT(*) as n FROM expedientes WHERE contrato_token IS NULL AND status NOT IN ('rechazado')`,
  ).get() as { n: number }).n;
  const enviados = (db.prepare(
    `SELECT COUNT(*) as n FROM expedientes WHERE contrato_token IS NOT NULL AND contrato_at IS NULL`,
  ).get() as { n: number }).n;
  const aceptados = (db.prepare(
    `SELECT COUNT(*) as n FROM expedientes WHERE contrato_at IS NOT NULL`,
  ).get() as { n: number }).n;
  return { sinEnviar, enviados, aceptados };
}

/** Pipeline económico: importes concedidos y facturación */
export function statsEconomico(): {
  facturadoTotal: number;   // sum importe_concedido * 0.12 donde factura generada
  pipelineTotal: number;    // sum importe_concedido * 0.12 donde no hay factura aún
  pendienteFacturar: number; // count con importe pero sin factura
} {
  const db = getDb();
  const facturadas = db.prepare(
    `SELECT importe_concedido FROM expedientes WHERE factura_num IS NOT NULL AND importe_concedido IS NOT NULL`,
  ).all() as { importe_concedido: string }[];
  const sinFacturar = db.prepare(
    `SELECT importe_concedido FROM expedientes WHERE importe_concedido IS NOT NULL AND factura_num IS NULL`,
  ).all() as { importe_concedido: string }[];

  const parse = (s: string) => {
    const n = parseFloat(s.replace(/[.,\s€]/g, (c) => (c === ',' ? '.' : '')));
    return isNaN(n) ? 0 : n;
  };

  const facturadoTotal = facturadas.reduce((sum, r) => sum + parse(r.importe_concedido) * 0.12, 0);
  const pipelineTotal  = sinFacturar.reduce((sum, r) => sum + parse(r.importe_concedido) * 0.12, 0);
  return { facturadoTotal, pipelineTotal, pendienteFacturar: sinFacturar.length };
}

/** Expedientes recibidos sin procesar (recibido hace más de 24h sin IA) */
export function getExpedientesRecibidosSinProcesar(): Expediente[] {
  const db = getDb();
  const umbral = Math.floor(Date.now() / 1000) - 24 * 3600;
  return db.prepare(
    `SELECT * FROM expedientes WHERE status = 'recibido' AND created_at < ? ORDER BY created_at ASC`,
  ).all(umbral) as Expediente[];
}

/** Expedientes más recientes (para listado rápido en admin home) */
export function getExpedientesRecientes(limit = 5): Expediente[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM expedientes ORDER BY created_at DESC LIMIT ?`,
  ).all(limit) as Expediente[];
}

/** Expedientes de un email concreto (portal de clientes) */
export function getExpedientesByEmail(email: string): Expediente[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM expedientes WHERE LOWER(email) = LOWER(?) ORDER BY created_at DESC`,
  ).all(email) as Expediente[];
}

// ─── Portal de clientes — Usuarios registrados ───────────────────────────────

export interface PortalUser {
  id:           string;
  email:        string;
  nombre:       string;
  org_nombre:   string;
  org_cif:      string;
  org_tipo:     string;
  telefono:     string;
  provincia:    string;
  como_conocio: string;
  consent_at:   number | null;
  created_at:   number;
  updated_at:   number;
}

export function getPortalUser(email: string): PortalUser | null {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM portal_users WHERE LOWER(email) = LOWER(?)`,
  ).get(email) as PortalUser | null;
}

export function createPortalUser(
  data: Omit<PortalUser, 'id' | 'created_at' | 'updated_at'>,
): void {
  const db  = getDb();
  const now = Math.floor(Date.now() / 1000);
  // ID corto: USR-YYYY-XXXXXX (6 hex chars)
  const hex = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
  const id  = `USR-${new Date().getFullYear()}-${hex}`;
  db.prepare(`
    INSERT OR REPLACE INTO portal_users
      (id, email, nombre, org_nombre, org_cif, org_tipo, telefono, provincia, como_conocio, consent_at, created_at, updated_at)
    VALUES
      (@id, LOWER(@email), @nombre, @org_nombre, @org_cif, @org_tipo, @telefono, @provincia, @como_conocio, @consent_at, @created_at, @updated_at)
  `).run({ ...data, email: data.email.toLowerCase(), id, created_at: now, updated_at: now });
}

export function updatePortalUser(
  email: string,
  data: Partial<Pick<PortalUser, 'nombre' | 'org_nombre' | 'org_cif' | 'org_tipo' | 'telefono' | 'provincia'>>,
): void {
  const db  = getDb();
  const now = Math.floor(Date.now() / 1000);
  const sets = Object.keys(data).map((k) => `${k} = @${k}`).join(', ');
  if (!sets) return;
  db.prepare(`UPDATE portal_users SET ${sets}, updated_at = @updated_at WHERE LOWER(email) = LOWER(@email)`)
    .run({ ...data, email, updated_at: now });
}

export function listPortalUsers(limit = 100): PortalUser[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM portal_users ORDER BY created_at DESC LIMIT ?`,
  ).all(limit) as PortalUser[];
}

export function statsPortalUsers(): number {
  const db = getDb();
  return (db.prepare(`SELECT COUNT(*) as n FROM portal_users`).get() as { n: number }).n;
}

/** Indica si el email tiene acceso al portal (usuario registrado O con expediente) */
export function emailHasPortalAccess(email: string): { registered: boolean; hasExpedientes: boolean } {
  const user = getPortalUser(email);
  const exps = getExpedientesByEmail(email);
  return { registered: !!user, hasExpedientes: exps.length > 0 };
}

// ─── Mensajes de expediente ───────────────────────────────────────────────────

export interface ExpedienteMessage {
  id:         string;
  exp_id:     string;
  direction:  'admin' | 'client';
  body:       string;
  leido:      number; // 0 | 1
  created_at: number;
}

export function addExpedienteMessage(
  expId: string,
  direction: 'admin' | 'client',
  body: string,
): ExpedienteMessage {
  const db  = getDb();
  const now = Math.floor(Date.now() / 1000);
  const hex = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const id  = `MSG-${hex.toUpperCase()}`;
  db.prepare(`
    INSERT INTO expediente_messages (id, exp_id, direction, body, leido, created_at)
    VALUES (@id, @exp_id, @direction, @body, 0, @created_at)
  `).run({ id, exp_id: expId, direction, body, created_at: now });
  return { id, exp_id: expId, direction, body, leido: 0, created_at: now };
}

export function getExpedienteMessages(expId: string): ExpedienteMessage[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM expediente_messages WHERE exp_id = ? ORDER BY created_at ASC`,
  ).all(expId) as ExpedienteMessage[];
}

export function markMessagesRead(expId: string, direction: 'admin' | 'client'): void {
  const db = getDb();
  // Marca como leídos los mensajes enviados en esa dirección (el receptor los ha leído)
  const readerSide = direction === 'admin' ? 'client' : 'admin';
  db.prepare(
    `UPDATE expediente_messages SET leido = 1 WHERE exp_id = ? AND direction = ? AND leido = 0`,
  ).run(expId, readerSide);
}

export function countUnreadMessages(expId: string, readerDirection: 'admin' | 'client'): number {
  const db = getDb();
  // El admin lee mensajes del cliente y viceversa
  const senderSide = readerDirection === 'admin' ? 'client' : 'admin';
  const row = db.prepare(
    `SELECT COUNT(*) as n FROM expediente_messages WHERE exp_id = ? AND direction = ? AND leido = 0`,
  ).get(expId, senderSide) as { n: number };
  return row.n;
}

// ─── Portal de clientes — Auth magic-link ────────────────────────────────────

import { randomBytes } from 'node:crypto';

export function createMagicToken(email: string): string {
  const db = getDb();
  const token = randomBytes(24).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  // Limpiar tokens anteriores del mismo email
  db.prepare(`DELETE FROM portal_magic_tokens WHERE email = LOWER(?)`).run(email);
  db.prepare(
    `INSERT INTO portal_magic_tokens (token, email, expires_at, created_at) VALUES (?, LOWER(?), ?, ?)`,
  ).run(token, email, now + 3600, now); // 1h de validez
  return token;
}

export function validateMagicToken(token: string): string | null {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare(
    `SELECT email FROM portal_magic_tokens WHERE token = ? AND expires_at > ?`,
  ).get(token, now) as { email: string } | undefined;
  if (!row) return null;
  db.prepare(`DELETE FROM portal_magic_tokens WHERE token = ?`).run(token);
  return row.email;
}

export function createPortalSession(email: string): string {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO portal_sessions (token, email, expires_at, created_at) VALUES (?, LOWER(?), ?, ?)`,
  ).run(token, email, now + 7 * 24 * 3600, now); // 7 días
  return token;
}

export function getPortalSessionEmail(token: string): string | null {
  if (!token) return null;
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare(
    `SELECT email FROM portal_sessions WHERE token = ? AND expires_at > ?`,
  ).get(token, now) as { email: string } | undefined;
  return row?.email ?? null;
}

/**
 * Limpia tokens expirados de magic links + sesiones de portal.
 *
 * Los magic tokens (1h de validez) y las sesiones expiradas (>7d) deberían
 * eliminarse para mantener la BD ágil. validateMagicToken() elimina el token
 * tras consumirlo, pero si nunca se consume (usuario abandonó) queda eterno.
 *
 * Devuelve cuántos registros se eliminaron de cada tabla.
 */
export function cleanupExpiredPortalTokens(): {
  magic_tokens: number;
  sessions: number;
} {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const m = db.prepare(`DELETE FROM portal_magic_tokens WHERE expires_at < ?`).run(now);
  const s = db.prepare(`DELETE FROM portal_sessions WHERE expires_at < ?`).run(now);
  return {
    magic_tokens: m.changes ?? 0,
    sessions:     s.changes ?? 0,
  };
}

export function deletePortalSession(token: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM portal_sessions WHERE token = ?`).run(token);
}

// ─── CRM ─────────────────────────────────────────────────────────────────────
// La tabla `crm_notes` se crea en getDb() junto al resto del schema,
// así que todas las funciones CRM pueden usar getDb() directamente.

export interface CrmNote {
  id: string;
  email: string;
  text: string;
  author: string;
  created_at: number;
}

/** Vista unificada de contacto para el CRM */
export interface CRMContact {
  email: string;
  nombre: string;
  org_nombre: string;
  org_cif: string;
  org_tipo: string;
  telefono: string;
  provincia: string;
  has_portal: number;       // 0/1
  expedientes_count: number;
  expedientes_concedidos: number;
  has_autocopiloto: number; // 0/1
  acp_active: number;       // 0/1
  acp_confirmed: number;    // 0/1
  last_exp_status: string | null;
  last_exp_title: string | null;
  last_activity_at: number;
  first_seen_at: number;
  notes_count: number;
}

const CRM_BASE_SQL = `
WITH
  last_exp AS (
    SELECT *
    FROM (
      SELECT
        LOWER(email) AS email_lower, status, convocatoria_title,
        org_nombre, org_cif, org_tipo, representante, telefono, provincia,
        ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at DESC) AS rn
      FROM expedientes
    ) WHERE rn = 1
  ),
  exp_agg AS (
    SELECT
      LOWER(email) AS email,
      COUNT(*) AS exp_count,
      SUM(CASE WHEN importe_concedido IS NOT NULL THEN 1 ELSE 0 END) AS exp_concedidos,
      MAX(updated_at) AS last_exp_at,
      MIN(created_at) AS first_exp_at
    FROM expedientes
    GROUP BY LOWER(email)
  ),
  first_acp AS (
    SELECT *
    FROM (
      SELECT
        LOWER(email) AS email_lower, id, org_nombre, org_cif, org_tipo,
        representante, telefono, active, confirmed, created_at,
        ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at ASC) AS rn
      FROM auto_copiloto_profiles
    ) WHERE rn = 1
  ),
  notes_agg AS (
    SELECT LOWER(email) AS email, COUNT(*) AS notes_count
    FROM crm_notes
    GROUP BY LOWER(email)
  ),
  all_emails AS (
    SELECT LOWER(email) AS email FROM portal_users
    UNION SELECT LOWER(email) AS email FROM expedientes
    UNION SELECT LOWER(email) AS email FROM auto_copiloto_profiles
  ),
  base AS (
    SELECT
      ae.email,
      COALESCE(pu.nombre, le.representante, fa.representante, '') AS nombre,
      COALESCE(pu.org_nombre, le.org_nombre, fa.org_nombre, '') AS org_nombre,
      COALESCE(pu.org_cif, le.org_cif, fa.org_cif, '') AS org_cif,
      COALESCE(pu.org_tipo, le.org_tipo, fa.org_tipo, '') AS org_tipo,
      COALESCE(pu.telefono, le.telefono, fa.telefono, '') AS telefono,
      COALESCE(pu.provincia, le.provincia, '') AS provincia,
      CASE WHEN pu.id IS NOT NULL THEN 1 ELSE 0 END AS has_portal,
      COALESCE(ea.exp_count, 0) AS expedientes_count,
      COALESCE(ea.exp_concedidos, 0) AS expedientes_concedidos,
      CASE WHEN fa.id IS NOT NULL THEN 1 ELSE 0 END AS has_autocopiloto,
      COALESCE(fa.active, 0) AS acp_active,
      COALESCE(fa.confirmed, 0) AS acp_confirmed,
      le.status AS last_exp_status,
      le.convocatoria_title AS last_exp_title,
      MAX(
        COALESCE(pu.updated_at, 0),
        COALESCE(ea.last_exp_at, 0),
        COALESCE(fa.created_at, 0)
      ) AS last_activity_at,
      MIN(
        COALESCE(pu.created_at, 9999999999),
        COALESCE(ea.first_exp_at, 9999999999),
        COALESCE(fa.created_at, 9999999999)
      ) AS first_seen_at,
      COALESCE(na.notes_count, 0) AS notes_count
    FROM all_emails ae
    LEFT JOIN portal_users pu ON LOWER(pu.email) = ae.email
    LEFT JOIN last_exp le ON le.email_lower = ae.email
    LEFT JOIN exp_agg ea ON ea.email = ae.email
    LEFT JOIN first_acp fa ON fa.email_lower = ae.email
    LEFT JOIN notes_agg na ON na.email = ae.email
  )
`;

export function listCRMContacts(opts?: {
  limit?: number;
  offset?: number;
  q?: string;
}): { items: CRMContact[]; total: number } {
  const db = getDb();
  const limit  = opts?.limit  ?? 50;
  const offset = opts?.offset ?? 0;
  const q      = opts?.q?.trim().toLowerCase() ?? '';

  const searchWhere = q
    ? `WHERE base.email LIKE @q OR LOWER(base.nombre) LIKE @q OR LOWER(base.org_nombre) LIKE @q`
    : '';
  const params: Record<string, unknown> = { limit, offset };
  if (q) params.q = `%${q}%`;

  const total = (db.prepare(
    `${CRM_BASE_SQL} SELECT COUNT(*) AS n FROM base ${searchWhere}`,
  ).get(params) as { n: number }).n;

  const items = db.prepare(
    `${CRM_BASE_SQL} SELECT * FROM base ${searchWhere} ORDER BY last_activity_at DESC LIMIT @limit OFFSET @offset`,
  ).all(params) as CRMContact[];

  return { items, total };
}

export function getCRMContactFull(email: string): CRMContact | null {
  const db = getDb();
  return (db.prepare(
    `${CRM_BASE_SQL} SELECT * FROM base WHERE base.email = LOWER(@email)`,
  ).get({ email }) as CRMContact | null);
}

export function getCrmNotes(email: string): CrmNote[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM crm_notes WHERE LOWER(email) = LOWER(?) ORDER BY created_at DESC`,
  ).all(email) as CrmNote[];
}

export function addCrmNote(email: string, text: string, author = 'admin'): CrmNote {
  const db  = getDb();
  const now = Math.floor(Date.now() / 1000);
  const id  = `NOTE-${randomBytes(10).toString('hex').toUpperCase()}`;
  db.prepare(
    `INSERT INTO crm_notes (id, email, text, author, created_at) VALUES (@id, LOWER(@email), @text, @author, @created_at)`,
  ).run({ id, email, text: text.trim(), author, created_at: now });
  return { id, email: email.toLowerCase(), text: text.trim(), author, created_at: now };
}

export function deleteCrmNote(id: string): boolean {
  const db = getDb();
  const info = db.prepare(`DELETE FROM crm_notes WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function statsCRMContacts(): number {
  const db = getDb();
  const sql = `
    SELECT COUNT(*) AS n FROM (
      SELECT LOWER(email) AS email FROM portal_users
      UNION SELECT LOWER(email) AS email FROM expedientes
      UNION SELECT LOWER(email) AS email FROM auto_copiloto_profiles
    )
  `;
  return (db.prepare(sql).get() as { n: number }).n;
}

// ─── Convocatorias ────────────────────────────────────────────────────────────

export interface Convocatoria {
  slug: string;
  codigo: string;
  titulo: string;
  titulo_full: string;
  organo: string;
  tipo_beneficiario: string;
  beneficiario_label: string;
  deadline: string;
  deadline_short: string;
  deadline_note: string | null;
  deadline_iso: string | null;
  importe_min: number | null;
  importe_max: number | null;
  importe_range: string;
  importe_detalle: string;
  tipo_entidades: string;
  financia_resumen: string;  // JSON serializado
  gastos_ok: string;         // JSON serializado
  gastos_no: string;         // JSON serializado
  requisitos: string;        // JSON serializado
  nota: string | null;
  url_boja: string | null;
  url_bases: string | null;
  url_sede: string | null;
  fuente: string;
  fuente_id: string | null;
  activa: number;
  destacada: number;
  created_at: number;
  updated_at: number;
}

/** Versión deserializada para consumo en templates y API. */
export interface ConvocatoriaView {
  slug: string;
  codigo: string;          // ← equivale a 'id' en ConvData anterior
  titulo: string;
  tituloFull: string;
  organo: string;
  beneficiario: string;    // tipo_beneficiario
  beneficiarioLabel: string;
  deadline: string;
  deadlineShort: string;
  deadlineNote: string | null;
  deadlineIso: string | null;
  importeMin: number | null;
  importeMax: number | null;
  importeRange: string;
  importe: string;         // importe_detalle
  tipoEntidades: string;
  financiaResumen: string[];
  gastosOk: string[];
  gastosNo: string[];
  requisitos: string[];
  nota: string | null;
  bojaUrl: string | null;
  basesUrl: string | null;
  sedeUrl: string | null;
  fuente: string;
  activa: boolean;
  destacada: boolean;
}

function parseConv(row: Convocatoria): ConvocatoriaView {
  const parse = (s: string): string[] => {
    try { return JSON.parse(s) as string[]; }
    catch { return s ? [s] : []; }
  };
  return {
    slug:             row.slug,
    codigo:           row.codigo,
    titulo:           row.titulo,
    tituloFull:       row.titulo_full,
    organo:           row.organo,
    beneficiario:     row.tipo_beneficiario,
    beneficiarioLabel: row.beneficiario_label,
    deadline:         row.deadline,
    deadlineShort:    row.deadline_short,
    deadlineNote:     row.deadline_note,
    deadlineIso:      row.deadline_iso,
    importeMin:       row.importe_min,
    importeMax:       row.importe_max,
    importeRange:     row.importe_range,
    importe:          row.importe_detalle,
    tipoEntidades:    row.tipo_entidades,
    financiaResumen:  parse(row.financia_resumen),
    gastosOk:         parse(row.gastos_ok),
    gastosNo:         parse(row.gastos_no),
    requisitos:       parse(row.requisitos),
    nota:             row.nota,
    bojaUrl:          row.url_boja,
    basesUrl:         row.url_bases,
    sedeUrl:          row.url_sede,
    fuente:           row.fuente,
    activa:           row.activa === 1,
    destacada:        row.destacada === 1,
  };
}

/** Convocatorias activas para el formulario y la API pública. */
export function listConvocatoriasActivas(tipo?: string): ConvocatoriaView[] {
  const db = getDb();
  const where = tipo ? 'WHERE activa = 1 AND tipo_beneficiario = ?' : 'WHERE activa = 1';
  const params = tipo ? [tipo] : [];
  const rows = db.prepare(
    `SELECT * FROM convocatorias ${where} ORDER BY destacada DESC, deadline_iso ASC, codigo ASC`,
  ).all(...params) as Convocatoria[];
  return rows.map(parseConv);
}

/** Todas las convocatorias (admin). */
export function listConvocatoriasAll(): (ConvocatoriaView & { created_at: number; updated_at: number })[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM convocatorias ORDER BY activa DESC, deadline_iso ASC, codigo ASC`,
  ).all() as Convocatoria[];
  return rows.map((r) => ({ ...parseConv(r), created_at: r.created_at, updated_at: r.updated_at }));
}

export function getConvocatoria(slug: string): ConvocatoriaView | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM convocatorias WHERE slug = ?').get(slug) as Convocatoria | null;
  return row ? parseConv(row) : null;
}

export function upsertConvocatoria(data: {
  slug: string;
  codigo: string;
  titulo: string;
  titulo_full: string;
  organo: string;
  tipo_beneficiario: string;
  beneficiario_label: string;
  deadline: string;
  deadline_short: string;
  deadline_note: string | null;
  deadline_iso: string | null;
  importe_min: number | null;
  importe_max: number | null;
  importe_range: string;
  importe_detalle: string;
  tipo_entidades: string;
  financia_resumen: string[];
  gastos_ok: string[];
  gastos_no: string[];
  requisitos: string[];
  nota: string | null;
  url_boja: string | null;
  url_bases: string | null;
  url_sede: string | null;
  fuente: string;
  fuente_id: string | null;
  activa: number;
  destacada: number;
}): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO convocatorias
      (slug, codigo, titulo, titulo_full, organo, tipo_beneficiario, beneficiario_label,
       deadline, deadline_short, deadline_note, deadline_iso,
       importe_min, importe_max, importe_range, importe_detalle,
       tipo_entidades, financia_resumen, gastos_ok, gastos_no, requisitos,
       nota, url_boja, url_bases, url_sede, fuente, fuente_id, activa, destacada,
       created_at, updated_at)
    VALUES
      (@slug, @codigo, @titulo, @titulo_full, @organo, @tipo_beneficiario, @beneficiario_label,
       @deadline, @deadline_short, @deadline_note, @deadline_iso,
       @importe_min, @importe_max, @importe_range, @importe_detalle,
       @tipo_entidades, @financia_resumen, @gastos_ok, @gastos_no, @requisitos,
       @nota, @url_boja, @url_bases, @url_sede, @fuente, @fuente_id, @activa, @destacada,
       @now, @now)
    ON CONFLICT(slug) DO UPDATE SET
      codigo = excluded.codigo, titulo = excluded.titulo, titulo_full = excluded.titulo_full,
      organo = excluded.organo, tipo_beneficiario = excluded.tipo_beneficiario,
      beneficiario_label = excluded.beneficiario_label,
      deadline = excluded.deadline, deadline_short = excluded.deadline_short,
      deadline_note = excluded.deadline_note, deadline_iso = excluded.deadline_iso,
      importe_min = excluded.importe_min, importe_max = excluded.importe_max,
      importe_range = excluded.importe_range, importe_detalle = excluded.importe_detalle,
      tipo_entidades = excluded.tipo_entidades,
      financia_resumen = excluded.financia_resumen,
      gastos_ok = excluded.gastos_ok, gastos_no = excluded.gastos_no,
      requisitos = excluded.requisitos, nota = excluded.nota,
      url_boja = excluded.url_boja, url_bases = excluded.url_bases, url_sede = excluded.url_sede,
      fuente = excluded.fuente, fuente_id = excluded.fuente_id,
      activa = excluded.activa, destacada = excluded.destacada,
      updated_at = @now
  `).run({
    ...data,
    financia_resumen: JSON.stringify(data.financia_resumen),
    gastos_ok:        JSON.stringify(data.gastos_ok),
    gastos_no:        JSON.stringify(data.gastos_no),
    requisitos:       JSON.stringify(data.requisitos),
    now,
  });
}

export function toggleConvocatoriaActiva(slug: string): boolean {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare('SELECT activa FROM convocatorias WHERE slug = ?').get(slug) as { activa: number } | null;
  if (!row) return false;
  const next = row.activa === 1 ? 0 : 1;
  db.prepare('UPDATE convocatorias SET activa = ?, updated_at = ? WHERE slug = ?').run(next, now, slug);
  return next === 1;
}

// ─── Widget eligibilidad — logging anónimo ────────────────────────────────────

/**
 * Registra una consulta al widget de elegibilidad BOJA.
 * No almacena CIF, descripción ni IP. Solo el tipo de entidad detectado
 * y las líneas que aplican.
 */
export function logEligibilidad(data: {
  tipo_entidad: string;
  beneficiario: string;
  lineas: string[];  // array de IDs como ['L10','L11']
  aplica: boolean;
}): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO eligibilidad_log (tipo_entidad, beneficiario, lineas, n_lineas, aplica)
      VALUES (@tipo_entidad, @beneficiario, @lineas, @n_lineas, @aplica)
    `).run({
      tipo_entidad: data.tipo_entidad.slice(0, 120),
      beneficiario: data.beneficiario,
      lineas: JSON.stringify(data.lineas),
      n_lineas: data.lineas.length,
      aplica: data.aplica ? 1 : 0,
    });
  } catch { /* non-blocking — nunca romper la respuesta al usuario */ }
}

export interface EligibilidadStats {
  total: number;
  aplica: number;
  noAplica: number;
  porBeneficiario: { beneficiario: string; n: number }[];
  porLinea: { linea: string; n: number }[];
  porDia: { dia: string; n: number }[];   // últimos 30 días
}

export function statsEligibilidad(): EligibilidadStats {
  const db = getDb();
  const total  = (db.prepare(`SELECT COUNT(*) AS n FROM eligibilidad_log`).get() as { n: number }).n;
  const aplica = (db.prepare(`SELECT COUNT(*) AS n FROM eligibilidad_log WHERE aplica = 1`).get() as { n: number }).n;

  const porBeneficiario = db.prepare(`
    SELECT beneficiario, COUNT(*) AS n
    FROM eligibilidad_log
    GROUP BY beneficiario
    ORDER BY n DESC
  `).all() as { beneficiario: string; n: number }[];

  // Explode JSON array de líneas para contar por línea
  // SQLite no tiene json_each en todas las versiones, hacemos conteo manual
  const allRows = db.prepare(
    `SELECT lineas FROM eligibilidad_log WHERE aplica = 1 AND lineas != '[]'`,
  ).all() as { lineas: string }[];
  const lineaCount: Record<string, number> = {};
  for (const row of allRows) {
    try {
      const ids = JSON.parse(row.lineas) as string[];
      for (const id of ids) lineaCount[id] = (lineaCount[id] ?? 0) + 1;
    } catch { /* skip */ }
  }
  const porLinea = Object.entries(lineaCount)
    .map(([linea, n]) => ({ linea, n }))
    .sort((a, b) => b.n - a.n);

  const porDia = db.prepare(`
    SELECT date(created_at, 'unixepoch') AS dia, COUNT(*) AS n
    FROM eligibilidad_log
    WHERE created_at >= unixepoch('now', '-30 days')
    GROUP BY dia
    ORDER BY dia ASC
  `).all() as { dia: string; n: number }[];

  return { total, aplica, noAplica: total - aplica, porBeneficiario, porLinea, porDia };
}

// ─── Estadísticas de convocatorias ───────────────────────────────────────────

export interface ConvStats {
  convocatoria_slug: string;
  convocatoria_title: string;
  n_expedientes: number;
  n_presentados: number;
  n_entregados: number;
  n_recibidos: number;
  n_rechazados: number;
  first_at: number;
  last_at: number;
}

/** Expedientes agrupados por convocatoria */
export function statsExpedientesByConv(): ConvStats[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(convocatoria_slug, '') AS convocatoria_slug,
      COALESCE(convocatoria_title, convocatoria_slug, '(sin convocatoria)') AS convocatoria_title,
      COUNT(*) AS n_expedientes,
      SUM(CASE WHEN status = 'presentado'  THEN 1 ELSE 0 END) AS n_presentados,
      SUM(CASE WHEN status = 'entregado'   THEN 1 ELSE 0 END) AS n_entregados,
      SUM(CASE WHEN status = 'recibido' OR status = 'analizando_ia' OR status = 'docs_listos' THEN 1 ELSE 0 END) AS n_recibidos,
      SUM(CASE WHEN status = 'rechazado'   THEN 1 ELSE 0 END) AS n_rechazados,
      MIN(created_at) AS first_at,
      MAX(created_at) AS last_at
    FROM expedientes
    GROUP BY convocatoria_slug
    ORDER BY n_expedientes DESC
  `).all() as ConvStats[];
}

export interface CopilotoConvStats {
  convocatoria_slug: string;
  convocatoria_title: string;
  n_profiles: number;
  n_sent: number;
  n_error: number;
}

/** Generaciones del copiloto autónomo agrupadas por convocatoria */
export function statsCopilotoByConv(): CopilotoConvStats[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      convocatoria_slug,
      COALESCE(convocatoria_title, convocatoria_slug) AS convocatoria_title,
      COUNT(*) AS n_profiles,
      SUM(sent) AS n_sent,
      SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS n_error
    FROM auto_copiloto_log
    GROUP BY convocatoria_slug
    ORDER BY n_profiles DESC
  `).all() as CopilotoConvStats[];
}

/**
 * Métricas del catálogo de convocatorias para el panel /admin (Sistema Operativo).
 *
 * Devuelve un snapshot del estado del catálogo:
 * - activas        — convocatorias visibles en /subvenciones/catalogo
 * - urgentes       — activas con deadline_iso en los próximos 14 días
 * - expiradas      — con deadline pasado (deberían desactivarse)
 * - nuevasUltimos7d — añadidas (created_at) en los últimos 7 días — útil para
 *                    saber si los scrapers están trayendo cosas o están parados
 * - porFuente      — desglose por origen: manual / boja / bdns / idae / ...
 */
export function statsCatalogo(): {
  total:           number;
  activas:         number;
  urgentes:        number;
  expiradas:       number;
  nuevasUltimos7d: number;
  porFuente:       Record<string, number>;
  ultimaIngesta:   number | null;
} {
  const db = getDb();
  const todayIso = new Date().toISOString().slice(0, 10);
  const in14Iso = new Date(Date.now() + 14 * 86400 * 1000).toISOString().slice(0, 10);
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;

  const totals = db.prepare(`
    SELECT
      COUNT(*)                                                     AS total,
      SUM(CASE WHEN activa = 1 THEN 1 ELSE 0 END)                  AS activas,
      SUM(CASE WHEN activa = 1
                AND deadline_iso IS NOT NULL
                AND deadline_iso >= ?
                AND deadline_iso <= ?  THEN 1 ELSE 0 END)          AS urgentes,
      SUM(CASE WHEN deadline_iso IS NOT NULL
                AND deadline_iso < ?    THEN 1 ELSE 0 END)         AS expiradas,
      SUM(CASE WHEN created_at >= ?     THEN 1 ELSE 0 END)         AS nuevasUltimos7d,
      MAX(created_at)                                              AS ultimaIngesta
    FROM convocatorias
  `).get(todayIso, in14Iso, todayIso, sevenDaysAgo) as {
    total: number; activas: number; urgentes: number; expiradas: number;
    nuevasUltimos7d: number; ultimaIngesta: number | null;
  };

  const porFuenteRows = db.prepare(`
    SELECT fuente, COUNT(*) AS n
    FROM convocatorias
    GROUP BY fuente
  `).all() as { fuente: string; n: number }[];

  const porFuente: Record<string, number> = {};
  for (const r of porFuenteRows) porFuente[r.fuente || 'sin_fuente'] = r.n;

  return {
    total:           totals.total ?? 0,
    activas:         totals.activas ?? 0,
    urgentes:        totals.urgentes ?? 0,
    expiradas:       totals.expiradas ?? 0,
    nuevasUltimos7d: totals.nuevasUltimos7d ?? 0,
    porFuente,
    ultimaIngesta:   totals.ultimaIngesta,
  };
}

// ─── Histórico de scrapers ──────────────────────────────────────────────────

export type ScraperRun = {
  id:             string;
  scraper:        string;
  started_at:     number;
  finished_at:    number | null;
  ok:             number;          // 0 | 1
  total_found:    number;
  total_new:      number;
  total_updated:  number;
  duration_ms:    number | null;
  error:          string | null;
  triggered_by:   string;
};

/**
 * Inserta una ejecución completa de scraper (cron, panel admin, o test).
 *
 * Se llama AL FINAL del scraper, con todos los counts ya conocidos. Si el
 * scraper crashea antes de terminar, no se inserta nada — el panel mostrará
 * "última ejecución" como vieja, que ya es señal útil de algo está mal.
 *
 * Para registrar fallos parciales (scraper que crashea), pasar ok=0 + error.
 */
export function logScraperRun(run: {
  scraper:       string;
  started_at:    number;
  finished_at:   number;
  ok:            boolean;
  total_found?:  number;
  total_new?:    number;
  total_updated?: number;
  error?:        string | null;
  triggered_by?: string;
}): void {
  const db = getDb();
  const id = `${run.scraper}_${run.started_at}_${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(
    `INSERT INTO scraper_runs (id, scraper, started_at, finished_at, ok,
       total_found, total_new, total_updated, duration_ms, error, triggered_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    run.scraper,
    run.started_at,
    run.finished_at,
    run.ok ? 1 : 0,
    run.total_found ?? 0,
    run.total_new ?? 0,
    run.total_updated ?? 0,
    run.finished_at - run.started_at,
    run.error ?? null,
    run.triggered_by ?? 'cron',
  );
}

/** Últimas N ejecuciones de scrapers (todas las fuentes mezcladas). */
export function recentScraperRuns(limit = 10): ScraperRun[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM scraper_runs ORDER BY started_at DESC LIMIT ?`,
  ).all(limit) as ScraperRun[];
}

/**
 * Métricas agregadas de salud de scrapers para el panel SOS.
 *
 * Devuelve un resumen por scraper con el LAST RUN. Si un scraper no ha corrido
 * NUNCA, no aparece. Útil para detectar "BDNS no corre desde hace 3 días".
 */
export function statsScrapers(): {
  scraper:      string;
  lastRun:      number;          // epoch del último run
  lastOk:       boolean;
  lastNew:      number;
  lastUpdated:  number;
  lastError:    string | null;
  totalRuns7d:  number;
  okRate7d:     number;          // 0..1
}[] {
  const db = getDb();
  const cutoff7d = Math.floor(Date.now() / 1000) - 7 * 86400;

  // Sub-query: último run por scraper
  const rows = db.prepare(`
    WITH last_runs AS (
      SELECT scraper, MAX(started_at) AS last_started
      FROM scraper_runs
      GROUP BY scraper
    )
    SELECT
      sr.scraper,
      sr.started_at  AS lastRun,
      sr.ok          AS lastOk,
      sr.total_new   AS lastNew,
      sr.total_updated AS lastUpdated,
      sr.error       AS lastError,
      (SELECT COUNT(*) FROM scraper_runs sr2 WHERE sr2.scraper = sr.scraper AND sr2.started_at >= ?) AS totalRuns7d,
      (SELECT CAST(AVG(ok) AS REAL) FROM scraper_runs sr2 WHERE sr2.scraper = sr.scraper AND sr2.started_at >= ?) AS okRate7d
    FROM scraper_runs sr
    INNER JOIN last_runs lr
      ON lr.scraper = sr.scraper AND lr.last_started = sr.started_at
    ORDER BY sr.scraper ASC
  `).all(cutoff7d, cutoff7d) as Array<{
    scraper: string; lastRun: number; lastOk: number; lastNew: number;
    lastUpdated: number; lastError: string | null;
    totalRuns7d: number; okRate7d: number | null;
  }>;

  return rows.map((r) => ({
    scraper:     r.scraper,
    lastRun:     r.lastRun,
    lastOk:      r.lastOk === 1,
    lastNew:     r.lastNew,
    lastUpdated: r.lastUpdated,
    lastError:   r.lastError,
    totalRuns7d: r.totalRuns7d,
    okRate7d:    r.okRate7d ?? 1,
  }));
}

// ─── Snapshot GA4 (alimentado por cron desde el HUB) ──────────────────────

export type Ga4Snapshot = {
  date:                   string;       // YYYY-MM-DD
  sessions_total:         number;
  page_views_total:       number;
  sessions_subvenciones:  number;
  sessions_diagnostico:   number;
  sessions_presentar:     number;
  sessions_catalogo:      number;
  top_path:               string | null;
  top_path_sessions:      number;
  synced_at:              number;
};

/**
 * Upsert de una fila de snapshot GA4. Idempotente por (date).
 * Llamado por /api/internal/ga4-snapshot que recibe el POST del cron VPS.
 */
export function upsertGa4Snapshot(snap: Omit<Ga4Snapshot, 'synced_at'> & { synced_at?: number }): void {
  const db = getDb();
  const syncedAt = snap.synced_at ?? Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO ga4_snapshot (
      date, sessions_total, page_views_total,
      sessions_subvenciones, sessions_diagnostico, sessions_presentar, sessions_catalogo,
      top_path, top_path_sessions, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      sessions_total        = excluded.sessions_total,
      page_views_total      = excluded.page_views_total,
      sessions_subvenciones = excluded.sessions_subvenciones,
      sessions_diagnostico  = excluded.sessions_diagnostico,
      sessions_presentar    = excluded.sessions_presentar,
      sessions_catalogo     = excluded.sessions_catalogo,
      top_path              = excluded.top_path,
      top_path_sessions     = excluded.top_path_sessions,
      synced_at             = excluded.synced_at
  `).run(
    snap.date,
    snap.sessions_total,
    snap.page_views_total,
    snap.sessions_subvenciones,
    snap.sessions_diagnostico,
    snap.sessions_presentar,
    snap.sessions_catalogo,
    snap.top_path,
    snap.top_path_sessions,
    syncedAt,
  );
}

/**
 * Devuelve los últimos N días de snapshot. Útil para series temporales
 * en el embudo del admin.
 */
export function recentGa4Snapshots(days = 30): Ga4Snapshot[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM ga4_snapshot ORDER BY date DESC LIMIT ?`,
  ).all(days) as Ga4Snapshot[];
}

/**
 * Agrega los snapshots de los últimos N días en totales globales.
 * Si no hay datos para todo el rango, agrega solo lo disponible.
 *
 * lastSyncedAt = epoch del último día con datos (útil para mostrar frescura
 * en el panel: "última actualización hace X días").
 */
export function statsGa4(days = 30): {
  days_covered:           number;        // cuántos días con datos
  sessions_total:         number;
  page_views_total:       number;
  sessions_subvenciones:  number;
  sessions_diagnostico:   number;
  sessions_presentar:     number;
  sessions_catalogo:      number;
  last_synced_at:         number | null;
  last_date:              string | null;
} {
  const db = getDb();
  const fromDate = new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10);

  const row = db.prepare(`
    SELECT
      COUNT(*)                         AS days_covered,
      COALESCE(SUM(sessions_total), 0)         AS sessions_total,
      COALESCE(SUM(page_views_total), 0)       AS page_views_total,
      COALESCE(SUM(sessions_subvenciones), 0)  AS sessions_subvenciones,
      COALESCE(SUM(sessions_diagnostico), 0)   AS sessions_diagnostico,
      COALESCE(SUM(sessions_presentar), 0)     AS sessions_presentar,
      COALESCE(SUM(sessions_catalogo), 0)      AS sessions_catalogo,
      MAX(synced_at)                   AS last_synced_at,
      MAX(date)                        AS last_date
    FROM ga4_snapshot
    WHERE date >= ?
  `).get(fromDate) as {
    days_covered: number; sessions_total: number; page_views_total: number;
    sessions_subvenciones: number; sessions_diagnostico: number;
    sessions_presentar: number; sessions_catalogo: number;
    last_synced_at: number | null; last_date: string | null;
  };

  return {
    days_covered:          row.days_covered ?? 0,
    sessions_total:        row.sessions_total ?? 0,
    page_views_total:      row.page_views_total ?? 0,
    sessions_subvenciones: row.sessions_subvenciones ?? 0,
    sessions_diagnostico:  row.sessions_diagnostico ?? 0,
    sessions_presentar:    row.sessions_presentar ?? 0,
    sessions_catalogo:     row.sessions_catalogo ?? 0,
    last_synced_at:        row.last_synced_at,
    last_date:             row.last_date,
  };
}
