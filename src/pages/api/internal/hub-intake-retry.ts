import type { APIRoute } from 'astro';
import { createHash, timingSafeEqual } from 'node:crypto';
import { retryPendingHubIntake } from '@/lib/hub-intake-outbox';

export const prerender = false;

function authorized(request: Request, secret: string): boolean {
  const supplied = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const left = createHash('sha256').update(supplied).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

export const POST: APIRoute = async ({ request }) => {
  const secret = process.env.HUB_INTAKE_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return new Response(JSON.stringify({ ok: false, error: 'config' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!authorized(request, secret)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? 50);
  const result = await retryPendingHubIntake(limit);
  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
