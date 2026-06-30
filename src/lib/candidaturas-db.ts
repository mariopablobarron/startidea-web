/**
 * candidaturas-db.ts
 *
 * SQLite local para el portal "Trabaja con nosotros" de Startidea:
 * candidaturas espontáneas (empleo, freelance, colaboración) con adjuntos
 * (CV, cartas de recomendación, portfolio). Usa better-sqlite3.
 * La BD (candidaturas.db) vive en EXPEDIENTES_DIR (default /data/expedientes),
 * el mismo volumen persistente que el resto de features. Los ficheros se
 * guardan en EXPEDIENTES_DIR/candidaturas/<id>/.
 * Solo se abre en runtime (endpoints con prerender=false).
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

/** Adjunto guardado: nombre original + nombre en disco + tamaño. */
export interface Adjunto {
  campo: string;   // 'cv' | 'carta' | 'portfolio' | 'otros'
  nombre: string;  // nombre original del archivo
  archivo: string; // nombre saneado en disco
  kb: number;      // tamaño en KB
}

export interface Candidatura {
  id: string;
  tipo: string;        // empleo | freelance | colaboracion
  area: string;        // Comunicación | Audiovisual | Tecnología | Diseño | Consultoría | Otro
  nombre: string;
  email: string;
  telefono: string;
  ubicacion: string;
  linkedin: string;
  web: string;
  mensaje: string;
  adjuntos: string;    // JSON array de Adjunto
  ip: string;
  created_at: number;  // epoch ms
  estado: string;
  notas_admin: string;
}

export type EstadoCandidatura =
  | 'nueva'
  | 'revisada'
  | 'preseleccionada'
  | 'entrevista'
  | 'descartada'
  | 'contratada';

export const ESTADOS_CANDIDATURA: EstadoCandidatura[] = [
  'nueva',
  'revisada',
  'preseleccionada',
  'entrevista',
  'descartada',
  'contratada',
];

export const TIPOS_CANDIDATURA = ['empleo', 'freelance', 'colaboracion'] as const;
export const AREAS_CANDIDATURA = [
  'Comunicación',
  'Audiovisual y podcast',
  'Tecnología y producto',
  'Diseño',
  'Consultoría e innovación social',
  'Fundraising',
  'Otro',
] as const;

let _db: Database.Database | null = null;

export function getCandidaturasDir(): string {
  return join(process.env.EXPEDIENTES_DIR ?? '/data/expedientes', 'candidaturas');
}

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = process.env.EXPEDIENTES_DIR ?? '/data/expedientes';
  try {
    mkdirSync(dir, { recursive: true });
  } catch { /* already exists */ }
  _db = new Database(join(dir, 'candidaturas.db'));
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS candidaturas (
      id          TEXT PRIMARY KEY,
      tipo        TEXT NOT NULL DEFAULT '',
      area        TEXT NOT NULL DEFAULT '',
      nombre      TEXT NOT NULL DEFAULT '',
      email       TEXT NOT NULL DEFAULT '',
      telefono    TEXT NOT NULL DEFAULT '',
      ubicacion   TEXT NOT NULL DEFAULT '',
      linkedin    TEXT NOT NULL DEFAULT '',
      web         TEXT NOT NULL DEFAULT '',
      mensaje     TEXT NOT NULL DEFAULT '',
      adjuntos    TEXT NOT NULL DEFAULT '[]',
      ip          TEXT NOT NULL DEFAULT '',
      created_at  INTEGER NOT NULL DEFAULT 0,
      estado      TEXT NOT NULL DEFAULT 'nueva',
      notas_admin TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_cand_created ON candidaturas (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cand_email ON candidaturas (email);
  `);
  return _db;
}

export function saveCandidatura(
  c: Omit<Candidatura, 'estado' | 'notas_admin'>,
): void {
  getDb()
    .prepare(`
      INSERT INTO candidaturas (
        id, tipo, area, nombre, email, telefono, ubicacion,
        linkedin, web, mensaje, adjuntos, ip, created_at
      ) VALUES (
        @id, @tipo, @area, @nombre, @email, @telefono, @ubicacion,
        @linkedin, @web, @mensaje, @adjuntos, @ip, @created_at
      )
    `)
    .run(c);
}

export function countCandidaturas(): number {
  return (getDb().prepare('SELECT COUNT(*) as n FROM candidaturas').get() as { n: number }).n;
}

export function getAllCandidaturas(): Candidatura[] {
  return getDb()
    .prepare('SELECT * FROM candidaturas ORDER BY created_at DESC')
    .all() as Candidatura[];
}

export function getCandidatura(id: string): Candidatura | undefined {
  return getDb()
    .prepare('SELECT * FROM candidaturas WHERE id = ?')
    .get(id) as Candidatura | undefined;
}

export function setEstadoCandidatura(id: string, estado: string, notas?: string): boolean {
  const db = getDb();
  if (typeof notas === 'string') {
    return db.prepare('UPDATE candidaturas SET estado = ?, notas_admin = ? WHERE id = ?')
      .run(estado, notas, id).changes > 0;
  }
  return db.prepare('UPDATE candidaturas SET estado = ? WHERE id = ?')
    .run(estado, id).changes > 0;
}

export function statsCandidaturas(): Record<string, number> {
  const rows = getDb()
    .prepare('SELECT estado, COUNT(*) as n FROM candidaturas GROUP BY estado')
    .all() as Array<{ estado: string; n: number }>;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.estado] = r.n;
  return out;
}
