import type { APIRoute } from 'astro';
import { collectCandidates } from '@/lib/radar/fetchers';
import { upsertCandidates } from '@/lib/radar/db';
import { authorize, readBody, reply } from '@/lib/radar/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const denied = authorize(request, cookies);
  if (denied) return denied;
  let body: Record<string, unknown>;
  try { body = await readBody(request); }
  catch { return reply(request, 'invalid-input', { ok: false, error: 'invalid_body' }, 400); }
  const maxPerSource = Number(body.maxPerSource ?? 18);
  const signalFloor = Number(body.signalFloor ?? 0);
  if (!Number.isInteger(maxPerSource) || maxPerSource < 1 || maxPerSource > 30 || !Number.isFinite(signalFloor) || signalFloor < 0 || signalFloor > 100) {
    return reply(request, 'invalid-input', { ok: false, error: 'invalid_limits' }, 400);
  }
  try {
    const { candidates, sources } = await collectCandidates({ maxPerSource, signalFloor });
    if (sources.every((source) => !source.ok)) return reply(request, 'fetch-fail', { ok: false, error: 'sources_unavailable', sources }, 502);
    const added = upsertCandidates(candidates);
    const partial = sources.some((source) => !source.ok);
    return reply(request, `${partial ? 'fetch-partial' : 'fetch-ok'}-${added}`, { ok: true, partial, added, total: candidates.length, sources });
  } catch {
    return reply(request, 'fetch-fail', { ok: false, error: 'fetch_failed' }, 500);
  }
};
