/**
 * POST /api/generar-expediente
 *
 * Agente IA que genera la documentación de una solicitud de subvención.
 * Solo accesible por Mario (ADMIN_TOKEN header).
 *
 * Body JSON: { id: string }
 *
 * Flujo:
 *  1. Lee el expediente de SQLite
 *  2. Obtiene los datos de la convocatoria del HUB (bases, descripción)
 *  3. Llama a OpenRouter (Claude Haiku) con el contexto completo
 *  4. Parsea los 4 documentos generados
 *  5. Guarda en SQLite (ai_memoria, ai_presupuesto, ai_checklist, ai_guia)
 *  6. Actualiza status → docs_listos
 *  7. Email automático al cliente: "documentos en revisión" + enlace portal
 *  8. Notifica a Mario por Telegram
 */

import type { APIRoute } from 'astro';
import { getExpediente, saveAiOutput, updateStatus } from '@/lib/expedientes-db';
import { isValidAdminHeader, isAdminLoggedIn } from '@/lib/admin-session';
import { buildConvContext, runAiGeneration } from '@/lib/copiloto-engine';
import { extractDocsFromExpediente, formatExtractedDocsForPrompt } from '@/lib/doc-extractor';
import { sendEmail } from '@/lib/email-resend';
import { notifyError } from '@/lib/notify-error';
import { join } from 'node:path';
import { sendTelegram } from '@/lib/telegram';

export const prerender = false;


