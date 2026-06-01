/**
 * POST /api/admin/mensaje-expediente
 *
 * Envía un mensaje del admin al cliente de un expediente.
 * Guarda en BD y manda email al cliente.
 */
import type { APIRoute } from 'astro';
import {
  getExpediente,
  addExpedienteMessage,
} from '@/lib/expedientes-db';
import { isValidAdminHeader, isAdminLoggedIn } from '@/lib/admin-session';
import { sendEmail } from '@/lib/email-resend';

export const prerender = false;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isAdminLoggedIn(cookies) && !isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: { expId?: string; body?: string };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { expId, body: msgBody } = body;
  if (!expId || !msgBody?.trim()) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), { status: 400 });
  }

  const exp = getExpediente(expId);
  if (!exp) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
  }

  const msg = addExpedienteMessage(expId, 'admin', msgBody.trim());

  // Email al cliente
  const portalUrl = `https://startidea.es/portal`;
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">

  <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 20px">
    — Startidea · Mensaje sobre tu expediente
  </p>

  <div style="font-size:28px;margin-bottom:12px">💬</div>

  <h1 style="font-size:19px;font-weight:700;margin:0 0 12px;color:#1f1f22;line-height:1.3">
    Tienes un mensaje de Startidea
  </h1>

  <p style="font-size:14px;color:#666;margin:0 0 16px">
    Expediente <strong>${esc(expId)}</strong> · ${esc(exp.org_nombre)}
  </p>

  <div style="background:#fff;border:1px solid #e5e7eb;border-left:3px solid #e6356b;padding:16px 20px;margin:0 0 20px;font-size:15px;line-height:1.7;color:#1f1f22;white-space:pre-wrap">
${esc(msgBody.trim())}
  </div>

  <a href="${esc(portalUrl)}"
     style="display:inline-block;background:#e6356b;color:#fff;text-decoration:none;
     padding:12px 28px;font-family:monospace;font-size:12px;font-weight:700;
     letter-spacing:0.05em;margin:0 0 24px">
    Ver en el portal →
  </a>

  <p style="font-size:13px;color:#888;margin:0 0 8px">
    Puedes responder directamente a este email o escribirnos a
    <a href="mailto:hola@startidea.es" style="color:#e6356b;text-decoration:none">hola@startidea.es</a>
  </p>

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:11px;color:#bbb;margin:0">
    Startidea Consulting, S.L. · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada
  </p>

</div>
</body></html>`;

  await sendEmail({
    to:      exp.email,
    subject: `Mensaje de Startidea sobre tu expediente ${expId}`,
    html,
  });

  return new Response(JSON.stringify({ ok: true, msgId: msg.id }), { status: 200 });
};
