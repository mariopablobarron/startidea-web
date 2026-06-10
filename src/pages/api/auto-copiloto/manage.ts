/**
 * POST /api/auto-copiloto/manage
 *
 * Permite a la organización pausar, reactivar o cancelar su Copiloto.
 * Usa el manage_token como bearer — sin necesidad de login.
 *
 * Body JSON: { token: string; action: 'pause' | 'resume' | 'cancel' }
 */

import type { APIRoute } from 'astro';
import { deactivateProfile, reactivateProfile } from '@/lib/auto-copiloto-db';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { token?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const { token, action } = body;
  if (!token || !action) {
    return json({ ok: false, error: 'missing_params' }, 400);
  }
  if (!['pause', 'resume', 'cancel'].includes(action)) {
    return json({ ok: false, error: 'invalid_action' }, 400);
  }

  let changed = false;
  if (action === 'pause' || action === 'cancel') {
    changed = deactivateProfile(token);
  } else if (action === 'resume') {
    changed = reactivateProfile(token);
  }

  if (!changed) {
    return json({ ok: false, error: 'token_not_found' }, 404);
  }

  return json({ ok: true, action });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
