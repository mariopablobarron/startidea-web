/**
 * POST /api/memorias/crear — carga guiada del Generador de memorias.
 * Público, rate-limit 5/h/IP. Valida la carga, genera el GUION con el modelo,
 * guarda el pedido y devuelve el enlace de gestión. Envía el enlace por email
 * y avisa a Startidea por Telegram. No cobra aquí: el pago va en /checkout.
 */

import type { APIRoute } from 'astro';
import { MEMORIA_TIPOS, generarGuion, parseCarga } from '@/lib/memorias-engine';
import { createPedido } from '@/lib/memorias-db';
import { sendEmail } from '@/lib/email-resend';
import { sendTelegram } from '@/lib/telegram';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const POST: APIRoute = async ({ request, url }) => {
  const ip = getClientIp(request);
  const rl = rateLimit({ key: ip, bucket: 'memorias-crear', maxHits: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return json({ ok: false, error: 'rate_limit', detail: 'Demasiadas solicitudes. Inténtalo en una hora.' }, 429);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  const parsed = parseCarga(body);
  if (!parsed.ok) return json({ ok: false, error: 'validation', detail: parsed.error }, 400);
  const carga = parsed.carga;
  const def = MEMORIA_TIPOS[carga.tipo];

  let guion = null;
  try {
    guion = await generarGuion(carga);
  } catch (err) {
    console.error('[memorias/crear] guion:', err instanceof Error ? err.message : err);
  }
  const pedido = createPedido(carga, def.precioEur * 100, guion);
  const manageUrl = `${url.origin}/memorias/pedido?t=${pedido.manage_token}`;

  sendEmail({
    to: carga.email,
    subject: `Tu guion está listo · ${def.nombre} · ${carga.org_nombre}`,
    html: `<div style="font-family:Georgia,serif;color:#1f1f22;max-width:600px">
<p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#888">— Startidea · Generador de memorias</p>
<h1 style="font-size:22px">Hola, ${esc(carga.representante.split(' ')[0])}. ${guion ? 'Tu guion está listo.' : 'Hemos recibido tu carga.'}</h1>
<p>${guion ? `Hemos preparado el guion de <strong>${esc(def.nombre)}</strong> para <strong>${esc(carga.org_nombre)}</strong>: índice, mensajes clave y datos destacados. Revísalo, y si te encaja, completa el pago para que redactemos el documento completo.` : `Estamos preparando el guion de <strong>${esc(def.nombre)}</strong>. Lo verás en tu pedido en unos minutos.`}</p>
<p><a href="${manageUrl}" style="display:inline-block;background:#e6356b;color:#fff;text-decoration:none;padding:12px 24px;font-family:monospace;font-size:13px">Ver mi pedido →</a></p>
<p style="font-size:13px;color:#666">Precio: ${def.precioEur} € (sin IVA). Cada cifra del documento saldrá de lo que has cargado; una persona de Startidea lo revisa antes de entregarlo.</p>
<p style="font-size:12px;color:#999">Pedido ${esc(pedido.id)} · Startidea · CIF B19583632 · Granada</p></div>`,
    replyTo: 'hola@startidea.es',
  }).catch(() => {});

  sendTelegram(
    `<b>📄 Nuevo pedido · Generador de memorias</b>\n${esc(def.nombre)} · ${esc(carga.org_nombre)} · ${esc(carga.email)}\n${guion ? 'Guion generado' : '⚠️ guion NO generado'} · ${def.precioEur} € · ${esc(pedido.id)}`,
  ).catch(() => {});

  return json({ ok: true, id: pedido.id, token: pedido.manage_token, manage_url: manageUrl, guion: Boolean(guion) });
};
