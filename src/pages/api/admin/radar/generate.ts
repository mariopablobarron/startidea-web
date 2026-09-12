import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { claimCandidateGeneration, getCandidate, setCandidateAiPack, updateCandidateStatus } from '@/lib/radar/db';
import type { RadarFocus } from '@/lib/radar/types';
import { generateRadarIdea } from '@/lib/radar/generator';
import { authorize, readBody, reply } from '@/lib/radar/http';

export const prerender = false;
const FOCUS: RadarFocus[] = ['meme', 'articulo', 'contenido'];

export const POST: APIRoute = async ({ request, cookies }) => {
  const denied = authorize(request, cookies);
  if (denied) return denied;
  let body: Record<string, unknown>;
  try { body = await readBody(request); }
  catch { return reply(request, 'invalid-input', { ok: false, error: 'invalid_body' }, 400); }
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const focus = typeof body.focus === 'string' ? body.focus as RadarFocus : 'contenido';
  if (!id || !FOCUS.includes(focus)) return reply(request, 'invalid-input', { ok: false, error: 'invalid_input' }, 400);
  if (!getEnv('OPENROUTER_API_KEY')) return reply(request, 'ai-unavailable', { ok: false, error: 'ai_unavailable' }, 503);
  const candidate = getCandidate(id);
  if (!candidate) return reply(request, 'not-found', { ok: false, error: 'not_found' }, 404);
  if (!claimCandidateGeneration(id)) return reply(request, 'validate-first', { ok: false, error: 'requires_validation' }, 409);
  try {
    const pack = await generateRadarIdea(candidate, focus);
    if (!setCandidateAiPack(id, focus, pack)) throw new Error('state_changed');
    return reply(request, 'generated', { ok: true, focus, id });
  } catch {
    updateCandidateStatus(id, 'validada', 'generando');
    return reply(request, 'generate-fail', { ok: false, error: 'generation_failed' }, 502);
  }
};
