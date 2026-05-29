/**
 * GET /api/auto-copiloto/confirm?token=TOKEN
 *
 * Confirma un perfil de Copiloto Autónomo por email.
 * Devuelve HTML directamente para que el usuario vea una página de éxito.
 */

import type { APIRoute } from 'astro';
import { confirmProfile } from '@/lib/auto-copiloto-db';
import { sendEmail } from '@/lib/email-resend';
import { sendTelegram } from '@/lib/telegram';

export const prerender = false;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token') ?? '';

  if (!token) {
    return htmlPage('Token inválido', `
      <p>El enlace de confirmación no contiene un token válido.</p>
      <p><a href="/subvenciones/auto-copiloto" style="color:#e6356b">Registrarse de nuevo →</a></p>
    `, 400);
  }

  const profile = confirmProfile(token);

  if (!profile) {
    return htmlPage('Enlace caducado o ya utilizado', `
      <p>Este enlace de confirmación ya fue usado o ha caducado.</p>
      <p>Si tu Copiloto ya está activo, no necesitas hacer nada más.</p>
      <p><a href="/subvenciones" style="color:#e6356b">Ver buscador de subvenciones →</a></p>
    `, 400);
  }

  // Email de bienvenida al activar
  const manageUrl = `https://startidea.es/subvenciones/mi-copiloto?t=${profile.manage_token}`;
  const htmlEmail = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:32px 24px">
  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Copiloto Autónomo
  </p>
  <h1 style="font-size:22px;font-weight:700;margin:0 0 16px">
    ¡Copiloto activado para ${esc(profile.org_nombre)}!
  </h1>
  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px">
    A partir de ahora, cada vez que el BDNS publique una nueva convocatoria que
    encaje con el perfil de <strong>${esc(profile.org_nombre)}</strong>, Startidea
    generará automáticamente la documentación preliminar y te la enviará por email.
  </p>
  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 24px">
    Los documentos incluirán memoria técnica, presupuesto orientativo, checklist
    de documentación y guía de presentación. Solo tendrás que revisar, completar
    los campos marcados con [COMPLETAR], y presentarlo con tu certificado digital.
  </p>
  <p style="font-size:13px;color:#888;margin:0 0 8px">
    Puedes pausar o cancelar el Copiloto en cualquier momento:
  </p>
  <a href="${manageUrl}" style="color:#e6356b;font-size:13px">Gestionar mi Copiloto →</a>
  <hr style="border:none;border-top:1px solid #e0ddd8;margin:32px 0">
  <p style="font-size:13px;color:#888">
    Startidea · <a href="https://startidea.es" style="color:#e6356b">startidea.es</a>
  </p>
</div>
</body>
</html>`;

  await sendEmail({
    to: profile.email,
    subject: `Copiloto activado — Startidea te avisa cuando encaje algo para ${profile.org_nombre}`,
    html: htmlEmail,
    replyTo: 'hola@startidea.es',
  }).catch(console.error);

  // Telegram
  void sendTelegram(`✅ <b>Copiloto Autónomo activado</b>\n\n<b>Org:</b> ${profile.org_nombre}\n<b>Email:</b> ${profile.email}\n<b>Tipo:</b> ${profile.org_tipo}\n<b>Territorio:</b> ${profile.ccaa || 'nacional'}`);

  return htmlPage(
    '¡Copiloto activado!',
    `
      <p style="font-size:16px;line-height:1.6;color:#444;margin:0 0 16px">
        El Copiloto de Subvenciones para <strong>${esc(profile.org_nombre)}</strong> está activo.
      </p>
      <p style="font-size:15px;line-height:1.6;color:#666;margin:0 0 24px">
        Recibirás un email con documentos preliminares cada vez que aparezca una convocatoria
        que encaje con tu organización. Sin que tengas que hacer nada.
      </p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px">
        <a href="/subvenciones" style="background:#e6356b;color:#fff;padding:12px 24px;text-decoration:none;font-family:monospace;font-size:12px;letter-spacing:0.05em;font-weight:600">
          Ver convocatorias abiertas →
        </a>
        <a href="${manageUrl}" style="background:transparent;color:#1f1f22;padding:12px 24px;text-decoration:none;font-family:monospace;font-size:12px;letter-spacing:0.05em;font-weight:600;border:2px solid #1f1f22">
          Gestionar mi Copiloto
        </a>
      </div>
    `,
    200,
  );
};

function htmlPage(title: string, body: string, status: number): Response {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · Startidea</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, serif; color: #1f1f22; background: #f9fafb; margin: 0; padding: 48px 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border: 2px solid #e5e7eb; padding: 40px; }
    .label { font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin: 0 0 20px; }
    h1 { font-size: 28px; font-weight: 700; margin: 0 0 24px; line-height: 1.2; }
    a { color: #e6356b; }
  </style>
</head>
<body>
  <div class="card">
    <p class="label">— Startidea · Copiloto Autónomo</p>
    <h1>${esc(title)}</h1>
    ${body}
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
