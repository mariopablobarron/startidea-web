/**
 * POST /api/auto-copiloto/register
 *
 * Registra un perfil de organización en el Copiloto Autónomo.
 * No requiere auth — cualquiera puede registrarse (igual que crear-alerta).
 * Envía email de confirmación antes de activar.
 */

import type { APIRoute } from 'astro';
import { createProfile, getProfileByEmail } from '@/lib/auto-copiloto-db';
import { sendEmail } from '@/lib/email-resend';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const prerender = false;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

const ORG_TIPOS: Record<string, string> = {
  asociacion: 'Asociación',
  fundacion: 'Fundación',
  cooperativa: 'Cooperativa / Empresa social',
  empresa: 'Empresa con propósito',
  otro: 'Otra entidad',
};

export const POST: APIRoute = async ({ request, url }) => {
  // ── Rate limit por IP: máx 3 registros / hora ───────────────────────────
  // Protege contra spam de creación de perfiles y abuso del email de confirmación.
  const ip = getClientIp(request);
  const rl = rateLimit({ key: ip, bucket: 'auto-copiloto-register', maxHits: 3, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: 'rate_limit', detail: `Demasiados registros. Intenta de nuevo en ${rl.retryAfter} segundos.` }),
      { status: 429, headers: { 'retry-after': String(rl.retryAfter), 'content-type': 'application/json' } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  // Validación básica
  const email = String(body.email ?? '').trim().toLowerCase();
  const org_nombre = String(body.org_nombre ?? '').trim();
  const org_tipo = String(body.org_tipo ?? 'asociacion').trim();
  const org_descripcion = String(body.org_descripcion ?? '').trim();
  const representante = String(body.representante ?? '').trim();

  if (!email || !email.includes('@') || !org_nombre || !org_descripcion || !representante) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Faltan campos obligatorios (email, org_nombre, org_descripcion, representante)' }),
      { status: 400 },
    );
  }
  if (!ORG_TIPOS[org_tipo]) {
    return new Response(JSON.stringify({ ok: false, error: 'org_tipo inválido' }), { status: 400 });
  }
  if (org_descripcion.length < 40) {
    return new Response(
      JSON.stringify({ ok: false, error: 'La descripción de actividades es demasiado corta (mínimo 40 caracteres)' }),
      { status: 400 },
    );
  }

  // ── Prevenir duplicados: si ya hay perfil con ese email, devolver info útil ──
  // No revelamos si está confirmado o no (para no facilitar enumeración),
  // pero sí evitamos crear otro registro al mismo email.
  const existing = getProfileByEmail(email);
  if (existing) {
    const manageUrl = `${url.origin}/subvenciones/mi-copiloto?t=${existing.manage_token}`;
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'email_already_registered',
        detail: `Ya hay un Copiloto registrado con este email. Si lo gestiona tu organización, busca el email de gestión recibido al darse de alta. Si crees que es un error, escribe a hola@startidea.es.`,
        manage_url: manageUrl, // útil para el frontend si quiere mostrar link directo
      }),
      { status: 409 },
    );
  }

  // Crear perfil
  const profile = createProfile({
    email,
    org_nombre,
    org_cif: String(body.org_cif ?? '').trim(),
    org_tipo,
    org_descripcion,
    representante,
    telefono: String(body.telefono ?? '').trim(),
    web: String(body.web ?? '').trim(),
    ccaa: String(body.ccaa ?? '').trim(),
    keywords: String(body.keywords ?? '').trim(),
    finalidades: Array.isArray(body.finalidades) ? (body.finalidades as string[]) : [],
    territorios: Array.isArray(body.territorios)
      ? (body.territorios as string[])
      : ['nacional'],
    importe_min: Number(body.importe_min ?? 0) || 0,
    importe_max: body.importe_max ? Number(body.importe_max) : null,
    auto_generar: body.auto_generar !== false,
    // Campos de contexto extra para mejorar la generación IA
    anos_activos: Number(body.anos_activos ?? 0) || 0,
    beneficiarios_anuales: Number(body.beneficiarios_anuales ?? 0) || 0,
    presupuesto_anual: String(body.presupuesto_anual ?? '').trim(),
    proyectos_anteriores: String(body.proyectos_anteriores ?? '').trim(),
    logros_principales: String(body.logros_principales ?? '').trim(),
  });

  // Email de confirmación
  const confirmUrl = `${url.origin}/api/auto-copiloto/confirm?token=${profile.confirm_token}`;
  const manageUrl = `${url.origin}/subvenciones/mi-copiloto?t=${profile.manage_token}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:32px 24px">

  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Copiloto Autónomo de Subvenciones
  </p>

  <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#1f1f22">
    Confirma el Copiloto para ${esc(org_nombre)}
  </h1>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 20px">
    Hemos registrado el perfil de <strong>${esc(org_nombre)}</strong> para el Copiloto Autónomo de Subvenciones.
    Cada vez que detectemos una convocatoria que encaje con tu organización,
    generaremos automáticamente los documentos preliminares y te los enviaremos por email.
  </p>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 24px">
    Para activarlo, confirma tu email:
  </p>

  <a href="${confirmUrl}"
     style="display:inline-block;background:#e6356b;color:#fff;text-decoration:none;padding:12px 28px;font-family:monospace;font-size:13px;letter-spacing:0.05em;font-weight:600;margin-bottom:24px">
    Activar Copiloto →
  </a>

  <p style="font-size:13px;color:#888;margin:24px 0 8px">
    O copia esta URL en tu navegador:
  </p>
  <p style="font-size:12px;color:#888;word-break:break-all;margin:0 0 32px">
    ${confirmUrl}
  </p>

  <hr style="border:none;border-top:1px solid #e0ddd8;margin:32px 0">

  <p style="font-size:13px;color:#888">
    ¿No reconoces este registro? Ignora este email — el perfil no se activará sin confirmar.
    Para gestionar o cancelar tu Copiloto en cualquier momento:
    <a href="${manageUrl}" style="color:#e6356b">accede aquí</a>.
  </p>

  <p style="font-size:13px;color:#888;margin-top:16px">
    Startidea · <a href="https://startidea.es" style="color:#e6356b">startidea.es</a>
  </p>

</div>
</body>
</html>`;

  const emailOk = await sendEmail({
    to: email,
    subject: `Confirma el Copiloto de Subvenciones para ${org_nombre} — Startidea`,
    html,
    replyTo: 'hola@startidea.es',
  });

  // Telegram a Mario
  const tgToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const tgChat = process.env.TELEGRAM_CHAT_ID ?? '';
  if (tgToken && tgChat) {
    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgChat,
        text: `🤖 <b>Nuevo Copiloto Autónomo registrado</b>\n\n<b>Org:</b> ${org_nombre}\n<b>Email:</b> ${email}\n<b>Tipo:</b> ${ORG_TIPOS[org_tipo] ?? org_tipo}\n<b>Estado:</b> Pendiente de confirmación`,
        parse_mode: 'HTML',
      }),
    }).catch(console.error);
  }

  return new Response(
    JSON.stringify({ ok: true, emailSent: emailOk, id: profile.id }),
    { status: 201 },
  );
};
