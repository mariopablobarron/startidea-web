/**
 * POST /api/memorias/aprobar — revisión humana: Startidea aprueba y entrega.
 * Solo admin (cookie de sesión del panel o cabecera x-admin-token).
 * Body: { id, notas? }. Pasa de `revision` a `entregado` y envía el email
 * al cliente con el enlace a su documento.
 */

import type { APIRoute } from 'astro';
import { isAdminLoggedIn, isValidAdminHeader } from '@/lib/admin-session';
import { getPedido, markEntregado } from '@/lib/memorias-db';
import { MEMORIA_TIPOS } from '@/lib/memorias-engine';
import { sendEmail } from '@/lib/email-resend';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const header = request.headers.get('x-admin-token') ?? '';
  if (!isAdminLoggedIn(cookies) && !isValidAdminHeader(header)) return json({ ok: false, error: 'unauthorized' }, 401);

  let body: { id?: string; notas?: string };
  try {
    body = (await request.json()) as { id?: string; notas?: string };
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  const id = (body.id ?? '').trim();
  const pedido = id ? getPedido(id) : null;
  if (!pedido) return json({ ok: false, error: 'not_found' }, 404);
  const notas = typeof body.notas === 'string' ? body.notas.trim().slice(0, 2000) || null : null;
  if (!markEntregado(pedido.id, notas)) return json({ ok: false, error: 'not_in_revision', status: pedido.status }, 409);

  const def = MEMORIA_TIPOS[pedido.tipo];
  const manageUrl = `${url.origin}/memorias/pedido?t=${encodeURIComponent(pedido.manage_token)}`;
  await sendEmail({
    to: pedido.email,
    subject: `Tu documento está listo · ${def.nombre} · ${pedido.org_nombre}`,
    html: `<div style="font-family:Georgia,serif;color:#1f1f22;max-width:600px">
<p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#888">— Startidea · Generador de memorias</p>
<h1 style="font-size:22px">Hola, ${esc(pedido.representante.split(' ')[0] || '')}. Tu documento está listo.</h1>
<p>Hemos revisado <strong>${esc(def.nombre)}</strong> de <strong>${esc(pedido.org_nombre)}</strong>. Puedes leerlo, copiarlo o imprimirlo en PDF desde tu pedido. Los campos marcados como [COMPLETAR] son datos que no estaban en tu carga: revísalos antes de presentar.</p>
${notas ? `<p style="background:#fffbeb;border:1px solid #fbbf24;padding:12px 16px"><strong>Notas de la revisión:</strong> ${esc(notas)}</p>` : ''}
<p><a href="${manageUrl}" style="display:inline-block;background:#e6356b;color:#fff;text-decoration:none;padding:12px 24px;font-family:monospace;font-size:13px">Abrir mi documento →</a></p>
<p style="font-size:12px;color:#999">Pedido ${esc(pedido.id)} · Startidea · CIF B19583632 · Granada</p></div>`,
    replyTo: 'hola@startidea.es',
  }).catch(() => {});

  return json({ ok: true, status: 'entregado' });
};
