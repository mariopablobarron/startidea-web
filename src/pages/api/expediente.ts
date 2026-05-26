/**
 * POST /api/expediente
 *
 * Recibe el formulario multipart de /subvenciones/presentar/nuevo.
 * Guarda los archivos en el filesystem del servidor (EXPEDIENTES_DIR).
 * Notifica a Mario por Telegram + Resend.
 * Envía email de confirmación al cliente.
 */

import type { APIRoute } from 'astro';
import { sendEmail } from '@/lib/email-resend';
import { insertExpediente } from '@/lib/expedientes-db';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const prerender = false;

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB por archivo

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

function clean(v: FormDataEntryValue | null, max = 500): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? import.meta.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? import.meta.env.TELEGRAM_CHAT_ID;
  const EXPEDIENTES_DIR = process.env.EXPEDIENTES_DIR ?? '/tmp/expedientes';

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'parse' }), { status: 400 });
  }

  // Honeypot anti-spam
  if (clean(formData.get('website'))) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // Campos requeridos
  const orgName = clean(formData.get('orgName'), 200);
  const cif = clean(formData.get('cif'), 20).toUpperCase();
  const orgType = clean(formData.get('orgType'), 50);
  const representante = clean(formData.get('representante'), 120);
  const email = clean(formData.get('email'), 120);
  const telefono = clean(formData.get('telefono'), 30);
  const provincia = clean(formData.get('provincia'), 80);

  const tieneConvocatoria = clean(formData.get('tieneConvocatoria'), 10);
  const convocatoriaUrl = clean(formData.get('convocatoriaUrl'), 500);
  const convocatoriaNombre = clean(formData.get('convocatoriaNombre'), 300);
  const plazo = clean(formData.get('plazo'), 20);
  const importeSolicitado = clean(formData.get('importeSolicitado'), 30);
  const necesidadDesc = clean(formData.get('necesidadDesc'), 1000);
  const importeEstimado = clean(formData.get('importeEstimado'), 30);
  const descripcionProyecto = clean(formData.get('descripcionProyecto'), 2000);
  const experiencia = clean(formData.get('experiencia'), 50);
  const apoderamiento = clean(formData.get('apoderamiento'), 5);
  const comentarios = clean(formData.get('comentarios'), 800);
  const comoConocio = clean(formData.get('comoConocio'), 60);

  if (!orgName || !cif || !representante || !email || !provincia || !descripcionProyecto) {
    return new Response(JSON.stringify({ ok: false, error: 'fields' }), { status: 400 });
  }
  if (!isEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'email' }), { status: 400 });
  }

  // Generar ID único del expediente
  const expedienteId = randomUUID().split('-')[0].toUpperCase();
  const expedienteDir = join(EXPEDIENTES_DIR, `${expedienteId}-${cif}`);

  // Guardar archivos
  const fileFields = ['docMemoria', 'docPresupuesto', 'docHacienda', 'docSS', 'docEstatutos', 'docOtros'];
  const savedFiles: string[] = [];

  try {
    await mkdir(expedienteDir, { recursive: true });
    for (const fieldName of fileFields) {
      const files = formData.getAll(fieldName);
      for (const entry of files) {
        if (!(entry instanceof File) || !entry.name || entry.size === 0) continue;
        if (entry.size > MAX_FILE_BYTES) {
          console.warn(`[expediente] Archivo demasiado grande: ${entry.name} (${entry.size} bytes)`);
          continue;
        }
        const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = join(expedienteDir, `${fieldName}_${safeName}`);
        await writeFile(filePath, Buffer.from(await entry.arrayBuffer()));
        savedFiles.push(`${fieldName}: ${entry.name} (${(entry.size / 1024).toFixed(0)} KB)`);
      }
    }
  } catch (err) {
    console.error('[expediente] Error guardando archivos:', err);
    // No bloqueamos el flujo — los archivos son opcionales en Fase 0
  }

  // Guardar en SQLite
  const convocatoriaSlug = clean(formData.get('convocatoriaSlug'), 200) || null;
  try {
    insertExpediente({
      id: expedienteId,
      convocatoria_slug: convocatoriaSlug,
      convocatoria_title: convocatoriaNombre || null,
      convocatoria_url: convocatoriaUrl || null,
      org_nombre: orgName,
      org_cif: cif,
      org_tipo: orgType,
      representante,
      email,
      telefono,
      provincia,
      descripcion_proyecto: descripcionProyecto,
      importe_solicitado: importeSolicitado || importeEstimado,
      experiencia,
      apoderamiento: apoderamiento === 'si' ? 1 : 0,
      comentarios,
      como_conocio: comoConocio,
      docs_adjuntos: JSON.stringify(savedFiles),
      ip: clientAddress || '',
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    console.error('[expediente] SQLite insert error:', err);
  }

  // Construir mensaje Telegram
  const convRef = tieneConvocatoria === 'si'
    ? (convocatoriaNombre || convocatoriaUrl || 'URL/referencia no indicada')
    : `SIN IDENTIFICAR — ${necesidadDesc.slice(0, 100)}`;

  const tgText =
    `<b>🗂 Nuevo expediente de subvención</b>\n\n` +
    `<b>ID:</b> <code>${expedienteId}</code>\n` +
    `<b>Entidad:</b> ${esc(orgName)} (${esc(cif)})\n` +
    `<b>Tipo:</b> ${esc(orgType)}\n` +
    `<b>Representante:</b> ${esc(representante)}\n` +
    `<b>Email:</b> ${esc(email)}\n` +
    (telefono ? `<b>Teléfono:</b> ${esc(telefono)}\n` : '') +
    `<b>Provincia:</b> ${esc(provincia)}\n\n` +
    `<b>Convocatoria:</b> ${esc(convRef)}\n` +
    (plazo ? `<b>Plazo:</b> ${esc(plazo)}\n` : '') +
    (importeSolicitado || importeEstimado ? `<b>Importe:</b> ${esc(importeSolicitado || importeEstimado)}\n` : '') +
    (apoderamiento === 'si' ? `⚡ <b>Quiere apoderamiento</b>\n` : '') +
    `\n<b>Descripción del proyecto:</b>\n${esc(descripcionProyecto.slice(0, 500))}${descripcionProyecto.length > 500 ? '…' : ''}\n` +
    (comentarios ? `\n<b>Comentarios:</b> ${esc(comentarios)}\n` : '') +
    (experiencia ? `<b>Experiencia:</b> ${esc(experiencia)}\n` : '') +
    (comoConocio ? `<b>Cómo conoció:</b> ${esc(comoConocio)}\n` : '') +
    `\n<b>Documentos:</b> ${savedFiles.length > 0 ? savedFiles.join(' | ') : 'Ninguno adjunto'}\n` +
    `<b>Ruta:</b> <code>${expedienteDir}</code>\n` +
    `<b>IP:</b> ${clientAddress || 'unknown'}`;

  // Enviar Telegram
  if (TOKEN && CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: tgText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
    } catch (err) {
      console.error('[expediente] Telegram error:', err);
    }
  }

  // Email a Mario (async, no bloqueante)
  const convLink = convocatoriaUrl
    ? `<a href="${esc(convocatoriaUrl)}">${esc(convocatoriaNombre || convocatoriaUrl)}</a>`
    : convocatoriaNombre || 'Sin identificar';

  sendEmail({
    to: 'hola@startidea.es',
    subject: `[Expediente ${expedienteId}] ${orgName} — Subvención`,
    html: `
      <p style="font-size:13px;color:#666;margin:0 0 16px 0">Nuevo expediente de subvención recibido</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#888;width:140px">ID</td><td style="padding:6px 0;font-family:monospace">${esc(expedienteId)}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Entidad</td><td style="padding:6px 0"><strong>${esc(orgName)}</strong> (${esc(cif)})</td></tr>
        <tr><td style="padding:6px 0;color:#888">Tipo</td><td style="padding:6px 0">${esc(orgType)}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Representante</td><td style="padding:6px 0">${esc(representante)}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Email</td><td style="padding:6px 0"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
        ${telefono ? `<tr><td style="padding:6px 0;color:#888">Teléfono</td><td style="padding:6px 0">${esc(telefono)}</td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#888">Provincia</td><td style="padding:6px 0">${esc(provincia)}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Convocatoria</td><td style="padding:6px 0">${convLink}</td></tr>
        ${plazo ? `<tr><td style="padding:6px 0;color:#888">Plazo</td><td style="padding:6px 0">${esc(plazo)}</td></tr>` : ''}
        ${(importeSolicitado || importeEstimado) ? `<tr><td style="padding:6px 0;color:#888">Importe</td><td style="padding:6px 0">${esc(importeSolicitado || importeEstimado)}</td></tr>` : ''}
        ${apoderamiento === 'si' ? `<tr><td style="padding:6px 0;color:#888">Apoderamiento</td><td style="padding:6px 0;color:#E6356B"><strong>Sí, quiere apoderamiento</strong></td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#888">Experiencia</td><td style="padding:6px 0">${esc(experiencia || '—')}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Cómo conoció</td><td style="padding:6px 0">${esc(comoConocio || '—')}</td></tr>
      </table>
      <div style="border-left:3px solid #E6356B;padding:10px 16px;background:#fafafa;margin:16px 0">
        <p style="margin:0;font-size:13px;color:#444;white-space:pre-wrap">${esc(descripcionProyecto)}</p>
      </div>
      ${comentarios ? `<p style="font-size:13px;color:#666"><strong>Comentarios:</strong> ${esc(comentarios)}</p>` : ''}
      <p style="font-size:12px;color:#888;margin-top:16px"><strong>Documentos guardados:</strong> ${savedFiles.length > 0 ? savedFiles.map(esc).join('<br>') : 'Ninguno'}</p>
      <p style="font-size:12px;color:#888">Ruta VPS: <code>${esc(expedienteDir)}</code></p>
    `,
  }).catch((err) => console.error('[expediente] Email Mario error:', err));

  // Email de confirmación al cliente (async)
  sendEmail({
    to: email,
    replyTo: 'hola@startidea.es',
    subject: `Hemos recibido tu expediente [${expedienteId}] — Startidea`,
    html: `
      <p>Hola, ${esc(representante.split(' ')[0])},</p>
      <p>Hemos recibido el expediente de <strong>${esc(orgName)}</strong> (ID: <code>${expedienteId}</code>).</p>
      <p>En un máximo de <strong>24 horas hábiles</strong> te enviamos:</p>
      <ul>
        <li>Diagnóstico de encaje con la convocatoria (si tiene sentido presentarse)</li>
        <li>Presupuesto exacto del servicio de tramitación</li>
        <li>Lista de documentación adicional que necesitamos si falta algo</li>
      </ul>
      <p>Si quieres añadir documentos mientras tanto, responde a este email o escríbenos a <a href="mailto:hola@startidea.es">hola@startidea.es</a> indicando el ID <strong>${expedienteId}</strong>.</p>
      <p style="margin-top:24px">Un saludo,<br><strong>Equipo Startidea</strong><br><a href="https://startidea.es">startidea.es</a> · +34 958 045 789</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="font-size:11px;color:#999">Startidea · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada</p>
    `,
  }).catch((err) => console.error('[expediente] Email cliente error:', err));

  return new Response(JSON.stringify({ ok: true, id: expedienteId }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
