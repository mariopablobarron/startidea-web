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

export type TipoEvento = 'pregunta' | 'atajo' | 'estacion' | 'clic' | 'charla' | 'regalo' | 'resumen';

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
  audiencia: string; // empresa | institucion | entidad-social | emprendedor | ''
  respuesta: string; // tipo=charla: lo que contestó el asistente
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
      pagina      TEXT NOT NULL DEFAULT '',
      audiencia   TEXT NOT NULL DEFAULT '',
      respuesta   TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_plano_created ON eventos_plano (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_plano_tipo ON eventos_plano (tipo);
    CREATE TABLE IF NOT EXISTS regalos_plano (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  INTEGER NOT NULL,
      ip_hash     TEXT NOT NULL,
      visitante   TEXT NOT NULL DEFAULT '',
      tipo        TEXT NOT NULL,
      datos       TEXT NOT NULL DEFAULT '',
      resultado   TEXT NOT NULL DEFAULT '',
      audiencia   TEXT NOT NULL DEFAULT '',
      ok          INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_regalos_ip ON regalos_plano (ip_hash, created_at DESC);
  `);
  // Migración suave: columnas añadidas después de la primera versión.
  try { _db.exec(`ALTER TABLE eventos_plano ADD COLUMN respuesta TEXT NOT NULL DEFAULT ''`); } catch { /* ya existe */ }
  return _db;
}

/** Hash de IP + día: cuenta visitantes distintos sin guardar la IP. */
export function hashVisitante(ip: string): string {
  const dia = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${dia}|${ip}`).digest('hex').slice(0, 12);
}

/** Hash estable de la IP (sin día) para el límite diario de regalos. No es reversible. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`regalos|${ip}`).digest('hex').slice(0, 16);
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
  audiencia?: string;
  respuesta?: string;
}): void {
  try {
    getDb()
      .prepare(`
        INSERT INTO eventos_plano (created_at, tipo, texto, intencion, estaciones, fuente, destino, visitante, pagina, audiencia, respuesta)
        VALUES (@created_at, @tipo, @texto, @intencion, @estaciones, @fuente, @destino, @visitante, @pagina, @audiencia, @respuesta)
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
        audiencia: (e.audiencia ?? '').slice(0, 30),
        respuesta: anonimizarTexto((e.respuesta ?? '').slice(0, 1500)),
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
  porAudiencia: { audiencia: string; n: number }[];
}

export function getResumen(dias = 30): ResumenPlano {
  const db = getDb();
  const desde = Date.now() - dias * 86_400_000;
  const cuenta = (where: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM eventos_plano WHERE created_at >= ? ${where}`).get(desde) as { n: number }).n;
  const porIntencion = db
    .prepare(`SELECT intencion, COUNT(*) AS n FROM eventos_plano WHERE created_at >= ? AND tipo IN ('pregunta','atajo') AND intencion <> '' GROUP BY intencion ORDER BY n DESC`)
    .all(desde) as { intencion: string; n: number }[];
  const porAudiencia = db
    .prepare(`SELECT audiencia, COUNT(*) AS n FROM eventos_plano WHERE created_at >= ? AND tipo IN ('pregunta','atajo') AND audiencia <> '' GROUP BY audiencia ORDER BY n DESC`)
    .all(desde) as { audiencia: string; n: number }[];
  const visitantes = (db.prepare(`SELECT COUNT(DISTINCT visitante) AS n FROM eventos_plano WHERE created_at >= ?`).get(desde) as { n: number }).n;
  return {
    total: cuenta(''),
    preguntas: cuenta(`AND tipo = 'pregunta'`),
    atajos: cuenta(`AND tipo = 'atajo'`),
    clics: cuenta(`AND tipo = 'clic'`),
    visitantes,
    sinRuta: cuenta(`AND tipo = 'pregunta' AND fuente = 'ninguna'`),
    porIntencion,
    porAudiencia,
  };
}

// ─── Regalos ────────────────────────────────────────────────────────────

export interface RegaloRow {
  id: number;
  created_at: number;
  ip_hash: string;
  visitante: string;
  tipo: string;
  datos: string;
  resultado: string;
  audiencia: string;
  ok: number;
}

function inicioDia(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Regalos generados hoy por esta IP (solo los que salieron bien). */
export function regalosHoyPorIp(ip: string): number {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM regalos_plano WHERE ip_hash = ? AND created_at >= ? AND ok = 1`).get(hashIp(ip), inicioDia()) as { n: number }).n;
}

/** Regalos generados hoy en total (tope global de coste). */
export function regalosHoyTotal(): number {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM regalos_plano WHERE created_at >= ? AND ok = 1`).get(inicioDia()) as { n: number }).n;
}

/**
 * Resúmenes por correo generados hoy en total (eventos tipo 'resumen' desde el
 * inicio del día). Tope global diario de /api/plano/resumen: acota el coste
 * de modelo y los correos que startidea.es puede llegar a enviar en un día.
 * Persistido en plano.db para sobrevivir a reinicios del container.
 */
export function resumenesHoyTotal(): number {
  try {
    return (getDb().prepare(`SELECT COUNT(*) AS n FROM eventos_plano WHERE tipo = 'resumen' AND created_at >= ?`).get(inicioDia()) as { n: number }).n;
  } catch (err) {
    console.error('[plano-db] no se pudo contar los resúmenes de hoy', err);
    return 0;
  }
}

export function registrarRegalo(r: { ip: string; tipo: string; datos: unknown; resultado: string; audiencia?: string; ok: boolean }): void {
  try {
    getDb()
      .prepare(`INSERT INTO regalos_plano (created_at, ip_hash, visitante, tipo, datos, resultado, audiencia, ok) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(Date.now(), hashIp(r.ip), hashVisitante(r.ip), r.tipo, anonimizarTexto(JSON.stringify(r.datos ?? {}).slice(0, 2000)), anonimizarTexto(r.resultado.slice(0, 6000)), r.audiencia ?? '', r.ok ? 1 : 0);
  } catch (err) {
    console.error('[plano-db] no se pudo registrar el regalo', err);
  }
}

export function getRegalos(limit = 100): RegaloRow[] {
  return getDb().prepare(`SELECT * FROM regalos_plano ORDER BY created_at DESC LIMIT ?`).all(limit) as RegaloRow[];
}
