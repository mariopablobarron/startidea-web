/**
 * Outbox durable para replicar altas humanas de startidea.es al HUB.
 *
 * La entrega al HUB es secundaria: el alta local y sus notificaciones conservan
 * su comportamiento aunque el HUB no esté disponible. Los eventos pendientes
 * viven en EXPEDIENTES_DIR/hub-intake-outbox.db y se reintentan por cron.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type HubIntakeKind =
  | 'contact'
  | 'application'
  | 'proposal'
  | 'resource'
  | 'newsletter'
  | 'registration'
  | 'event_lead'
  | 'event_waitlist'
  | 'other';

type IntakeDetailsValue = string | number | boolean | string[];

export interface HubIntakePayload {
  schemaVersion: 1;
  submissionId: string;
  kind: HubIntakeKind;
  form: string;
  occurredAt: string;
  contact: {
    email: string;
    name?: string;
    phone?: string;
  };
  organization?: {
    name?: string;
    website?: string;
  };
  subject: string;
  message?: string;
  details?: Record<string, IntakeDetailsValue>;
  consents?: {
    privacy?: boolean;
    marketing?: boolean;
  };
}

export interface HubIntakeOutboxRow {
  id: string;
  submissionId: string;
  payload: HubIntakePayload;
  status: 'pending' | 'sending' | 'sent';
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  createdAt: number;
  sentAt: number | null;
}

export interface HubIntakeRetryResult {
  processed: number;
  sent: number;
  failed: number;
  pending: number;
}

interface StoredRow {
  id: string;
  submission_id: string;
  payload_json: string;
  status: 'pending' | 'sending' | 'sent';
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  created_at: number;
  sent_at: number | null;
}

const DEFAULT_HUB_URL = 'https://hub.startidea.tech';
export const HUB_INTAKE_MAX_BYTES = 32 * 1024;
const DELIVERY_TIMEOUT_MS = 5_000;
const LEASE_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 24 * 60 * 60_000;
const HUB_INTAKE_KINDS = new Set<HubIntakeKind>([
  'contact',
  'application',
  'proposal',
  'resource',
  'newsletter',
  'registration',
  'event_lead',
  'event_waitlist',
  'other',
]);
const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const FORM_PATTERN = /^[a-z0-9][a-z0-9._/-]*$/;
// Mismo patrón usado por z.string().email() en la versión de Zod del HUB.
const EMAIL_PATTERN = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
// Equivalente a z.string().datetime({ offset: true }): fecha civil válida,
// segundos opcionales y zona Z o desplazamiento explícito.
const DATE_PATTERN = String.raw`((\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\d|3[01])|(0[469]|11)-(0[1-9]|[12]\d|30)|(02)-(0[1-9]|1\d|2[0-8])))`;
const OCCURRED_AT_PATTERN = new RegExp(
  `^${DATE_PATTERN}T([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d(\\.\\d+)?)?(Z|([+-]\\d{2}:?\\d{2}))$`,
);

let database: Database.Database | null = null;
let databasePath = '';

function outboxPath(): string {
  const dir = process.env.EXPEDIENTES_DIR ?? '/data/expedientes';
  mkdirSync(dir, { recursive: true });
  return join(dir, 'hub-intake-outbox.db');
}

function getDb(): Database.Database {
  const path = outboxPath();
  if (database && databasePath === path) return database;
  database?.close();
  database = new Database(path);
  databasePath = path;
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS hub_intake_outbox (
      id              TEXT PRIMARY KEY,
      submission_id   TEXT NOT NULL UNIQUE,
      payload_json    TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      attempts        INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL,
      last_error      TEXT,
      locked_at       INTEGER,
      created_at      INTEGER NOT NULL,
      sent_at         INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_hub_intake_due
      ON hub_intake_outbox (status, next_attempt_at);
  `);
  return database;
}

function fromStored(row: StoredRow): HubIntakeOutboxRow {
  return {
    id: row.id,
    submissionId: row.submission_id,
    payload: JSON.parse(row.payload_json) as HubIntakePayload,
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]+/g, ' ').slice(0, 500);
}

function nextBackoff(attempts: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

function bounded(value: string | undefined, max: number): string | undefined {
  const clean = value?.trim().slice(0, max);
  return clean || undefined;
}

function normalizedWebsite(value: string | undefined): string | undefined {
  const clean = bounded(value, 500);
  if (!clean) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString().slice(0, 500) : undefined;
  } catch {
    return undefined;
  }
}

/** Ajusta el payload al contrato v1 para que una fila no quede reintentando
 * eternamente por un texto largo o una web sin protocolo. */
