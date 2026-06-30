/**
 * POST /api/admin/candidatura-estado
 * Actualiza el estado + notas internas de una candidatura. Solo admin.
 * Form clásico (redirige de vuelta al panel).
 */

import type { APIRoute } from 'astro';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { setEstadoCandidatura, ESTADOS_CANDIDATURA } from '@/lib/candidaturas-db';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAdminLoggedIn(cookies)) {
    return redirect('/admin/login?next=' + encodeURIComponent('/admin/candidaturas'));
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const id = String(form.get('id') ?? '').trim();
  const estado = String(form.get('estado') ?? '').trim();
  const notas = String(form.get('notas') ?? '').trim().slice(0, 1000);

  if (!id || !(ESTADOS_CANDIDATURA as readonly string[]).includes(estado)) {
    return new Response('Parámetros inválidos', { status: 400 });
  }

  try {
    setEstadoCandidatura(id, estado, notas);
  } catch (err) {
    console.error('[candidatura-estado] error:', err);
  }

  return redirect('/admin/candidaturas');
};
