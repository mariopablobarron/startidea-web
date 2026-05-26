/**
 * POST /api/entregar-expediente
 *
 * Envía los documentos generados por IA al cliente por email
 * y actualiza el status a "entregado".
 * Solo accesible con ADMIN_TOKEN.
 */

import type { APIRoute } from 'astro';
import { getExpediente, updateStatus } from '@/lib/expedientes-db';
import { sendEmail } from '@/lib/email-resend';

export const prerender = false;

function getEnv(key: string): string {
  return process.env[key] ?? (import.meta as any).env?.[key] ?? '';
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function mdToHtml(md: string): string {
  return md
    .replace(/^#{1,3} (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:16px 0 6px">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/gs, '<ul style="padding-left:20px;margin:8px 0">$&</ul>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0">')
    .replace(/^(?!<[hul])(.+)$/gm, '<p style="margin:6px 0">$1</p>');
}

export const POST: APIRoute = async ({ request }) => {
  const adminToken = getEnv('ADMIN_TOKEN');
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!adminToken || reqToken !== adminToken) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { id } = body;
  if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });

  const exp = getExpediente(id);
  if (!exp) return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
  if (!exp.ai_memoria) return new Response(JSON.stringify({ ok: false, error: 'no_docs' }), { status: 400 });

  const convName = exp.convocatoria_title ?? 'la convocatoria seleccionada';
  const primerNombre = exp.representante.split(' ')[0];

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Documentos Startidea</title></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#faf8f5;margin:0;padding:0">
<div style="max-width:640px;margin:0 auto;padding:32px 24px">

  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">— Startidea · Copiloto de Subvenciones</p>

  <h1 style="font-size:26px;font-weight:700;line-height:1.2;margin:0 0 16px;color:#1f1f22">
    Hola, ${esc(primerNombre)}. Aquí tienes tus documentos.
  </h1>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 24px">
    Hemos preparado la documentación para <strong>${esc(convName)}</strong>
    a partir de los datos que nos facilitaste (expediente <code style="font-family:monospace;font-size:13px;background:#f0ece4;padding:2px 6px">${esc(id)}</code>).
    Revísala, completa los campos marcados con <strong>[COMPLETAR]</strong> y escríbenos si necesitas ajustes.
  </p>

  <div style="border-left:3px solid #e6356b;padding:12px 20px;background:#fff7f8;margin:24px 0;font-size:14px;color:#333">
    <strong>Próximos pasos:</strong><br>
    1. Revisa y completa los documentos<br>
    2. Sigue la guía de presentación (al final de este email)<br>
    3. Reúne los documentos del checklist<br>
    4. Presenta en la sede electrónica con tu certificado digital<br>
    5. Cuéntanos cuando lo hayas presentado → <a href="mailto:hola@startidea.es" style="color:#e6356b">hola@startidea.es</a>
  </div>

  <!-- MEMORIA TÉCNICA -->
  <div style="background:#fff;border:1px solid #e0ddd8;padding:24px;margin:24px 0">
    <h2 style="font-size:16px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:0 0 16px;font-family:monospace">📄 Memoria técnica</h2>
    ${mdToHtml(exp.ai_memoria!)}
  </div>

  ${exp.ai_presupuesto ? `
  <!-- PRESUPUESTO -->
  <div style="background:#fff;border:1px solid #e0ddd8;padding:24px;margin:24px 0">
    <h2 style="font-size:16px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:0 0 16px;font-family:monospace">💶 Presupuesto</h2>
    ${mdToHtml(exp.ai_presupuesto)}
  </div>` : ''}

  ${exp.ai_checklist ? `
  <!-- CHECKLIST -->
  <div style="background:#fff;border:1px solid #e0ddd8;padding:24px;margin:24px 0">
    <h2 style="font-size:16px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:0 0 16px;font-family:monospace">📋 Documentos necesarios</h2>
    ${mdToHtml(exp.ai_checklist)}
  </div>` : ''}

  ${exp.ai_guia ? `
  <!-- GUÍA -->
  <div style="background:#1f1f22;border:1px solid #333;padding:24px;margin:24px 0;color:#faf8f5">
    <h2 style="font-size:16px;text-transform:uppercase;letter-spacing:0.08em;color:#aaa;margin:0 0 16px;font-family:monospace">🗺️ Cómo presentarlo paso a paso</h2>
    <div style="color:#e0ddd8;font-size:14px;line-height:1.7">${mdToHtml(exp.ai_guia)}</div>
  </div>` : ''}

  <hr style="border:none;border-top:1px solid #e0ddd8;margin:32px 0">

  <p style="font-size:13px;color:#888;line-height:1.6">
    Si tienes dudas o necesitas ajustar algo, responde a este email
    o escríbenos a <a href="mailto:hola@startidea.es" style="color:#e6356b">hola@startidea.es</a>
    indicando el código <strong>${esc(id)}</strong>.
  </p>

  <p style="font-size:13px;color:#888;margin-top:16px">
    Un saludo,<br>
    <strong>Equipo Startidea</strong><br>
    <a href="https://startidea.es" style="color:#e6356b">startidea.es</a>
  </p>

  <p style="font-size:11px;color:#bbb;margin-top:32px;border-top:1px solid #e0ddd8;padding-top:16px">
    Startidea · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada
  </p>
</div>
</body>
</html>`;

  try {
    await sendEmail({
      to: exp.email,
      replyTo: 'hola@startidea.es',
      subject: `[${id}] Tus documentos para ${convName} — Startidea`,
      html,
    });
  } catch (err) {
    console.error('[entregar-expediente] Email error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'email_failed' }), { status: 500 });
  }

  updateStatus(id, 'entregado');

  // Notificar a Mario
  const tgToken = getEnv('TELEGRAM_BOT_TOKEN');
  const tgChat = getEnv('TELEGRAM_CHAT_ID');
  if (tgToken && tgChat) {
    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgChat,
        text: `📬 <b>Docs entregados al cliente</b>\n\n<b>Expediente:</b> <code>${id}</code>\n<b>Cliente:</b> ${exp.org_nombre}\n<b>Email:</b> ${exp.email}\n<b>Convocatoria:</b> ${exp.convocatoria_title ?? '—'}`,
        parse_mode: 'HTML',
      }),
    }).catch(console.error);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
