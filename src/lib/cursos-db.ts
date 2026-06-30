/**
 * cursos-db.ts
 *
 * SQLite local para las RESERVAS de plaza de los cursos del Startidea Lab.
 * Modelo de cobro: señal/depósito vía Stripe para reservar plaza; el total se
 * liquida cuando la edición se confirma. better-sqlite3, BD en EXPEDIENTES_DIR.
 *
 * Flujo: se crea la reserva en estado 'pendiente' al abrir el Checkout, y el
 * webhook de Stripe la marca 'pagada' cuando el pago se confirma.
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export interface ReservaCurso {
  id: string;
  curso_slug: string;
  curso_title: string;
  nombre: string;
  email: string;
  esfl: number; // 0 | 1 (entidad sin ánimo de lucro)
  senal_cents: number;
  moneda: string;
  stripe_session_id: string;
  stripe_payment_intent: string;
  estado_pago: string; // pendiente | pagada | reembolsada
  created_at: number;
  paid_at: number | null;
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = process.env.EXPEDIENTES_DIR ?? '/data/expedientes';
  try { mkdirSync(dir, { recursive: true }); } catch { /* existe */ }
  _db = new Database(join(dir, 'cursos.db'));
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS reservas_curso (
      id                    TEXT PRIMARY KEY,
      curso_slug            TEXT NOT NULL DEFAULT '',
      curso_title           TEXT NOT NULL DEFAULT '',
      nombre                TEXT NOT NULL DEFAULT '',
      email                 TEXT NOT NULL DEFAULT '',
      esfl                  INTEGER NOT NULL DEFAULT 0,
      senal_cents           INTEGER NOT NULL DEFAULT 0,
      moneda                TEXT NOT NULL DEFAULT 'eur',
      stripe_session_id     TEXT NOT NULL DEFAULT '',
      stripe_payment_intent TEXT NOT NULL DEFAULT '',
      estado_pago           TEXT NOT NULL DEFAULT 'pendiente',
      created_at            INTEGER NOT NULL DEFAULT 0,
      paid_at               INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_reserva_session ON reservas_curso (stripe_session_id);
    CREATE INDEX IF NOT EXISTS idx_reserva_created ON reservas_curso (created_at DESC);
  `);
  return _db;
}

export function createReserva(r: {
  id: string;
  curso_slug: string;
  curso_title: string;
  esfl: number;
  senal_cents: number;
  stripe_session_id: string;
  created_at: number;
}): void {
  getDb()
    .prepare(`
      INSERT INTO reservas_curso (
        id, curso_slug, curso_title, esfl, senal_cents, stripe_session_id, created_at
      ) VALUES (
        @id, @curso_slug, @curso_title, @esfl, @senal_cents, @stripe_session_id, @created_at
      )
    `)
    .run(r);
}

/** Marca pagada (idempotente: solo si seguía pendiente). Devuelve la reserva. */
export function markReservaPaid(
  sessionId: string,
  paymentIntent: string,
  nombre: string,
  email: string,
  paidAt: number,
): ReservaCurso | undefined {
  const db = getDb();
  db.prepare(`
    UPDATE reservas_curso
       SET estado_pago = 'pagada', stripe_payment_intent = ?, nombre = ?, email = ?, paid_at = ?
     WHERE stripe_session_id = ? AND estado_pago != 'pagada'
  `).run(paymentIntent, nombre, email, paidAt, sessionId);
  return db
    .prepare('SELECT * FROM reservas_curso WHERE stripe_session_id = ?')
    .get(sessionId) as ReservaCurso | undefined;
}

export function getAllReservas(): ReservaCurso[] {
  return getDb()
    .prepare('SELECT * FROM reservas_curso ORDER BY created_at DESC')
    .all() as ReservaCurso[];
}

export function countReservasPagadas(): number {
  return (getDb()
    .prepare("SELECT COUNT(*) as n FROM reservas_curso WHERE estado_pago = 'pagada'")
    .get() as { n: number }).n;
}
