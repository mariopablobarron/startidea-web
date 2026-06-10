/**
 * POST /api/status-expediente
 * Cambia el estado de un expediente. Solo ADMIN_TOKEN.
 * Envía email de notificación al cliente con el nuevo estado.
 */

import type { APIRoute } from 'astro';
import { updateStatus, getExpediente } from '@/lib/expedientes-db';
import type { ExpedienteStatus } from '@/lib/expedientes-db';
import { isValidAdminHeader, isAdminLoggedIn } from '@/lib/admin-session';
import { sendEmail } from '@/lib/email-resend';

export const prerender = false;

const VALID_STATUSES: ExpedienteStatus[] = [
  'recibido', 'analizando_ia', 'docs_listos', 'entregado', 'presentado', 'rechazado',
];

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

interface StatusInfo {
  emoji:   string;
  subject: string;
  title:   string;
  body:    string;
  cta?:    string;
  ctaUrl?: string;
}

function getStatusInfo(status: ExpedienteStatus, expId: string, orgNombre: string): StatusInfo | null {
  const org = esc(orgNombre);
  const portalUrl = `https://startidea.es/portal`;

  switch (status) {
    case 'analizando_ia':
      return {
        emoji:   '🤖',
        subject: `Tu expediente está siendo analizado — ${expId}`,
        title:   'El equipo de Startidea está trabajando en tu solicitud',
        body:    `Hemos recibido tu solicitud para <strong>${org}</strong> y nuestro sistema de análisis ya está preparando la memoria, el presupuesto y el checklist de documentación.<br><br>Recibirás otro email cuando los documentos estén listos. Normalmente tarda entre unas horas y 24 horas.`,
        cta:     'Ver estado en el portal',
        ctaUrl:  portalUrl,
      };
    case 'docs_listos':
      return {
        emoji:   '📄',
        subject: `Documentos listos para revisar — ${expId}`,
        title:   'Los documentos de tu solicitud están preparados',
        body:    `La memoria justificativa, el presupuesto y el checklist de documentación para <strong>${org}</strong> están listos.<br><br>El equipo de Startidea los revisará contigo antes de la presentación. Accede al portal para ver el estado completo.`,
        cta:     'Ver documentos en el portal',
        ctaUrl:  portalUrl,
      };
    case 'entregado':
      return {
        emoji:   '📬',
        subject: `Documentos enviados a tu email — ${expId}`,
        title:   'Hemos enviado los documentos de tu solicitud',
        body:    `Los documentos generados para <strong>${org}</strong> han sido enviados a tu email y están disponibles en el portal.<br><br>Revisa tu bandeja de entrada. Si tienes dudas sobre algún documento o necesitas hacer ajustes, escríbenos a <a href="mailto:hola@startidea.es" style="color:#e6356b">hola@startidea.es</a>.`,
        cta:     'Ver en el portal',
        ctaUrl:  portalUrl,
      };
    case 'presentado':
      return {
        emoji:   '✅',
        subject: `Solicitud presentada ante el organismo — ${expId}`,
        title:   '¡Tu solicitud ha sido presentada!',
        body:    `La solicitud de <strong>${org}</strong> ha sido presentada correctamente ante el organismo convocante.<br><br>A partir de ahora entramos en la fase de espera de resolución. Te notificaremos en cuanto haya novedades. El plazo habitual de resolución depende de cada convocatoria.`,
        cta:     'Seguimiento en el portal',
        ctaUrl:  portalUrl,
      };
    case 'rechazado':
      return {
        emoji:   '📋',
        subject: `Resolución de tu solicitud — ${expId}`,
        title:   'Tu solicitud no ha sido concedida en esta convocatoria',
        body:    `Lamentamos informarte de que la solicitud de <strong>${org}</strong> no ha sido seleccionada en esta convocatoria.<br><br>Recuerda que el servicio es a comisión de éxito: <strong>no hay ningún coste</strong> para ti.<br><br>El equipo de Startidea puede ayudarte a identificar otras convocatorias adecuadas para tu organización. Escríbenos cuando quieras.`,
        cta:     'Contactar con Startidea',
        ctaUrl:  'mailto:hola@startidea.es',
      };
    default:
      return null; // 'recibido' no genera notificación
  }
}

function buildEmail(info: StatusInfo, expId: string): string {
  const ctaBlock = info.cta && info.ctaUrl ? `
  <a href="${esc(info.ctaUrl)}"
     style="display:inline-block;background:#e6356b;color:#fff;text-decoration:none;
     padding:12px 28px;font-family:monospace;font-size:12px;font-weight:700;
     letter-spacing:0.05em;margin:16px 0 24px">
    ${esc(info.cta)} →
  </a>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">

  <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 20px">
    — Startidea · Copiloto de Subvenciones
  </p>

  <div style="font-size:32px;margin-bottom:12px">${info.emoji}</div>

  <h1 style="font-size:20px;font-weight:700;margin:0 0 14px;color:#1f1f22;line-height:1.25">
    ${esc(info.title)}
  </h1>

  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 16px">
    ${info.body}
  </p>

  ${ctaBlock}

  <div style="background:#ffffff;border:1px solid #e5e7eb;padding:12px 16px;margin:8px 0 24px;font-family:monospace;font-size:11px;color:#888">
    Expediente: <strong>${esc(expId)}</strong>
  </div>

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#aaa;margin:0 0 4px">
    ¿Tienes preguntas? Escríbenos a <a href="mailto:hola@startidea.es" style="color:#e6356b;text-decoration:none">hola@startidea.es</a>
  </p>
  <p style="font-size:11px;color:#bbb;margin:0">
    Startidea Consulting, S.L. · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada
  </p>

</div>
</body></html>`;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isAdminLoggedIn(cookies) && !isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: { id?: string; status?: string };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { id, status } = body;
  if (!id || !status) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), { status: 400 });
  }
  if (!VALID_STATUSES.includes(status as ExpedienteStatus)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_status' }), { status: 400 });
  }

  const exp = getExpediente(id);
  if (!exp) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
  }

  updateStatus(id, status as ExpedienteStatus);

  // Notificación por email al cliente (fire & forget)
  const info = getStatusInfo(status as ExpedienteStatus, id, exp.org_nombre);
  if (info && exp.email) {
    sendEmail({
      to:      exp.email,
      subject: info.subject,
      html:    buildEmail(info, id),
    }).catch(console.error);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