export function normalizeHubIntakePayload(payload: HubIntakePayload): HubIntakePayload {
  if (payload.schemaVersion !== 1) throw new Error('schemaVersion HUB inválido');

  const submissionId = payload.submissionId.trim();
  if (submissionId.length < 8 || submissionId.length > 128 || !SUBMISSION_ID_PATTERN.test(submissionId)) {
    throw new Error('submissionId HUB inválido');
  }
  if (!HUB_INTAKE_KINDS.has(payload.kind)) throw new Error('kind HUB inválido');

  const form = payload.form.trim();
  if (form.length < 1 || form.length > 80 || !FORM_PATTERN.test(form)) {
    throw new Error('form HUB inválido');
  }

  const occurredAt = payload.occurredAt.trim();
  if (!OCCURRED_AT_PATTERN.test(occurredAt)) throw new Error('occurredAt HUB inválido');

  const email = payload.contact.email.trim().toLowerCase();
  if (email.length > 200 || !EMAIL_PATTERN.test(email)) throw new Error('email HUB inválido');

  const details: Record<string, IntakeDetailsValue> = {};
  for (const [rawKey, rawValue] of Object.entries(payload.details ?? {}).slice(0, 40)) {
    const key = rawKey.trim().slice(0, 80);
    if (!key) continue;
    if (typeof rawValue === 'string') details[key] = rawValue.trim().slice(0, 2_000);
    else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) details[key] = rawValue;
    else if (typeof rawValue === 'boolean') details[key] = rawValue;
    else if (Array.isArray(rawValue)) {
      details[key] = rawValue.slice(0, 20).map((value) => String(value).trim().slice(0, 200));
    }
  }

  const organizationName = bounded(payload.organization?.name, 200);
  const organizationWebsite = normalizedWebsite(payload.organization?.website);
  const contactName = bounded(payload.contact.name, 200);
  const contactPhone = bounded(payload.contact.phone, 50);
  const message = bounded(payload.message, 5_000);
  const normalized: HubIntakePayload = {
    schemaVersion: 1,
    submissionId,
    kind: payload.kind,
    form,
    occurredAt,
    contact: {
      email,
      ...(contactName ? { name: contactName } : {}),
      ...(contactPhone ? { phone: contactPhone } : {}),
    },
    ...(organizationName || organizationWebsite
      ? { organization: { ...(organizationName ? { name: organizationName } : {}), ...(organizationWebsite ? { website: organizationWebsite } : {}) } }
      : {}),
    subject: bounded(payload.subject, 200) ?? 'Formulario web',
    ...(message ? { message } : {}),
    ...(Object.keys(details).length > 0 ? { details } : {}),
    ...(payload.consents ? { consents: payload.consents } : {}),
  };

  // El HUB limita el JSON a 32 KiB UTF-8. Contacto y asunto se conservan;
  // primero se ajusta el mensaje y después se añaden los detalles que caben.
  const normalizedDetails = normalized.details;
  delete normalized.details;
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > HUB_INTAKE_MAX_BYTES && normalized.message) {
    const originalMessage = normalized.message;
    let low = 0;
    let high = originalMessage.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      normalized.message = originalMessage.slice(0, middle);
      if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') <= HUB_INTAKE_MAX_BYTES) low = middle;
      else high = middle - 1;
    }
    if (low > 0) normalized.message = originalMessage.slice(0, low);
    else delete normalized.message;
  }

  if (normalizedDetails) {
    const fittedDetails: Record<string, IntakeDetailsValue> = {};
    for (const [key, value] of Object.entries(normalizedDetails)) {
      fittedDetails[key] = value;
      normalized.details = fittedDetails;
      if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > HUB_INTAKE_MAX_BYTES) {
        delete fittedDetails[key];
      }
    }
    if (Object.keys(fittedDetails).length === 0) delete normalized.details;
  }

  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > HUB_INTAKE_MAX_BYTES) {
    throw new Error(`Payload HUB supera ${HUB_INTAKE_MAX_BYTES} bytes tras normalizar`);
  }
  return normalized;
}

