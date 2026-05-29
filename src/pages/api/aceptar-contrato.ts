/**
 * POST /api/aceptar-contrato
 *
 * Registra la aceptación electrónica del contrato por el cliente.
 * Guarda timestamp + IP en la BD, notifica a Mario por Telegram,
 * y envía email de confirmación con resumen del contrato a ambas partes.
 */

import type { APIRoute } from 'astro';
import {
  getExpedienteByContratoToken,
  markContratoAceptado,
} from '@/lib/expedientes-db';
import { STARTIDEA } from '@/lib/contrato-generator';
import { sendEmail } from '@/lib/email-resend';
import { getEnv } from '@/lib/env';

export const prerender = false;


function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
}

function buildConfirmacionEmail(opts: {
  orgNombre:     string;
  representante: string;
  expId:         string;
  convTitle:     string | null;
  aceptadoTs:    number;
  ip:            string;
  contratoUrl:   string;
  forAdmin:      boolean;
}): string {
  const { orgNombre, representante, expId, convTitle, aceptadoTs, ip, contratoUrl, forAdmin } = opts;
  const conv = convTitle ?? 'subvención indicada en el expediente';
  const fecha = fmtTs(aceptadoTs);

  const adminNote = forAdmin ? `
  <div style="background:#fef9c3;border:1px solid #fde047;padding:12px 16px;margin:16px 0;font-size:13px;color:#713f12">
    <strong>Nota interna:</strong> El contrato ha sido aceptado electrónicamente por el cliente.
    IP de aceptación: <code>${esc(ip)}</code> · Puedes generar la factura cuando se conceda la subvención.
  </div>` : '';

  const clientNote = !forAdmin ? `
  <div style="background:#ecfdf5;border:1px solid #6ee7b7;padding:12px 16px;margin:16px 0;font-size:13px;color:#065f46">
    Este email es tu confirmación de aceptación. Guárdalo como justificante del contrato firmado.
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">

  <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 20px">
    — Startidea · Contrato de servicios
  </p>

  <div style="font-size:32px;margin-bottom:12px">✅</div>

  <h1 style="font-size:20px;font-weight:700;margin:0 0 14px;color:#1f1f22;line-height:1.25">
    Contrato aceptado electrónicamente
  </h1>

  ${adminNote}${clientNote}

  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 20px">
    <tr style="border-bottom:1px solid #f0ece4">
      <td style="padding:8px 0;color:#888;width:40%;font-family:monospace;font-size:12px">ORGANIZACIÓN</td>
      <td style="padding:8px 0;font-weight:600">${esc(orgNombre)}</td>
    </tr>
    <tr style="border-bottom:1px solid #f0ece4">
      <td style="padding:8px 0;color:#888;font-family:monospace;font-size:12px">REPRESENTANTE</td>
      <td style="padding:8px 0">${esc(representante)}</td>
    </tr>
    <tr style="border-bottom:1px solid #f0ece4">
      <td style="padding:8px 0;color:#888;font-family:monospace;font-size:12px">EXPEDIENTE</td>
      <td style="padding:8px 0;font-family:monospace;font-size:13px;color:#e6356b;font-weight:700">${esc(expId)}</td>
    </tr>
    <tr style="border-bottom:1px solid #f0ece4">
      <td style="padding:8px 0;color:#888;font-family:monospace;font-size:12px">CONVOCATORIA</td>
      <td style="padding:8px 0;font-size:13px">${esc(conv)}</td>
    </tr>
    <tr style="border-bottom:1px solid #f0ece4">
      <td style="padding:8px 0;color:#888;font-family:monospace;font-size:12px">FECHA ACEPTACIÓN</td>
      <td style="padding:8px 0;font-size:13px">${esc(fecha)}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#888;font-family:monospace;font-size:12px">COMISIÓN</td>
      <td style="padding:8px 0;font-weight:600">${STARTIDEA.comisionPct}% sobre el importe concedido · Solo si se concede</td>
    </tr>
  </table>

  <a href="${esc(contratoUrl)}"
     style="display:inline-block;background:#1f1f22;color:#fff;text-decoration:none;
     padding:11px 24px;font-family:monospace;font-size:11px;font-weight:700;
     letter-spacing:0.05em;margin:0 0 24px">
    Ver contrato completo →
  </a>

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">

  <p style="font-size:12px;color:#aaa;line-height:1.6;margin:0 0 4px">
    ${STARTIDEA.razonSocial} · CIF ${STARTIDEA.cif}<br>
    ${STARTIDEA.domicilio} · ${STARTIDEA.cp} ${STARTIDEA.ciudad}<br>
    ${STARTIDEA.registro}
  </p>
  <p style="font-size:11px;color:#bbb;margin:8px 0 0">
    Aceptación registrada conforme al Art. 23 LSSI y Art. 1262 CC.
  </p>

</div>
</body></html>`;
}

