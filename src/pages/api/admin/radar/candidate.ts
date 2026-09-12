import type { APIRoute } from 'astro';
import { getCandidate, updateCandidateStatus } from '@/lib/radar/db';
import type { RadarStatus } from '@/lib/radar/types';
import { authorize, readBody, reply } from '@/lib/radar/http';

export const prerender = false;
const MANUAL_STATUSES: RadarStatus[] = ['detectada', 'validada', 'descartada', 'publicada'];

export const POST: APIRoute = async ({ request, cookies }) => {
  const denied = authorize(request, cookies);
  if (denied) return denied;
  let body: Record<string, unknown>;
  try { body = await readBody(request); }
  catch { return reply(request, 'invalid-input', { ok: false, error: 'invalid_body' }, 400); }
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const status = typeof body.status === 'string' ? body.status as RadarStatus : null;
  if (!id || !status || !MANUAL_STATUSES.includes(status)) return reply(request, 'invalid-input', { ok: false, error: 'invalid_input' }, 400);
  const candidate = getCandidate(id);
  if (!candidate) return reply(request, 'not-found', { ok: false, error: 'not_found' }, 404);
  const busy = candidate.status === 'generando' && candidate.generationStartedAt !== null && Date.now() / 1000 - candidate.generationStartedAt < 180;
  if (busy || (status === 'publicada' && (!candidate.aiPack || !['lista', 'publicada'].includes(candidate.status)))) {
    return reply(request, 'invalid-transition', { ok: false, error: 'invalid_transition' }, 409);
  }
  if (!updateCandidateStatus(id, status, candidate.status)) return reply(request, 'invalid-transition', { ok: false, error: 'state_changed' }, 409);
  return reply(request, 'status-updated', { ok: true });
};
