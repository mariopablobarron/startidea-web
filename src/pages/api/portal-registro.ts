/**
 * POST /api/portal-registro
 *
 * Crea (o actualiza) el perfil del usuario en portal_users,
 * genera un magic token y envía el enlace de acceso por email.
 * Notifica a Mario vía Telegram.
 *
 * Campos: email, nombre, orgNombre, orgCif, orgTipo, telefono,
 *         provincia, comoConocio, consentAt (timestamp Unix)
 */
import type { APIRoute } from 'astro';
import {
  createPortalUser,
  getPortalUser,
  createMagicToken,
} from '@/lib/expedientes-db';
import { sendEmail } from '@/lib/email-resend';
import { getEnv } from '@/lib/env';

export const prerender = false;


function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export const POST: APIRoute = async ({ request }) => {
  let body: {
    email?:       string;
    nombre?:      string;
    orgNombre?:   string;
    orgCif?:      string;
    orgTipo?:     string;
    telefono?:    string;
    provincia?:   string;
    comoConocio?: string;
    consentAt?:   number;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes('@') || !email.includes('.')) {
    return new Response(JSON.stringify({ ok: false, error: 'email_invalid' }), { status: 400 });
  }
  if (!body.nombre?.trim()) {
    return new Response(JSON.stringify({ ok: false, error: 'nombre_required' }), { status: 400 });
  }
  if (!body.orgNombre?.trim()) {
    return new Response(JSON.stringify({ ok: false, error: 'org_required' }), { status: 400 });
  }
  if (!body.orgTipo?.trim()) {
    return new Response(JSON.stringify({ ok: false, error: 'org_tipo_required' }), { status: 400 });
  }

  const esNuevo = !getPortalUser(email);

  // Timestamp de consentimiento: usar el del cliente si es razonable, o el servidor
  const now        = Math.floor(Date.now() / 1000);
  const consentAt  = (typeof body.consentAt === 'number' && body.consentAt > 0)
    ? body.consentAt
    : now;

  createPortalUser({
    email,
    nombre:       body.nombre.trim(),
    org_nombre:   body.orgNombre.trim(),
    org_cif:      body.orgCif?.trim() ?? '',
    org_tipo:     body.orgTipo.trim(),
    telefono:     body.telefono?.trim() ?? '',
    provincia:    body.provincia?.trim() ?? '',
    como_conocio: body.comoConocio?.trim() ?? '',
    consent_at:   consentAt,
  });

  // Generar magic token y enviar email de bienvenida/acceso
  const token    = createMagicToken(email);
  const magicUrl = `https://startidea.es/portal/link/${token}`;
  const primerNombre = body.nombre.trim().split(' ')[0];

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">

  <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Portal de clientes
  </p>

  <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;color:#1f1f22">
    ${esNuevo ? `¡Bienvenido/a, ${esc(primerNombre)}!` : `Hola de nuevo, ${esc(primerNombre)}`}
  </h1>

  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 20px">
    ${esNuevo
      ? `Tu cuenta en el portal de Startidea está lista. Haz clic en el enlace para acceder y gestionar tus proyectos.`
      : `Hemos actualizado tu perfil. Usa el enlace de abajo para acceder al portal.`
    }
  </p>

  <div style="background:#faf8f5;border:1px solid #e0ddd8;padding:16px 18px;margin:0 0 20px">
    <p style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin:0 0 10px">
      Desde el portal puedes
    </p>
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#444;line-height:1.5">🎯 Seguimiento de tus expedientes de subvenciones</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#444;line-height:1.5">✍️ Firma electrónica del contrato de servicios</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#444;line-height:1.5">📄 Documentos generados siempre disponibles</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#444;line-height:1.5">🔔 Estado de resoluciones y facturas</td>
      </tr>
    </table>
  </div>

  <a href="${esc(magicUrl)}"
     style="display:inline-block;background:#e6356b;color:#fff;text-decoration:none;
     padding:14px 32px;font-family:monospace;font-size:13px;font-weight:700;
     letter-spacing:0.05em;margin:0 0 20px">
    Acceder al portal →
  </a>

  <p style="font-size:12px;color:#aaa;margin:0 0 4px">El enlace caduca en 1 hora. Si no funciona, copia esta URL:</p>
  <p style="font-family:monospace;font-size:11px;color:#bbb;word-break:break-all;margin:0 0 28px">
    ${esc(magicUrl)}
  </p>

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">

  <p style="font-size:13px;color:#888;margin:0 0 6px">
    ¿Tienes dudas? Escríbenos a
    <a href="mailto:hola@startidea.es" style="color:#e6356b;text-decoration:none">hola@startidea.es</a>
  </p>
  <p style="font-size:11px;color:#bbb;margin:0">
    Startidea Consulting, S.L. · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada
  </p>

</div>
</body></html>`;

  await sendEmail({
    to: email,
    subject: esNuevo
      ? `Bienvenido/a al portal de Startidea — accede aquí`
      : `Tu acceso al portal de Startidea`,
    html,
  });

  // Notificar a Mario cuando hay un alta nueva
  if (esNuevo) {
    const tgToken = getEnv('TELEGRAM_BOT_TOKEN');
    const tgChat  = getEnv('TELEGRAM_CHAT_ID');
    if (tgToken && tgChat) {
      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id:    tgChat,
          text:       `🆕 <b>Nuevo registro en el portal</b>\n\n<b>Nombre:</b> ${esc(body.nombre!.trim())}\n<b>Organización:</b> ${esc(body.orgNombre!.trim())}\n<b>Email:</b> ${email}\n<b>Tipo:</b> ${body.orgTipo ?? '—'}\n<b>Provincia:</b> ${body.provincia ?? '—'}\n<b>Cómo nos conoció:</b> ${body.comoConocio ?? '—'}`,
          parse_mode: 'HTML',
        }),
      }).catch(console.error);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
