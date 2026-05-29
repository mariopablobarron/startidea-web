/**
 * POST /api/enviar-contrato
 *
 * Genera un token único para el contrato, lo guarda en BD y envía
 * el email con el enlace de aceptación al cliente.
 * Solo accesible con ADMIN_TOKEN.
 */

import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { getExpediente, setContratoToken } from '@/lib/expedientes-db';
import { sendEmail } from '@/lib/email-resend';
import { isValidAdminHeader } from '@/lib/admin-session';
import { generarEmailContratoHtml, type ContratoData } from '@/lib/contrato-generator';
import { getEnv } from '@/lib/env';

export const prerender = false;


export const POST: APIRoute = async ({ request }) => {
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
  }

  const exp = getExpediente(id);
  if (!exp) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
  }

  // Generar token único (32 hex chars)
  const token = randomUUID().replace(/-/g, '');
  setContratoToken(id, token);

  const contratoData: ContratoData = {
    expedienteId:      exp.id,
    convocatoriaTitle: exp.convocatoria_title,
    orgNombre:         exp.org_nombre,
    orgCif:            exp.org_cif,
    orgTipo:           exp.org_tipo,
    representante:     exp.representante,
    email:             exp.email,
    telefono:          exp.telefono,
    provincia:         exp.provincia,
    importeSolicitado: exp.importe_solicitado,
    contratoToken:     token,
    createdAt:         Math.floor(Date.now() / 1000),
  };

  const emailHtml = generarEmailContratoHtml(contratoData);

  try {
    await sendEmail({
      to: exp.email,
      replyTo: 'hola@startidea.es',
      subject: `Contrato de prestación de servicios — Startidea · Exp. ${exp.id}`,
      html: emailHtml,
    });
  } catch (err) {
    console.error('[enviar-contrato] Email error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'email_failed' }), { status: 500 });
  }

  // Notificar a Mario por Telegram
  const tgToken = getEnv('TELEGRAM_BOT_TOKEN');
  const tgChat  = getEnv('TELEGRAM_CHAT_ID');
  if (tgToken && tgChat) {
    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id:    tgChat,
        text:       `📝 <b>Contrato enviado al cliente</b>\n\n<b>Expediente:</b> <code>${id}</code>\n<b>Cliente:</b> ${exp.org_nombre}\n<b>Email:</b> ${exp.email}\n<b>Convocatoria:</b> ${exp.convocatoria_title ?? '—'}`,
        parse_mode: 'HTML',
      }),
    }).catch(console.error);
  }

  return new Response(JSON.stringify({ ok: true, token }), { status: 200 });
};