export const POST: APIRoute = async ({ request }) => {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { token } = body;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_token' }), { status: 400 });
  }

  const exp = getExpedienteByContratoToken(token);
  if (!exp) {
    return new Response(JSON.stringify({ ok: false, error: 'token_invalid' }), { status: 404 });
  }

  if (exp.contrato_at) {
    return new Response(JSON.stringify({ ok: true, already: true }), { status: 200 });
  }

  // Capturar IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const aceptadoTs = Math.floor(Date.now() / 1000);
  markContratoAceptado(exp.id, ip);

  const contratoUrl = `https://startidea.es/contrato/${token}`;

  const emailOpts = {
    orgNombre:     exp.org_nombre,
    representante: exp.representante,
    expId:         exp.id,
    convTitle:     exp.convocatoria_title,
    aceptadoTs,
    ip,
    contratoUrl,
  };

  // Email al cliente
  sendEmail({
    to:      exp.email,
    subject: `Contrato aceptado — ${exp.id} · Startidea`,
    html:    buildConfirmacionEmail({ ...emailOpts, forAdmin: false }),
  }).catch(console.error);

  // Email a Mario (copia interna)
  const adminEmail = getEnv('ADMIN_EMAIL') || 'hola@startidea.es';
  sendEmail({
    to:      adminEmail,
    subject: `[Admin] Contrato aceptado por ${exp.org_nombre} — ${exp.id}`,
    html:    buildConfirmacionEmail({ ...emailOpts, forAdmin: true }),
  }).catch(console.error);

  // Notificar por Telegram
  const tgToken = getEnv('TELEGRAM_BOT_TOKEN');
  const tgChat  = getEnv('TELEGRAM_CHAT_ID');
  if (tgToken && tgChat) {
    const ts = new Date(aceptadoTs * 1000).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
    });

    // Si la conversión viene del Copiloto Autónomo, destacar el canal
    // (es una conversión "premium del lead magnet", info útil para optimizar funnel)
    const fromCopiloto = exp.como_conocio === 'copiloto-autonomo'
      && (exp.ip ?? '').indexOf('auto-copiloto') === -1;
    const canalBadge = fromCopiloto
      ? `\n\n⚡ <i>CONVERSIÓN DESDE COPILOTO AUTÓNOMO</i> (lead magnet → cliente premium)`
      : '';

    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id:    tgChat,
        text:       `✅ <b>Contrato ACEPTADO</b>\n\n<b>Expediente:</b> <code>${exp.id}</code>\n<b>Cliente:</b> ${exp.org_nombre}\n<b>Representante:</b> ${exp.representante}\n<b>Convocatoria:</b> ${esc(exp.convocatoria_title ?? '—')}\n<b>Fecha:</b> ${ts}\n<b>IP:</b> <code>${ip}</code>${canalBadge}\n\nSe ha enviado confirmación por email a ambas partes.`,
        parse_mode: 'HTML',
      }),
    }).catch(console.error);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
