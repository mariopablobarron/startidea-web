/**
 * POST /api/status-expediente
 * Cambia el estado de un expediente. Solo ADMIN_TOKEN.
 */

import type { APIRoute } from 'astro';
import { updateStatus, getExpediente } from '@/lib/expedientes-db';
import type { ExpedienteStatus } from '@/lib/expedientes-db';
import { isValidAdminHeader } from '@/lib/admin-session';

export const prerender = false;

const VALID_STATUSES: ExpedienteStatus[] = ['recibido', 'analizando_ia', 'docs_listos', 'entregado', 'presentado', 'rechazado'];

export const POST: APIRoute = async ({ request }) => {
  // Auth: el panel envía sha256(ADMIN_TOKEN) como cookie → header x-admin-token
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: { id?: string; status?: string };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { id, status } = body;
  if (!id || !status) return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), { status: 400 });
  if (!VALID_STATUSES.includes(status as ExpedienteStatus)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_status' }), { status: 400 });
  }
  if (!getExpediente(id)) return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });

  updateStatus(id, status as ExpedienteStatus);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
