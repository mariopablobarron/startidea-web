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
import {
  insertExpediente,
  getPortalUser,
  createPortalUser,
  createMagicToken,
} from '@/lib/expedientes-db';
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
  const fileFields = ['docMemoriaAnual', 'docMemoria', 'docPresupuesto', 'docHacienda', 'docSS', 'docEstatutos', 'docOtros'];
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

  // ── Auto-crear usuario de portal y generar magic link ──────────────────────
  let portalMagicUrl = 'https://startidea.es/portal';
  try {
    const existingUser = getPortalUser(email);
    if (!existingUser) {
      // Crear cuenta de portal con los datos del formulario
      createPortalUser({
        email,
        nombre: representante,
        org_nombre: orgName,
        org_cif: cif,
        org_tipo: orgType,
        telefono,
        provincia,
        como_conocio: comoConocio,
        consent_at: null, // sin checkbox de consentimiento explícito en este formulario
      });
    }
    // Magic link válido 1h para acceso inmediato al portal
    const magicToken = createMagicToken(email);
    portalMagicUrl = `https://startidea.es/portal/link/${magicToken}`;
  } catch (err) {
    console.error('[expediente] Portal user/magic-token error:', err);
    // No bloquea — el cliente siempre puede hacer login desde /portal
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

  // Email de confirmación al cliente — con acceso directo al portal (async)
  const nombreCorto = esc(representante.split(' ')[0]);
  const convRefCliente = convocatoriaNombre
    ? `<strong>${esc(convocatoriaNombre)}</strong>`
    : convocatoriaUrl
      ? `<a href="${esc(convocatoriaUrl)}" style="color:#e6356b">${esc(convocatoriaUrl)}</a>`
      : null;

  sendEmail({
    to: email,
    replyTo: 'hola@startidea.es',
    subject: `Tu expediente [${expedienteId}] está en marcha — Startidea`,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:580px;margin:0 auto;padding:32px 24px">

  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Copiloto de Subvenciones
  </p>

  <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#1f1f22">
    Hola, ${nombreCorto}. Tu expediente está en marcha.
  </h1>
  <p style="font-size:13px;color:#888;margin:0 0 24px">
    ID: <span style="font-family:monospace;font-weight:700;color:#1f1f22">${expedienteId}</span>
    &nbsp;·&nbsp; ${esc(orgName)}
    ${convRefCliente ? `&nbsp;·&nbsp; ${convRefCliente}` : ''}
  </p>

  <!-- CTA Portal -->
  <div style="background:#1f1f22;padding:24px;margin:0 0 28px">
    <p style="font-size:14px;color:#fff;margin:0 0 6px;font-weight:700">
      Sigue el estado de tu expediente en tiempo real
    </p>
    <p style="font-size:13px;color:#aaa;margin:0 0 16px;line-height:1.5">
      Hemos creado tu acceso al portal de clientes de Startidea. Desde ahí podrás ver el estado del expediente, descargar los documentos cuando estén listos y enviarnos mensajes.
    </p>
    <a href="${esc(portalMagicUrl)}"
       style="display:inline-block;background:#e6356b;color:#fff;text-decoration:none;
       padding:12px 28px;font-family:monospace;font-size:12px;font-weight:700;
       letter-spacing:0.06em;text-transform:uppercase">
      Acceder a mi portal →
    </a>
    <p style="font-size:11px;color:#666;margin:12px 0 0">
      Este enlace es personal y caduca en 1 hora. Para acceder después, usa el email de acceso en
      <a href="https://startidea.es/portal" style="color:#aaa">startidea.es/portal</a>.
    </p>
  </div>

  <!-- Qué pasa ahora -->
  <h2 style="font-size:15px;font-weight:700;margin:0 0 12px;color:#1f1f22">Qué ocurre ahora</h2>
  <ol style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#444">
    <li>En un máximo de <strong>24 horas hábiles</strong> Startidea analiza el encaje con la convocatoria y te envía el diagnóstico.</li>
    <li>Si hay encaje, recibes el presupuesto exacto del servicio y el contrato de comisión a éxito (solo pagas si se concede).</li>
    <li>Cuando aceptas, el sistema genera automáticamente la memoria técnica, el presupuesto y la guía de presentación.</li>
    <li>Revisas el expediente en tu portal y se presenta electrónicamente antes del plazo.</li>
  </ol>

  <!-- Si falta documentación -->
  <div style="border-left:3px solid #e6356b;padding:12px 16px;background:#fff8f9;margin:0 0 24px">
    <p style="font-size:13px;color:#444;margin:0">
      <strong>¿Quieres añadir documentos ya?</strong> Responde a este email adjuntando lo que tengas
      e indicando el ID <strong style="font-family:monospace">${expedienteId}</strong>.
      También puedes subirlos desde el portal.
    </p>
  </div>

  <p style="font-size:14px;color:#1f1f22;margin:0 0 4px">Un saludo,</p>
  <p style="font-size:14px;font-weight:700;color:#1f1f22;margin:0 0 4px">Startidea</p>
  <p style="font-size:13px;color:#888;margin:0">
    <a href="https://startidea.es" style="color:#888">startidea.es</a>
    &nbsp;·&nbsp; hola@startidea.es
    &nbsp;·&nbsp; +34 958 045 789
  </p>

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:11px;color:#bbb;margin:0">
    Startidea Consulting, S.L. · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada
  </p>

</div>
</body></html>`,
  }).catch((err) => console.error('[expediente] Email cliente error:', err));

  return new Response(JSON.stringify({ ok: true, id: expedienteId }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
