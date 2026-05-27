/**
 * POST /api/admin/crm-note   — añade una nota CRM
 * DELETE /api/admin/crm-note — elimina una nota CRM por id
 *
 * Auth: x-admin-token header
 */
import type { APIRoute } from 'astro';
import { addCrmNote, deleteCrmNote } from '@/lib/expedientes-db';
import { isValidAdminHeader } from '@/lib/admin-session';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: { email?: string; text?: string; author?: string };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { email, text, author } = body;
  if (!email?.trim() || !text?.trim()) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), { status: 400 });
  }

  const note = addCrmNote(email.trim(), text.trim(), author ?? 'admin');
  return new Response(JSON.stringify({ ok: true, note }), { status: 200 });
};

export const DELETE: APIRoute = async ({ request }) => {
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: { id?: string };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  if (!body.id?.trim()) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
  }

  const deleted = deleteCrmNote(body.id.trim());
  return new Response(JSON.stringify({ ok: deleted }), { status: deleted ? 200 : 404 });
};
