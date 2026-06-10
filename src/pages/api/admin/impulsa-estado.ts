import type { APIRoute } from 'astro';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { setEstado, ESTADOS_IMPULSA } from '@/lib/impulsa-db';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminLoggedIn(cookies)) {
    return new Response(JSON.stringify({ ok: false, error: 'auth' }), { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'json' }), { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const estado = typeof body.estado === 'string' ? body.estado : '';
  const notas = typeof body.notas === 'string' ? body.notas.slice(0, 2000) : undefined;

  if (!id || !ESTADOS_IMPULSA.includes(estado as any)) {
    return new Response(JSON.stringify({ ok: false, error: 'fields' }), { status: 400 });
  }

  const changed = setEstado(id, estado, notas);
  return new Response(JSON.stringify({ ok: changed }), { status: changed ? 200 : 404 });
};
