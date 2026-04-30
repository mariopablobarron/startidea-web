/**
 * Helper de auth admin reutilizable.
 * Mismo modelo que /admin/knowledge: cookie httpOnly o ?token= en query.
 */
import type { APIContext } from 'astro';

export function isAdmin(context: APIContext): boolean {
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected) return false;
  const tokenParam = new URL(context.request.url).searchParams.get('token') || '';
  const cookieToken = context.cookies.get('startidea_admin')?.value || '';
  return tokenParam === expected || cookieToken === expected;
}

export function requireAdmin(context: APIContext): Response | null {
  if (!isAdmin(context)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return null;
}