export const POST: APIRoute = async ({ request, cookies }) => {
  // Auth: el panel envía sha256(ADMIN_TOKEN) como cookie → header x-admin-token
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isAdminLoggedIn(cookies) && !isValidAdminHeader(reqToken)) {
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

  // Marcar como "analizando" — salvo que el expediente ya esté 'entregado' o
  // 'presentado': regenerar docs sobre esos estados no debe regresarlos.
  const statusPrevio = exp.status;
  const statusFinal = statusPrevio === 'entregado' || statusPrevio === 'presentado';
  if (!statusFinal) updateStatus(id, 'analizando_ia');

  // Todo lo que sigue puede lanzar (extracción de docs, IA, email). Sin este
  // try/catch, una excepción dejaba el expediente atascado en 'analizando_ia'
  // para siempre y devolvía la página HTML de error de Astro en vez de JSON.
  try {

  // Construir contexto de convocatoria
  const { context: convContext } = await buildConvContext({
    convocatoria_slug: exp.convocatoria_slug,
    convocatoria_title: exp.convocatoria_title,
    convocatoria_url: exp.convocatoria_url,
  });

  // Extraer texto de los documentos subidos por el cliente (si existen)
  const expedientesDir = process.env.EXPEDIENTES_DIR ?? '/data/expedientes';
  const expedienteDir = join(expedientesDir, `${id}-${exp.org_cif}`);
  const docsExtraction = await extractDocsFromExpediente(expedienteDir);
  const docsContext = formatExtractedDocsForPrompt(docsExtraction);
  if (docsExtraction.docs.length > 0) {
    console.log(`[generar-expediente] Documentos extraídos: ${docsExtraction.docs.length} ficheros, ${docsExtraction.totalChars} chars`);
  }

  const gen = await runAiGeneration(exp, convContext, docsContext || undefined);

  if (!gen.ok) {
    if (!statusFinal) updateStatus(id, statusPrevio);
    // La generación falló para un expediente real — Mario debe enterarse
    // (el cliente probablemente ya está esperando los documentos)
    await notifyError({
      component: 'generar-expediente',
      severity:  'error',
      message:   `Generación IA falló para expediente ${id}. Cliente ${exp.org_nombre} (${exp.email}) puede haber visto error en el portal.`,
      context:   {
        expediente_id:    id,
        org_nombre:       exp.org_nombre,
        email:            exp.email,
        convocatoria:     exp.convocatoria_title ?? exp.convocatoria_slug ?? 'sin identificar',
        ai_error:         gen.error,
      },
    });
    return new Response(
      JSON.stringify({ ok: false, error: gen.error ?? 'generation_failed' }),
      { status: 502 },
    );
  }

  const { memoria, presupuesto, checklist, guia, elegibilidad, datosFaltantes } = gen;

  // Guardar en BD (incluye análisis de elegibilidad)
  saveAiOutput(id, {
    memoria, presupuesto, checklist, guia,
    elegibilidad: elegibilidad?.raw,
    datosFaltantes,
  });

  // ── Notificación automática al cliente — "Documentos en revisión" ──────────
  // Email ligero: no incluye los documentos (eso lo hace entregar-expediente).
  // Comunica que la IA ha terminado y el equipo los revisa antes de enviarlos.
  // El enlace lleva al portal donde pueden ver el estado y pedir nuevo acceso.
  const primerNombre = exp.representante.split(' ')[0];
  const convName = exp.convocatoria_title ?? 'la convocatoria solicitada';
  try {
    await sendEmail({
      to: exp.email,
      replyTo: 'hola@startidea.es',
      subject: `[${id}] Documentos en revisión — Startidea`,
      html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#ffffff;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:32px 24px">
  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">— Startidea · Copiloto de Subvenciones</p>
  <h1 style="font-size:22px;font-weight:700;line-height:1.3;margin:0 0 16px;color:#1f1f22">
    Hola, ${primerNombre}. La IA ya ha analizado tu solicitud.
  </h1>
  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 20px">
    La IA de Startidea ha preparado un borrador de la documentación para
    <strong>${convName}</strong> (expediente <span style="font-family:monospace;font-size:13px;background:#f3f4f6;padding:2px 6px">${id}</span>).
  </p>
  <div style="border-left:3px solid #e6356b;padding:12px 20px;background:#fff7f8;margin:20px 0;font-size:14px;color:#333">
    <strong>¿Qué pasa ahora?</strong>
    <ol style="margin:8px 0;padding-left:20px;line-height:1.9">
      <li>El equipo de Startidea revisa y completa los documentos generados.</li>
      <li>En unas horas recibirás <strong>otro email</strong> con los documentos finales listos para presentar.</li>
      <li>Cualquier duda mientras tanto: <a href="mailto:hola@startidea.es" style="color:#e6356b">hola@startidea.es</a></li>
    </ol>
  </div>
  <p style="font-size:14px;color:#555;margin:20px 0">
    También puedes consultar el estado en tiempo real en tu portal de cliente:
  </p>
  <a href="https://startidea.es/portal"
     style="display:inline-block;background:#e6356b;color:#fff;font-family:monospace;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;padding:12px 24px;margin:4px 0 20px">
    Acceder al portal →
  </a>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
  <p style="font-size:13px;color:#888;line-height:1.6">
    Un saludo,<br>
    <strong>Equipo Startidea</strong><br>
    <a href="https://startidea.es" style="color:#e6356b">startidea.es</a>
  </p>
  <p style="font-size:11px;color:#bbb;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px">
    Startidea · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada
  </p>
</div>
</body>
</html>`,
    });
  } catch (emailErr) {
    // No bloqueamos el flujo — Telegram ya avisa a Mario
    console.error('[generar-expediente] Email cliente error:', emailErr);
  }

  // Notificar a Mario por Telegram
  {
    const elegIcon = elegibilidad?.bloqueante ? '🔴 BLOQUEANTE' : elegibilidad ? `🟢 ${elegibilidad.score}/100` : '❓';
    const tgText = `✅ <b>Documentos generados</b>\n\n` +
      `<b>Expediente:</b> <code>${id}</code>\n` +
      `<b>Entidad:</b> ${exp.org_nombre}\n` +
      `<b>Convocatoria:</b> ${exp.convocatoria_title || 'Sin identificar'}\n` +
      `<b>Elegibilidad:</b> ${elegIcon}\n\n` +
      `Memoria: ${memoria ? '✅' : '❌'} | Presupuesto: ${presupuesto ? '✅' : '❌'} | Checklist: ${checklist ? '✅' : '❌'} | Guía: ${guia ? '✅' : '❌'}\n\n` +
      `Panel: https://startidea.es/admin/expedientes/${id}`;
    void sendTelegram(tgText);
  }

  // Aviso a Mario por email (además del Telegram).
  {
    const elegTxt = elegibilidad?.bloqueante ? '🔴 BLOQUEANTE' : elegibilidad ? `🟢 ${elegibilidad.score}/100` : '❓ sin determinar';
    sendEmail({
      to: 'hola@startidea.es',
      replyTo: 'hola@startidea.es',
      subject: `✅ Documentos IA generados — ${exp.org_nombre} [${id}]`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:560px">
        <p>La IA ha generado los documentos del expediente <strong>${id}</strong>.</p>
        <ul>
          <li><strong>Entidad:</strong> ${exp.org_nombre}</li>
          <li><strong>Convocatoria:</strong> ${exp.convocatoria_title || 'sin identificar'}</li>
          <li><strong>Elegibilidad:</strong> ${elegTxt}</li>
          <li>Memoria ${memoria ? '✅' : '❌'} · Presupuesto ${presupuesto ? '✅' : '❌'} · Checklist ${checklist ? '✅' : '❌'} · Guía ${guia ? '✅' : '❌'}</li>
        </ul>
        <p><a href="https://startidea.es/admin/expedientes/${id}">Abrir en el panel →</a></p>
      </div>`,
    }).catch((err) => console.error('[generar-expediente] Email Mario error:', err));
  }

  return new Response(JSON.stringify({
    ok: true,
    id,
    sections: {
      memoria: memoria.length,
      presupuesto: presupuesto.length,
      checklist: checklist.length,
      guia: guia.length,
    },
  }), { status: 200 });

  } catch (err) {
    // Resetear estado para que el admin pueda reintentar; contrato JSON estable.
    console.error('[generar-expediente] Excepción no controlada:', err);
    try { if (!statusFinal) updateStatus(id, statusPrevio); } catch {}
    return new Response(
      JSON.stringify({ ok: false, error: 'internal', detail: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
};
