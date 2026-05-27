/**
 * POST /api/portal-logout
 * Elimina la sesión del portal de clientes.
 */
import type { APIRoute } from 'astro';
import { deletePortalSession } from '@/lib/expedientes-db';

export const prerender = false;

const COOKIE = 'startidea_portal';

export const POST: APIRoute = async ({ cookies }) => {
  const session = cookies.get(COOKIE)?.value;
  if (session) {
    deletePortalSession(session);
    cookies.delete(COOKIE, { path: '/' });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: '/portal' },
  });
};
