/**
 * POST /api/auto-copiloto/deadline-reminders
 *
 * Envía recordatorios de plazo a organizaciones que tienen una convocatoria
 * con fecha límite en los próximos 7 o 2 días y aún no han recibido ese aviso.
 *
 * Solo accesible con ADMIN_TOKEN (mismo mecanismo que el resto de endpoints admin).
 *
 * Cron sugerido en VPS (crontab -e):
 *   0 9 * * * /usr/local/bin/deadline-reminders-cron.sh >> /var/log/deadline-reminders.log 2>&1
 */

import type { APIRoute } from 'astro';
import { isValidAdminHeader } from '@/lib/admin-session';
import { getPendingReminders, markReminded } from '@/lib/auto-copiloto-db';
import { sendEmail } from '@/lib/email-resend';
import { sendTelegram } from '@/lib/telegram';

export const prerender = false;


function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function buildReminderEmail(opts: {
  org_nombre: string;
  representante: string;
  convocatoria_title: string;
  expediente_id: string | null;
  deadline: string;
  daysAhead: 7 | 2;
  manage_token: string;
}): string {
  const primerNombre = opts.representante.split(' ')[0];
  const urgency = opts.daysAhead === 2
    ? '⚠️ <strong>Solo quedan 2 días</strong>'
    : '📅 Quedan 7 días';
  const manageUrl = `https://startidea.es/subvenciones/mi-copiloto?t=${opts.manage_token}`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:32px 24px">
  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Copiloto Autónomo
  </p>
  <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;line-height:1.2">
    ${urgency} para presentar.
  </h1>
  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 8px">
    Hola, ${esc(primerNombre)}. El plazo de presentación de la convocatoria
    <strong>${esc(opts.convocatoria_title)}</strong> vence el <strong>${opts.deadline}</strong>.
  </p>
  ${opts.expediente_id ? `
  <p style="font-size:14px;color:#666;margin:8px 0 24px">
    El Copiloto generó la documentación preliminar en el expediente
    <code style="font-family:monospace;background:#f3f4f6;padding:2px 6px">${esc(opts.expediente_id)}</code>.
    Si no la has recibido o tienes dudas, responde a este email.
  </p>` : ''}
  <div style="background:#fff7f8;border-left:3px solid #e6356b;padding:12px 20px;margin:0 0 24px;font-size:14px;color:#333">
    <strong>Lista de comprobación antes de presentar:</strong>
    <ol style="margin:8px 0;padding-left:20px;line-height:1.9">
      <li>Revisa y completa todos los <strong>[COMPLETAR]</strong> de los documentos</li>
      <li>Reúne el checklist de documentación (certificados AEAT y SS vigentes)</li>
      <li>Verifica que tu certificado digital no ha expirado</li>
      <li>Accede a la sede electrónica del organismo convocante</li>
      <li>Presenta antes de las 14:00h del día del plazo (algunas sedes cierran a mediodía)</li>
    </ol>
  </div>
  <p style="font-size:14px;color:#666;margin:0 0 24px">
    ¿Necesitas ayuda para presentarlo?
    <a href="mailto:hola@startidea.es?subject=Ayuda presentación ${esc(opts.convocatoria_title)}" style="color:#e6356b">
      Escríbenos →
    </a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#bbb">
    Recordatorio automático del Copiloto de Subvenciones de Startidea.
    <a href="${manageUrl}" style="color:#bbb">Gestionar mi Copiloto →</a>
  </p>
</div>
</body>
</html>`;
}

export const POST: APIRoute = async ({ request }) => {
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  const startTime = Date.now();
  let sent7 = 0;
  let sent2 = 0;
  let errors = 0;

  for (const daysAhead of [7, 2] as const) {
    const pending = getPendingReminders(daysAhead);

    for (const entry of pending) {
      try {
        const html = buildReminderEmail({
          org_nombre: entry.org_nombre,
          representante: entry.representante,
          convocatoria_title: entry.convocatoria_title,
          expediente_id: entry.expediente_id,
          deadline: entry.deadline!,
          daysAhead,
          manage_token: entry.manage_token,
        });

        const subject = daysAhead === 2
          ? `⚠️ Solo 2 días: ${entry.convocatoria_title}`
          : `📅 Recordatorio 7 días: ${entry.convocatoria_title}`;

        const ok = await sendEmail({
          to: entry.email,
          subject,
          html,
          replyTo: 'hola@startidea.es',
        });

        if (ok) {
          markReminded(entry.id, daysAhead);
          if (daysAhead === 7) sent7++; else sent2++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error('[deadline-reminders] Error:', err);
        errors++;
      }
    }
  }

  // Telegram si hubo actividad
  if (sent7 + sent2 + errors > 0) {
    void sendTelegram(`📅 <b>Recordatorios de plazo</b>\n\n✅ 7 días: ${sent7}\n✅ 2 días: ${sent2}\n❌ Errores: ${errors}\n⏱ ${Math.round((Date.now() - startTime) / 1000)}s`);
  }

  return new Response(JSON.stringify({
    ok: true,
    sent_7d: sent7,
    sent_2d: sent2,
    errors,
    elapsed_s: Math.round((Date.now() - startTime) / 1000),
  }), { status: 200 });
};
