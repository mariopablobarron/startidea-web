/**
 * POST /api/status-expediente
 * Cambia el estado de un expediente. Solo ADMIN_TOKEN.
 */

import type { APIRoute } from 'astro';
import { updateStatus, getExpediente } from '@/lib/expedientes-db';
import type { ExpedienteStatus } from '@/lib/expedientes-db';

export const prerender = false;

const VALID_STATUSES: ExpedienteStatus[] = ['recibido', 'analizando_ia', 'docs_listos', 'entregado', 'presentado', 'rechazado'];

function getEnv(key: string): string {
  return process.env[key] ?? (import.meta as any).env?.[key] ?? '';
}

export const POST: APIRoute = async ({ request }) => {
  const adminToken = getEnv('ADMIN_TOKEN');
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!adminToken || reqToken !== adminToken) {
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
