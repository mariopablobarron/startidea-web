/**
 * encuesta-db.ts
 *
 * SQLite local para las respuestas de la encuesta de dependencia pública
 * del tercer sector (base del informe original citable de Startidea).
 * Usa better-sqlite3. La BD (encuesta.db) vive en EXPEDIENTES_DIR
 * (default /data/expedientes), el mismo volumen montado del Copiloto.
 *
 * Solo se abre en runtime (endpoint POST con prerender=false). El build
 * estático NO la toca.
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export interface RespuestaEncuesta {
  id: string;
  tipo_entidad: string;
  presupuesto: string;
  personas_contratadas: string;
  pct_publico: number;
  mayor_fuente: string;
  mayor_fuente_pct: number;
  meses_aguante: string;
  base_social: number; // 0/1
  base_social_num: number;
  num_fuentes: string;
  problema_tesoreria: number; // 0/1
  mayor_reto: string;
  email: string;
  ip: string;
  created_at: number;
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
  const dbPath = join(dir, 'encuesta.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS respuestas_encuesta (
      id                   TEXT PRIMARY KEY,
      tipo_entidad         TEXT NOT NULL DEFAULT '',
      presupuesto          TEXT NOT NULL DEFAULT '',
      personas_contratadas TEXT NOT NULL DEFAULT '',
      pct_publico          INTEGER NOT NULL DEFAULT 0,
      mayor_fuente         TEXT NOT NULL DEFAULT '',
      mayor_fuente_pct     INTEGER NOT NULL DEFAULT 0,
      meses_aguante        TEXT NOT NULL DEFAULT '',
      base_social          INTEGER NOT NULL DEFAULT 0,
      base_social_num      INTEGER NOT NULL DEFAULT 0,
      num_fuentes          TEXT NOT NULL DEFAULT '',
      problema_tesoreria   INTEGER NOT NULL DEFAULT 0,
      mayor_reto           TEXT NOT NULL DEFAULT '',
      email                TEXT NOT NULL DEFAULT '',
      ip                   TEXT NOT NULL DEFAULT '',
      created_at           INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_enc_created ON respuestas_encuesta (created_at DESC);
  `);
  return _db;
}

export function saveRespuesta(r: RespuestaEncuesta): void {
  getDb()
    .prepare(`
      INSERT INTO respuestas_encuesta (
        id, tipo_entidad, presupuesto, personas_contratadas, pct_publico,
        mayor_fuente, mayor_fuente_pct, meses_aguante, base_social,
        base_social_num, num_fuentes, problema_tesoreria, mayor_reto,
        email, ip, created_at
      ) VALUES (
        @id, @tipo_entidad, @presupuesto, @personas_contratadas, @pct_publico,
        @mayor_fuente, @mayor_fuente_pct, @meses_aguante, @base_social,
        @base_social_num, @num_fuentes, @problema_tesoreria, @mayor_reto,
        @email, @ip, @created_at
      )
    `)
    .run(r);
}

export function countRespuestas(): number {
  return (getDb().prepare('SELECT COUNT(*) as n FROM respuestas_encuesta').get() as { n: number }).n;
}

export function getAllRespuestas(): RespuestaEncuesta[] {
  return getDb()
    .prepare('SELECT * FROM respuestas_encuesta ORDER BY created_at DESC')
    .all() as RespuestaEncuesta[];
}

/** Backup online consistente (WAL-safe) a destPath. */
export function backupEncuestaDb(destPath: string): Promise<void> {
  return getDb().backup(destPath).then(() => undefined);
}
