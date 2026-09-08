/**
 * POST /api/memorias/generar — redacta el documento completo de un pedido pagado.
 * Body: { token }. Solo con status pagado (o error, para reintentar). Deja el
 * pedido en `revision` y avisa a Startidea; no lo entrega solo.
 */

import type { APIRoute } from 'astro';
import { claimRedactando, getPedidoByToken, setDocumento, setError, setGuion } from '@/lib/memorias-db';
import { MEMORIA_TIPOS, generarDocumento, generarGuion, type Guion, type MemoriaCarga } from '@/lib/memorias-engine';
import { sendTelegram } from '@/lib/telegram';
import { sendOwnerLeadEmail } from '@/lib/email-resend';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const POST: APIRoute = async ({ request, url }) => {
  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  const token = (body.token ?? '').trim();
  const pedido = token ? getPedidoByToken(token) : null;
  if (!pedido) return json({ ok: false, error: 'invalid_token' }, 404);
  if (!pedido.paid_at) return json({ ok: false, error: 'not_paid' }, 402);
  if (!claimRedactando(pedido.id)) return json({ ok: false, error: 'not_ready', status: pedido.status }, 409);

  const carga = JSON.parse(pedido.carga_json) as MemoriaCarga;
  try {
    let guion: Guion | null = pedido.guion_json ? (JSON.parse(pedido.guion_json) as Guion) : null;
    if (!guion) {
      guion = await generarGuion(carga);
      setGuion(pedido.id, guion);
    }
    const { documento, avisos } = await generarDocumento(carga, guion);
    setDocumento(pedido.id, documento, avisos);

    const def = MEMORIA_TIPOS[pedido.tipo];
    const adminUrl = `${url.origin}/memorias/pedido?t=${encodeURIComponent(token)}`;
    sendTelegram(
      `<b>📝 Documento listo para revisión</b>\n${esc(def.nombre)} · ${esc(pedido.org_nombre)} · ${esc(pedido.id)}\n${avisos.length ? `⚠️ ${avisos.length} cifras sin respaldo: ${esc(avisos.slice(0, 5).join(', '))}` : 'Todas las cifras respaldadas'}\n${adminUrl}`,
    ).catch(() => {});
    sendOwnerLeadEmail({
      subject: `Revisar documento · ${def.nombre} · ${pedido.org_nombre}`,
      leadName: pedido.representante || pedido.org_nombre,
      leadEmail: pedido.email,
      bodyHtml: `<p><strong>${esc(def.nombre)}</strong> · ${esc(pedido.org_nombre)} · pedido ${esc(pedido.id)}</p>
<p>${avisos.length ? `Cifras sin respaldo en lo cargado: ${esc(avisos.join(', '))}` : 'Todas las cifras están respaldadas por la carga.'}</p>
<p><a href="${adminUrl}">Leer y aprobar →</a> (aprobar con POST /api/memorias/aprobar como admin)</p>`,
    }).catch(() => {});

    return json({ ok: true, status: 'revision', avisos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setError(pedido.id, msg);
    sendTelegram(`<b>❌ Generador de memorias</b> · ${esc(pedido.id)} · ${esc(msg)}`).catch(() => {});
    return json({ ok: false, error: 'generation_failed', detail: msg }, 502);
  }
};
