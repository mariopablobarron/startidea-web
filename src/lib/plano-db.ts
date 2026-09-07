/**
 * plano-db.ts
 *
 * Registro de lo que la gente pregunta en el «Plano Startidea» (hero del
 * prototipo /lab/home-plano). Es el dato que hoy no existe: el chat avisa por
 * Telegram y no guarda nada.
 *
 * Privacidad: no se guarda nombre, email ni IP en claro. Solo un hash diario
 * de la IP (para contar visitantes distintos por día, no para identificarlos),
 * el texto tal cual se escribió, la intención detectada y las estaciones
 * devueltas. Si el texto contiene un email, se enmascara antes de guardar.
 *
 * better-sqlite3, BD en EXPEDIENTES_DIR (misma carpeta que expedientes.db,
 * cursos.db, etc.).
 */

import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export type TipoEvento = 'pregunta' | 'atajo' | 'estacion' | 'clic';

export interface EventoPlano {
  id: number;
  created_at: number;
  tipo: TipoEvento;
  texto: string;
  intencion: string;
  estaciones: string; // ids separados por coma
  fuente: string; // modelo | patron | mapa | ninguna
  destino: string; // url pulsada (solo tipo=clic)
  visitante: string; // hash diario de IP
  pagina: string;
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = process.env.EXPEDIENTES_DIR ?? '/data/expedientes';
  try { mkdirSync(dir, { recursive: true }); } catch { /* existe */ }
  _db = new Database(join(dir, 'plano.db'));
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS eventos_plano (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  INTEGER NOT NULL,
      tipo        TEXT NOT NULL,
      texto       TEXT NOT NULL DEFAULT '',
      intencion   TEXT NOT NULL DEFAULT '',
      estaciones  TEXT NOT NULL DEFAULT '',
      fuente      TEXT NOT NULL DEFAULT '',
      destino     TEXT NOT NULL DEFAULT '',
      visitante   TEXT NOT NULL DEFAULT '',
      pagina      TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_plano_created ON eventos_plano (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_plano_tipo ON eventos_plano (tipo);
  `);
  return _db;
}

/** Hash de IP + día: cuenta visitantes distintos sin guardar la IP. */
export function hashVisitante(ip: string): string {
  const dia = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${dia}|${ip}`).digest('hex').slice(0, 12);
}

/** Enmascara emails y teléfonos que la gente escribe sin querer. */
export function anonimizarTexto(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(\+?\d[\d\s.-]{7,}\d)/g, '[teléfono]');
}

export function registrarEvento(e: {
  tipo: TipoEvento;
  texto?: string;
  intencion?: string;
  estaciones?: string[];
  fuente?: string;
  destino?: string;
  ip: string;
  pagina?: string;
}): void {
  try {
    getDb()
      .prepare(`
        INSERT INTO eventos_plano (created_at, tipo, texto, intencion, estaciones, fuente, destino, visitante, pagina)
        VALUES (@created_at, @tipo, @texto, @intencion, @estaciones, @fuente, @destino, @visitante, @pagina)
      `)
      .run({
        created_at: Date.now(),
        tipo: e.tipo,
        texto: anonimizarTexto((e.texto ?? '').slice(0, 500)),
        intencion: e.intencion ?? '',
        estaciones: (e.estaciones ?? []).join(','),
        fuente: e.fuente ?? '',
        destino: (e.destino ?? '').slice(0, 200),
        visitante: hashVisitante(e.ip),
        pagina: (e.pagina ?? '').slice(0, 120),
      });
  } catch (err) {
    console.error('[plano-db] no se pudo registrar el evento', err);
  }
}

export function getEventos(limit = 300): EventoPlano[] {
  return getDb()
    .prepare(`SELECT * FROM eventos_plano ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as EventoPlano[];
}

export interface ResumenPlano {
  total: number;
  preguntas: number;
  atajos: number;
  clics: number;
  visitantes: number;
  sinRuta: number;
  porIntencion: { intencion: string; n: number }[];
}

export function getResumen(dias = 30): ResumenPlano {
  const db = getDb();
  const desde = Date.now() - dias * 86_400_000;
  const cuenta = (where: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM eventos_plano WHERE created_at >= ? ${where}`).get(desde) as { n: number }).n;
  const porIntencion = db
    .prepare(`SELECT intencion, COUNT(*) AS n FROM eventos_plano WHERE created_at >= ? AND tipo IN ('pregunta','atajo') AND intencion <> '' GROUP BY intencion ORDER BY n DESC`)
    .all(desde) as { intencion: string; n: number }[];
  const visitantes = (db.prepare(`SELECT COUNT(DISTINCT visitante) AS n FROM eventos_plano WHERE created_at >= ?`).get(desde) as { n: number }).n;
  return {
    total: cuenta(''),
    preguntas: cuenta(`AND tipo = 'pregunta'`),
    atajos: cuenta(`AND tipo = 'atajo'`),
    clics: cuenta(`AND tipo = 'clic'`),
    visitantes,
    sinRuta: cuenta(`AND tipo = 'pregunta' AND fuente = 'ninguna'`),
    porIntencion,
  };
}
