import type { AstroCookies } from 'astro';
import { isAdminLoggedIn, isValidAdminHeader } from '@/lib/admin-session';
import { origenCoincide } from '@/lib/knowledge-auth';

export function isForm(request: Request): boolean {
  return /application\/x-www-form-urlencoded|multipart\/form-data/.test(request.headers.get('content-type') || '');
}

export function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export function reply(request: Request, message: string, body: Record<string, unknown>, status = 200): Response {
  return isForm(request) ? new Response(null, { status: 303, headers: { location: `/admin/radar?msg=${encodeURIComponent(message)}`, 'cache-control': 'no-store' } }) : json(body, status);
}

export function authorize(request: Request, cookies: AstroCookies): Response | null {
  const header = isValidAdminHeader(request.headers.get('x-admin-token') || '');
  if (!header && !isAdminLoggedIn(cookies)) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!header && (!request.headers.get('origin') || !origenCoincide(request))) return json({ ok: false, error: 'invalid_origin' }, 403);
  return null;
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (isForm(request)) return Object.fromEntries(await request.formData());
  if (!(request.headers.get('content-type') || '').includes('application/json')) throw new Error('invalid_body');
  const body: unknown = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body');
  return body as Record<string, unknown>;
}