function claim(id: string, now: number): StoredRow | undefined {
  const db = getDb();
  const claimed = db.prepare(`
    UPDATE hub_intake_outbox
       SET status = 'sending', locked_at = @now
     WHERE id = @id
       AND (
         (status = 'pending' AND next_attempt_at <= @now)
         OR (status = 'sending' AND locked_at <= @staleBefore)
       )
  `).run({ id, now, staleBefore: now - LEASE_MS });
  if (claimed.changes === 0) return undefined;
  return db.prepare('SELECT * FROM hub_intake_outbox WHERE id = ?').get(id) as StoredRow;
}

async function postToHub(payload: HubIntakePayload): Promise<void> {
  const secret = process.env.HUB_INTAKE_SECRET?.trim();
  if (!secret) throw new Error('HUB_INTAKE_SECRET no configurado');

  const baseUrl = (process.env.HUB_INTAKE_URL?.trim() || DEFAULT_HUB_URL).replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/api/public/intake/startidea-web`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HUB respondió HTTP ${response.status}`);
  }
}

/** Persiste un evento antes de cualquier intento de red. */
export function enqueueHubIntake(payload: HubIntakePayload): string {
  const now = Date.now();
  const id = randomUUID();
  const normalized = normalizeHubIntakePayload(payload);
  const payloadJson = JSON.stringify(normalized);
  if (Buffer.byteLength(payloadJson, 'utf8') > HUB_INTAKE_MAX_BYTES) {
    throw new Error(`Payload HUB supera ${HUB_INTAKE_MAX_BYTES} bytes`);
  }
  getDb().prepare(`
    INSERT INTO hub_intake_outbox (
      id, submission_id, payload_json, status, attempts,
      next_attempt_at, created_at
    ) VALUES (?, ?, ?, 'pending', 0, ?, ?)
  `).run(id, normalized.submissionId, payloadJson, now, now);
  return id;
}

/** Intenta una entrega reclamada. Devuelve false si queda pendiente. */
export async function attemptHubIntakeDelivery(id: string): Promise<boolean> {
  const now = Date.now();
  const row = claim(id, now);
  if (!row) return false;

  try {
    await postToHub(JSON.parse(row.payload_json) as HubIntakePayload);
    getDb().prepare(`
      UPDATE hub_intake_outbox
         SET status = 'sent', sent_at = ?, last_error = NULL, locked_at = NULL
       WHERE id = ? AND status = 'sending'
    `).run(Date.now(), id);
    return true;
  } catch (error) {
    const attempts = row.attempts + 1;
    getDb().prepare(`
      UPDATE hub_intake_outbox
         SET status = 'pending', attempts = ?, next_attempt_at = ?,
             last_error = ?, locked_at = NULL
       WHERE id = ? AND status = 'sending'
    `).run(attempts, Date.now() + nextBackoff(attempts), errorMessage(error), id);
    return false;
  }
}

/**
 * Un fallo al persistir la fila se propaga para no perder silenciosamente el
 * evento. Tras existir la fila, un fallo de entrega queda pendiente y no altera
 * la respuesta primaria.
 */
export async function replicateHubIntake(payload: HubIntakePayload): Promise<void> {
  const id = enqueueHubIntake(payload);
  await attemptHubIntakeDelivery(id);
}

/** Reprocesa eventos vencidos (y recupera leases abandonados). */
export async function retryPendingHubIntake(limit = 50): Promise<HubIntakeRetryResult> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 50, 200));
  const now = Date.now();
  const rows = getDb().prepare(`
    SELECT id FROM hub_intake_outbox
     WHERE (status = 'pending' AND next_attempt_at <= ?)
        OR (status = 'sending' AND locked_at <= ?)
     ORDER BY created_at ASC
     LIMIT ?
  `).all(now, now - LEASE_MS, safeLimit) as Array<{ id: string }>;

  let sent = 0;
  for (const row of rows) {
    if (await attemptHubIntakeDelivery(row.id)) sent += 1;
  }
  const pending = (getDb().prepare(
    `SELECT COUNT(*) AS count FROM hub_intake_outbox WHERE status != 'sent'`,
  ).get() as { count: number }).count;
  return { processed: rows.length, sent, failed: rows.length - sent, pending };
}

/** Lectura operativa/test sin exponer secretos ni cabeceras. */
export function getHubIntakeOutboxRow(id: string): HubIntakeOutboxRow | undefined {
  const row = getDb().prepare('SELECT * FROM hub_intake_outbox WHERE id = ?').get(id) as StoredRow | undefined;
  return row ? fromStored(row) : undefined;
}

export function closeHubIntakeOutbox(): void {
  database?.close();
  database = null;
  databasePath = '';
}
