/**
 * impulsa-db.ts
 *
 * SQLite local para las solicitudes del programa "Startidea Impulsa"
 * (diagnóstico de comunicación + lead-gen). Usa better-sqlite3.
 * La BD (impulsa.db) vive en EXPEDIENTES_DIR (default /data/expedientes).
 * Solo se abre en runtime (endpoint POST con prerender=false).
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export interface SolicitudImpulsa {
  id: string;
  org_nombre: string;
  org_tipo: string;
  org_cif: string;
  web_actual: string;
  ambito: string;
  anio_constitucion: string;
  num_personas: string;
  presupuesto: string;
  mision: string;
  web_estado: string;
  redes_estado: string;
  audiovisual: string;
  software_gestion: string;
  retos: string;
  servicios_interes: string; // JSON array
  objetivo: string;
  contacto_nombre: string;
  contacto_cargo: string;
  contacto_email: string;
  contacto_telefono: string;
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
  _db = new Database(join(dir, 'impulsa.db'));
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS solicitudes_impulsa (
      id                TEXT PRIMARY KEY,
      org_nombre        TEXT NOT NULL DEFAULT '',
      org_tipo          TEXT NOT NULL DEFAULT '',
      org_cif           TEXT NOT NULL DEFAULT '',
      web_actual        TEXT NOT NULL DEFAULT '',
      ambito            TEXT NOT NULL DEFAULT '',
      anio_constitucion TEXT NOT NULL DEFAULT '',
      num_personas      TEXT NOT NULL DEFAULT '',
      presupuesto       TEXT NOT NULL DEFAULT '',
      mision            TEXT NOT NULL DEFAULT '',
      web_estado        TEXT NOT NULL DEFAULT '',
      redes_estado      TEXT NOT NULL DEFAULT '',
      audiovisual       TEXT NOT NULL DEFAULT '',
      software_gestion  TEXT NOT NULL DEFAULT '',
      retos             TEXT NOT NULL DEFAULT '',
      servicios_interes TEXT NOT NULL DEFAULT '[]',
      objetivo          TEXT NOT NULL DEFAULT '',
      contacto_nombre   TEXT NOT NULL DEFAULT '',
      contacto_cargo    TEXT NOT NULL DEFAULT '',
      contacto_email    TEXT NOT NULL DEFAULT '',
      contacto_telefono TEXT NOT NULL DEFAULT '',
      ip                TEXT NOT NULL DEFAULT '',
      created_at        INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_imp_created ON solicitudes_impulsa (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_imp_email ON solicitudes_impulsa (contacto_email);
  `);
  return _db;
}

export function saveSolicitud(s: SolicitudImpulsa): void {
  getDb()
    .prepare(`
      INSERT INTO solicitudes_impulsa (
        id, org_nombre, org_tipo, org_cif, web_actual, ambito,
        anio_constitucion, num_personas, presupuesto, mision, web_estado,
        redes_estado, audiovisual, software_gestion, retos, servicios_interes,
        objetivo, contacto_nombre, contacto_cargo, contacto_email,
        contacto_telefono, ip, created_at
      ) VALUES (
        @id, @org_nombre, @org_tipo, @org_cif, @web_actual, @ambito,
        @anio_constitucion, @num_personas, @presupuesto, @mision, @web_estado,
        @redes_estado, @audiovisual, @software_gestion, @retos, @servicios_interes,
        @objetivo, @contacto_nombre, @contacto_cargo, @contacto_email,
        @contacto_telefono, @ip, @created_at
      )
    `)
    .run(s);
}

export function countSolicitudes(): number {
  return (getDb().prepare('SELECT COUNT(*) as n FROM solicitudes_impulsa').get() as { n: number }).n;
}

export function getAllSolicitudes(): SolicitudImpulsa[] {
  return getDb()
    .prepare('SELECT * FROM solicitudes_impulsa ORDER BY created_at DESC')
    .all() as SolicitudImpulsa[];
}

export function backupImpulsaDb(destPath: string): Promise<void> {
  return getDb().backup(destPath).then(() => undefined);
}
