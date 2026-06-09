// POST /api/landing-generate
// Body JSON: { prompt: string, audience: Audience, goal: string }
// Auth: cookie de sesión admin (mismo patrón que /admin/seo).
// Devuelve: { ok: true, landing: Landing, html: string }
import type { APIRoute } from 'astro';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { generateLanding } from '@/lib/landing-ai/generate';
import { renderLanding } from '@/lib/landing-ai/render';
import { audienceEnum } from '@/lib/landing-ai/schema';

export const prerender = false;

// Rate limit en memoria del proceso (mismo patrón que /api/chat).
const ipBuckets = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 4; // generación es cara, baja el límite respecto al chat

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipBuckets.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  ipBuckets.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

function clean(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!isAdminLoggedIn(cookies)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'unauthorized' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    );
  }

  const ip = clientAddress || 'unknown';
  if (rateLimited(ip)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'rate_limited' }),
      { status: 429, headers: { 'content-type': 'application/json' } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'invalid_json' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const b = body as Record<string, unknown>;
  const prompt = clean(b.prompt, 1500);
  const goal = clean(b.goal, 80);
  const audienceParsed = audienceEnum.safeParse(b.audience);

  if (prompt.length < 10) {
    return new Response(
      JSON.stringify({ ok: false, error: 'prompt_too_short' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
  if (goal.length < 3) {
    return new Response(
      JSON.stringify({ ok: false, error: 'goal_too_short' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
  if (!audienceParsed.success) {
    return new Response(
      JSON.stringify({ ok: false, error: 'invalid_audience' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  try {
    const landing = await generateLanding({
      prompt,
      audience: audienceParsed.data,
      goal,
    });
    const html = renderLanding(landing);
    return new Response(
      JSON.stringify({ ok: true, landing, html }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error';
    console.error('[landing-generate]', msg);
    return new Response(
      JSON.stringify({ ok: false, error: 'generation_failed', detail: msg }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }
};
