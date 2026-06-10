/**
 * POST /api/portal-acceso
 *
 * Crea un magic token para el email indicado y envía el enlace de acceso.
 * Solo funciona si hay al menos un expediente con ese email.
 */
import type { APIRoute } from 'astro';
import {
  emailHasPortalAccess,
  createMagicToken,
} from '@/lib/expedientes-db';
import { sendEmail } from '@/lib/email-resend';

export const prerender = false;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ ok: false, error: 'email_invalid' }), { status: 400 });
  }

  const access = emailHasPortalAccess(email);
  if (!access.registered && !access.hasExpedientes) {
    // Email desconocido — redirigir al registro (no revelar si el email existe o no en logs)
    return new Response(JSON.stringify({ ok: false, needsRegistration: true }), { status: 200 });
  }

  const token = createMagicToken(email);
  const magicUrl = `https://startidea.es/portal/link/${token}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">

  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Portal de clientes
  </p>

  <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;color:#1f1f22">
    Tu enlace de acceso al portal
  </h1>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 24px">
    Haz clic en el botón para acceder a tu panel de expedientes de subvenciones.
    El enlace caduca en <strong>1 hora</strong>.
  </p>

  <a href="${magicUrl}"
     style="display:inline-block;background:#e6356b;color:#fff;text-decoration:none;
     padding:14px 32px;font-family:monospace;font-size:13px;font-weight:700;
     letter-spacing:0.05em;margin:8px 0 24px">
    Acceder a mi portal →
  </a>

  <p style="font-size:12px;color:#888;margin:0 0 8px">
    O copia esta URL en tu navegador:
  </p>
  <p style="font-family:monospace;font-size:11px;color:#aaa;word-break:break-all;margin:0 0 28px">
    ${esc(magicUrl)}
  </p>

  <p style="font-size:12px;color:#aaa">
    Si no solicitaste este acceso, ignora este email.
    Nadie ha entrado en tu cuenta — el enlace no sirve hasta que lo uses.
  </p>

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">

  <p style="font-size:11px;color:#bbb;margin:0">
    Startidea Consulting, S.L. · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada
  </p>
</div>
</body></html>`;

  await sendEmail({
    to: email,
    subject: 'Tu enlace de acceso al portal de Startidea',
    html,
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
