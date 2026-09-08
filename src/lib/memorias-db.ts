/**
 * memorias-db.ts — pedidos del Generador de memorias y justificaciones.
 * Tabla `memoria_pedidos` en la misma BD SQLite que expedientes (un solo WAL).
 *
 * Estados: guion → pagado → redactando → revision → entregado (| error)
 *   guion      la carga está hecha y el guion generado; falta pagar
 *   pagado     Stripe confirmó el pago; la organización puede pedir el documento
 *   redactando el modelo está escribiendo
 *   revision   documento listo; una persona de Startidea lo lee antes de entregar
 *   entregado  aprobado y enviado a la organización
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Guion, MemoriaCarga, MemoriaTipo } from './memorias-engine';

export type MemoriaStatus = 'guion' | 'pagado' | 'redactando' | 'revision' | 'entregado' | 'error';

export interface MemoriaPedido {
  id: string;
  manage_token: string;
  tipo: MemoriaTipo;
  org_nombre: string;
  email: string;
  representante: string;
  periodo: string;
  carga_json: string;
  guion_json: string | null;
  documento_md: string | null;
  avisos_json: string | null;
  status: MemoriaStatus;
  precio_cents: number;
  stripe_session_id: string | null;
  paid_at: number | null;
  error: string | null;
  notas_revision: string | null;
  created_at: number;
  updated_at: number;
  entregado_at: number | null;
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = process.env.EXPEDIENTES_DIR ?? '/data/expedientes';
  mkdirSync(dir, { recursive: true });
  _db = new Database(join(dir, 'expedientes.db'));
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS memoria_pedidos (
      id                 TEXT PRIMARY KEY,
      manage_token       TEXT NOT NULL UNIQUE,
      tipo               TEXT NOT NULL,
      org_nombre         TEXT NOT NULL,
      email              TEXT NOT NULL,
      representante      TEXT NOT NULL DEFAULT '',
      periodo            TEXT NOT NULL DEFAULT '',
      carga_json         TEXT NOT NULL,
      guion_json         TEXT,
      documento_md       TEXT,
      avisos_json        TEXT,
      status             TEXT NOT NULL DEFAULT 'guion',
      precio_cents       INTEGER NOT NULL,
      stripe_session_id  TEXT,
      paid_at            INTEGER,
      error              TEXT,
      notas_revision     TEXT,
      created_at         INTEGER NOT NULL,
      updated_at         INTEGER NOT NULL,
      entregado_at       INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_memoria_pedidos_status ON memoria_pedidos (status, created_at);
    CREATE INDEX IF NOT EXISTS idx_memoria_pedidos_session ON memoria_pedidos (stripe_session_id);
  `);
  return _db;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function createPedido(carga: MemoriaCarga, precioCents: number, guion: Guion | null): MemoriaPedido {
  const db = getDb();
  const id = `ME-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
  const manage_token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const ts = now();
  const row: MemoriaPedido = {
    id,
    manage_token,
    tipo: carga.tipo,
    org_nombre: carga.org_nombre,
    email: carga.email,
    representante: carga.representante,
    periodo: carga.periodo,
    carga_json: JSON.stringify(carga),
    guion_json: guion ? JSON.stringify(guion) : null,
    documento_md: null,
    avisos_json: null,
    status: 'guion',
    precio_cents: precioCents,
    stripe_session_id: null,
    paid_at: null,
    error: null,
    notas_revision: null,
    created_at: ts,
    updated_at: ts,
    entregado_at: null,
  };
  db.prepare(
    `INSERT INTO memoria_pedidos (id, manage_token, tipo, org_nombre, email, representante, periodo, carga_json, guion_json,
       documento_md, avisos_json, status, precio_cents, stripe_session_id, paid_at, error, notas_revision, created_at, updated_at, entregado_at)
     VALUES (@id, @manage_token, @tipo, @org_nombre, @email, @representante, @periodo, @carga_json, @guion_json,
       @documento_md, @avisos_json, @status, @precio_cents, @stripe_session_id, @paid_at, @error, @notas_revision, @created_at, @updated_at, @entregado_at)`,
  ).run(row);
  return row;
}

export function getPedidoByToken(token: string): MemoriaPedido | null {
  return (getDb().prepare(`SELECT * FROM memoria_pedidos WHERE manage_token = ?`).get(token) as MemoriaPedido | undefined) ?? null;
}

export function getPedido(id: string): MemoriaPedido | null {
  return (getDb().prepare(`SELECT * FROM memoria_pedidos WHERE id = ?`).get(id) as MemoriaPedido | undefined) ?? null;
}

export function getPedidoByStripeSession(sessionId: string): MemoriaPedido | null {
  return (getDb().prepare(`SELECT * FROM memoria_pedidos WHERE stripe_session_id = ?`).get(sessionId) as MemoriaPedido | undefined) ?? null;
}

export function setStripeSession(id: string, sessionId: string): void {
  getDb().prepare(`UPDATE memoria_pedidos SET stripe_session_id = ?, updated_at = ? WHERE id = ?`).run(sessionId, now(), id);
}

/** Marca pagado. Devuelve true solo la primera vez (idempotente ante reintentos de Stripe). */
export function markPaid(id: string): boolean {
  const r = getDb()
    .prepare(`UPDATE memoria_pedidos SET status = 'pagado', paid_at = ?, updated_at = ? WHERE id = ? AND paid_at IS NULL`)
    .run(now(), now(), id);
  return r.changes > 0;
}

export function setGuion(id: string, guion: Guion): void {
  getDb().prepare(`UPDATE memoria_pedidos SET guion_json = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(guion), now(), id);
}

/** Reserva el pedido para redactar: solo pasa si está pagado (evita dobles clics). */
export function claimRedactando(id: string): boolean {
  const r = getDb()
    .prepare(`UPDATE memoria_pedidos SET status = 'redactando', error = NULL, updated_at = ? WHERE id = ? AND status IN ('pagado','error')`)
    .run(now(), id);
  return r.changes > 0;
}

export function setDocumento(id: string, documento: string, avisos: string[]): void {
  getDb()
    .prepare(`UPDATE memoria_pedidos SET documento_md = ?, avisos_json = ?, status = 'revision', updated_at = ? WHERE id = ?`)
    .run(documento, JSON.stringify(avisos), now(), id);
}

export function setError(id: string, error: string): void {
  getDb().prepare(`UPDATE memoria_pedidos SET status = 'error', error = ?, updated_at = ? WHERE id = ?`).run(error.slice(0, 500), now(), id);
}

export function markEntregado(id: string, notas: string | null): boolean {
  const r = getDb()
    .prepare(`UPDATE memoria_pedidos SET status = 'entregado', notas_revision = ?, entregado_at = ?, updated_at = ? WHERE id = ? AND status = 'revision'`)
    .run(notas, now(), now(), id);
  return r.changes > 0;
}

export function listPedidos(opts: { status?: MemoriaStatus; limit?: number } = {}): MemoriaPedido[] {
  const db = getDb();
  if (opts.status) {
    return db.prepare(`SELECT * FROM memoria_pedidos WHERE status = ? ORDER BY created_at DESC LIMIT ?`).all(opts.status, opts.limit ?? 50) as MemoriaPedido[];
  }
  return db.prepare(`SELECT * FROM memoria_pedidos ORDER BY created_at DESC LIMIT ?`).all(opts.limit ?? 50) as MemoriaPedido[];
}
