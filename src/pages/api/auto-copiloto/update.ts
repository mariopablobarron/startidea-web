/**
 * POST /api/auto-copiloto/update
 *
 * La organización edita su perfil del Copiloto con el manage_token como
 * bearer (sin login), igual que /manage. Body JSON: { token, ...campos }.
 * No cambia email, estado, plan ni datos de Stripe.
 */

import type { APIRoute } from 'astro';
import { getProfileByManageToken, updateProfile } from '@/lib/auto-copiloto-db';
import { parseProfileUpdate } from '@/lib/copiloto-perfil';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request);
  const rl = rateLimit({ key: ip, bucket: 'auto-copiloto-update', maxHits: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return json({ ok: false, error: 'rate_limit' }, 429);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return json({ ok: false, error: 'missing_token' }, 400);
  const profile = getProfileByManageToken(token);
  if (!profile) return json({ ok: false, error: 'invalid_token' }, 404);

  const parsed = parseProfileUpdate(body);
  if (!parsed.ok) return json({ ok: false, error: 'validation', detail: parsed.error }, 400);

  const changed = updateProfile(token, parsed.data);
  if (!changed) return json({ ok: false, error: 'not_updated' }, 500);
  return json({ ok: true });
};
