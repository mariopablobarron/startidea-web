/**
 * /api/plano/resumen — «Resumen por correo» al final de la charla con Lazo.
 *
 * POST { messages:[{role,content}], audiencia?, email, nombre?, organizacion?,
 *        consent, marketing?, pagina?, website? (honeypot) }
 *   → { ok, resumen, pasos, estaciones:[{id,label,url}], reservaHref, emailEnviado }
 *
 * Flujo: generarResumen (modelo o guion) → correo a la persona (Resend, SOLO
 * si el resumen viene del modelo) → alta en el CRM del HUB (outbox durable) →
 * aviso a Mario (correo + Telegram) → evento anonimizado en plano.db. Solo el
 * CRM guarda email y nombre; plano.db no los toca (privacidad: ahí solo hay
 * hash diario de IP).
 *
 * Anti-relé: cualquiera puede escribir aquí un correo ajeno, así que el correo
 * nunca lleva texto de la persona (el guion describe por intención; el modelo
 * recibe la conversación como datos), pasa por limpiarParaCorreo (sin
 * enlaces, correos ni teléfonos) y está acotado por tres límites: por IP, por
 * destinatario (1 al día) y un tope global diario persistido en plano.db.
 *
 * Si no hay RESEND_API_KEY, o el resumen es de guion, igualmente ok:true con
 * emailEnviado:false y el resumen en pantalla: la persona no se queda sin nada.
 */
import type { APIRoute } from 'astro';
import { createHash, randomUUID } from 'node:crypto';
import { rateLimit } from '@/lib/rate-limit';
import { getEnv } from '@/lib/env';
import { registrarEvento, resumenesHoyTotal } from '@/lib/plano-db';
import { sanitizarHistorial } from '@/lib/plano-charla';
import { generarResumen, limpiarParaCorreo, pasosParaCorreo, transcripcionParaCrm } from '@/lib/plano-resumen';
import { getAudiencia, getEstacion } from '@/data/plano';
import { bookingHrefWith } from '@/data/booking';
import { sendEmail, sendOwnerLeadEmail } from '@/lib/email-resend';
import { replicateHubIntake } from '@/lib/hub-intake-outbox';
import { sendTelegram } from '@/lib/telegram';

export const prerender = false;

const SITE_URL = 'https://startidea.es';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Tope global de resúmenes al día (modelo + correos). Variable PLANO_RESUMENES_DIA. */
const MAX_GLOBAL_DIA = parseInt(getEnv('PLANO_RESUMENES_DIA') || '100', 10) || 100;
/** Un mensaje cuenta como sustancia si tiene al menos esta longitud y no es un atajo. */
const MIN_CHARS_SUSTANCIA = 25;
const PREFIJO_ATAJO = 'Quiero hablar de ';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function clean(s: unknown, max: number): string {
  return typeof s === 'string' ? s.trim().slice(0, max) : '';
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** Clave de límite por destinatario: hash del correo, nunca el correo en claro en memoria de buckets. */
function claveEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

/** true si la persona ha contado algo de verdad (no solo atajos «Quiero hablar de …»). */
function tieneSustancia(messages: { role: string; content: string }[]): boolean {
  return messages.some(
    (m) => m.role === 'user' && m.content.length >= MIN_CHARS_SUSTANCIA && !m.content.startsWith(PREFIJO_ATAJO),
  );
}

interface EstacionOut {
  id: string;
  label: string;
  url: string;
}

function htmlPersona(opts: {
  nombre: string;
  resumen: string;
  pasos: string[];
  estaciones: EstacionOut[];
  reservaHref: string;
}): string {
  const saludo = opts.nombre ? `Hola ${esc(opts.nombre.split(' ')[0] || opts.nombre)},` : 'Hola,';
  const pasosHtml = opts.pasos.length
    ? `<ol style="padding-left:1.3em;margin:0">${opts.pasos.map((p) => `<li style="margin:0 0 0.5em 0">${esc(p)}</li>`).join('')}</ol>`
    : '';
  const estacionesHtml = opts.estaciones.length
    ? `<p style="margin-top:24px"><strong>Dónde seguir en startidea.es:</strong></p>
  <ul style="padding-left:1.2em;margin:0">${opts.estaciones
    .map((e) => `<li style="margin:0 0 0.3em 0"><a href="${esc(SITE_URL + e.url)}" style="color:#E6356B">${esc(e.label)}</a></li>`)
    .join('')}</ul>`
    : '';
  const reservaAbs = /^https?:/.test(opts.reservaHref) ? opts.reservaHref : SITE_URL + opts.reservaHref;

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1a1a1a;max-width:560px;margin:0 auto;padding:32px 24px;background:#f9fafb">
  <p style="margin:0 0 24px 0;font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Startidea — Agencia de innovación social · Granada</p>
  <h1 style="font-size:28px;line-height:1.2;margin:0 0 24px 0;font-weight:600">${saludo}</h1>
  <p>Soy Lazo, la IA de Startidea. Este es el resumen de lo que me has contado en startidea.es y un plan de tres pasos para empezar a moverlo.</p>
  <p style="margin-top:24px"><strong>Lo que me has contado:</strong></p>
  <p style="border-left:3px solid #E6356B;padding:4px 0 4px 16px;color:#333">${esc(opts.resumen)}</p>
  <p style="margin-top:24px"><strong>Tres pasos:</strong></p>
  ${pasosHtml}
  ${estacionesHtml}
  <p style="margin-top:32px"><a href="${esc(reservaAbs)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 20px;font-weight:500">Reservar 30 minutos con Mario</a></p>
  <p style="font-size:13px;color:#666;margin-top:8px">Mario ya tiene este resumen: la reunión no empieza de cero.</p>
  <p style="margin-top:32px">— Lazo, la IA de Startidea</p>
  <p style="font-size:14px;color:#444;margin-top:4px">Si prefieres hablar con una persona, responde a este correo y te contesta Mario Pablo.</p>
  <hr style="border:0;border-top:1px solid #eee;margin:40px 0 16px 0" />
  <p style="font-size:12px;color:#999">Startidea · C/ Conde Cifuentes 33, 18005 Granada · <a href="${SITE_URL}" style="color:#999">startidea.es</a></p>
  <p style="font-size:12px;color:#999">Recibes este correo porque lo has pedido durante tu conversación con Lazo. Startidea guarda tu correo y el texto de esta conversación en su CRM para enviártelo y poder contactarte; puedes pedir que se borren respondiendo a este mensaje. <a href="${SITE_URL}/privacidad" style="color:#999">Política de privacidad</a>.</p>
</body></html>`;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || 'unknown';

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'json' }, 400);
  }

  // Honeypot: los bots rellenan el campo oculto. Se responde ok sin hacer nada.
  if (clean(body.website, 200)) return json({ ok: true, resumen: '', pasos: [], estaciones: [], reservaHref: '/contacto', emailEnviado: false });

  const email = clean(body.email, 120).toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return json({ ok: false, error: 'email', message: 'Revisa el correo: no parece válido.' }, 400);
  if (body.consent !== true) return json({ ok: false, error: 'consent', message: 'Hace falta aceptar la política de privacidad para enviarte el resumen.' }, 400);

  const messages = sanitizarHistorial(body.messages);
  if (!messages.some((m) => m.role === 'user')) return json({ ok: false, error: 'empty', message: 'Cuéntale primero algo a Lazo: sin conversación no hay resumen.' }, 400);
  if (!tieneSustancia(messages)) return json({ ok: false, error: 'sin_sustancia', message: 'Cuéntame primero qué quieres mover; con solo atajos no hay resumen que enviar.' }, 400);

  // Límite por IP DESPUÉS de las validaciones baratas: un formulario mal
  // rellenado no debe gastar el cupo de la hora.
  const limit = rateLimit({ key: ip, bucket: 'plano-resumen', maxHits: 3, windowMs: 3_600_000 });
  if (!limit.ok) return json({ ok: false, error: 'rate', message: 'Ya se han pedido varios resúmenes desde esta conexión en la última hora. Espera un poco o escribe a hola@startidea.es.' }, 429);

  // Tope global diario (persistido en plano.db): se comprueba antes de gastar modelo o correo.
  if (resumenesHoyTotal() >= MAX_GLOBAL_DIA) {
    return json({ ok: false, error: 'limite_global', message: 'Hoy ya se han enviado todos los resúmenes previstos. Vuelve mañana o escribe a hola@startidea.es.' }, 429);
  }

  // Un resumen por destinatario y día: nadie puede usar startidea.es para insistir a un correo ajeno.
  const limitEmail = rateLimit({ key: claveEmail(email), bucket: 'plano-resumen-email', maxHits: 1, windowMs: 86_400_000 });
  if (!limitEmail.ok) return json({ ok: false, error: 'rate', message: 'Ya se ha enviado un resumen a ese correo hoy.' }, 429);

  const nombre = clean(body.nombre, 80);
  const organizacion = clean(body.organizacion, 120);
  const marketing = body.marketing === true;
  const aud = getAudiencia(typeof body.audiencia === 'string' ? body.audiencia : '');
  const audiencia = aud?.id ?? '';
  const pagina = clean(body.pagina, 120);

  const r = await generarResumen(messages, aud);
  const estaciones: EstacionOut[] = r.estaciones
    .map((id) => {
      const e = getEstacion(id);
      return e ? { id, label: e.label, url: e.url } : null;
    })
    .filter((e): e is EstacionOut => e !== null);

  // Lo que sale hacia la persona (pantalla y correo): sin enlaces, correos ni teléfonos.
  const resumenCorreo = limpiarParaCorreo(r.resumen);
  const pasosCorreo = pasosParaCorreo(r.pasos);

  // El enlace de reserva lleva nombre y correo de la propia persona y una nota fija; nunca el resumen.
  const reservaHref = bookingHrefWith({ name: nombre || undefined, email });

  // 1) Correo a la persona. SOLO si el resumen viene del modelo: el guion no
  //    cita a la persona, pero sin modelo no hay resumen que merezca un correo
  //    y así el endpoint no sirve de relé a un tercero. Sin RESEND_API_KEY
  //    devuelve false y el resumen va en pantalla.
  const emailEnviado = r.fuente === 'modelo' && resumenCorreo
    ? await sendEmail({
        to: email,
        subject: `${limpiarParaCorreo(r.asunto, 90) || 'Tu conversación con Lazo'} — Startidea`,
        html: htmlPersona({ nombre, resumen: resumenCorreo, pasos: pasosCorreo, estaciones, reservaHref }),
      })
    : false;

  // 2) Alta en el CRM del HUB (outbox durable). Un fallo aquí no rompe el flujo.
  try {
    await replicateHubIntake({
      schemaVersion: 1,
      submissionId: randomUUID(),
      kind: 'contact',
      form: 'plano-resumen',
      occurredAt: new Date().toISOString(),
      contact: { email, ...(nombre ? { name: nombre } : {}) },
      ...(organizacion ? { organization: { name: organizacion } } : {}),
      subject: r.asunto,
      message: transcripcionParaCrm(messages, 5_000),
      details: {
        audiencia,
        estaciones: estaciones.map((e) => e.id),
        pagina,
        origen: 'plano',
        resumen: r.resumen.slice(0, 2_000),
        pasos: r.pasos,
        emailEnviado,
        fuente: r.fuente,
      },
      consents: { privacy: true, marketing },
    });
  } catch (err) {
    console.error('[plano/resumen] HUB intake falló', err);
  }

  // 3) Aviso a Mario: correo (no bloqueante) + Telegram (best-effort, sin datos de la persona).
  const motivoNoEnvio = emailEnviado ? '' : r.fuente === 'guion' ? ' (correo NO enviado: resumen de guion, sin modelo)' : ' (correo NO enviado: sin Resend)';
  sendOwnerLeadEmail({
    subject: `Resumen Lazo — ${nombre || email}${aud ? ` (${aud.label})` : ''}`,
    leadName: nombre || email,
    leadEmail: email,
    bodyHtml: `
      <p style="margin:0 0 4px 0"><strong>${esc(nombre || '(sin nombre)')}</strong>${organizacion ? ` · ${esc(organizacion)}` : ''}</p>
      <p style="margin:0 0 16px 0;color:#666">${esc(email)}${aud ? ` · ${esc(aud.label)}` : ''}${marketing ? ' · quiere la nota mensual' : ''}</p>
      <p style="font-size:12px;color:#888;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em">Resumen que ha recibido${esc(motivoNoEnvio)}</p>
      <p style="border-left:3px solid #E6356B;padding:4px 0 4px 16px;color:#333;margin:0 0 16px 0">${esc(r.resumen)}</p>
      <p style="font-size:12px;color:#888;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em">Pasos</p>
      <ol style="margin:4px 0 16px 0;padding-left:18px">${r.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
      ${estaciones.length ? `<p style="font-size:12px;color:#888;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em">Estaciones</p><p style="margin:4px 0 16px 0">${estaciones.map((e) => esc(e.label)).join(' · ')}</p>` : ''}
      <p style="font-size:12px;color:#888;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em">Conversación</p>
      <pre style="margin:4px 0 16px 0;font-family:Inter,Arial,sans-serif;white-space:pre-wrap;color:#444;font-size:13px">${esc(transcripcionParaCrm(messages, 4_000))}</pre>
      <p style="margin:0;font-size:13px"><a href="${esc(reservaAbs(reservaHref))}" style="color:#E6356B">Enlace de reserva prellenado</a> · página: ${esc(pagina || '—')} · fuente: ${r.fuente}</p>
    `,
  }).catch((err) => console.error('[plano/resumen] owner email falló', err));

  void sendTelegram(
    `🧭 Resumen de Lazo · ${aud?.label ?? 'sin audiencia'} · ${estaciones.length ? estaciones.map((e) => e.label).join(', ') : 'sin estaciones'} · email enviado ${emailEnviado ? 'sí' : 'no'}`,
    { parseMode: null },
  );

  // 4) Evento anonimizado: ni email ni nombre en plano.db. Cuenta para el tope global diario.
  registrarEvento({
    tipo: 'resumen',
    texto: '',
    intencion: '',
    estaciones: estaciones.map((e) => e.id),
    destino: emailEnviado ? 'email' : 'pantalla',
    fuente: r.fuente,
    ip,
    pagina,
    audiencia,
  });

  return json({
    ok: true,
    resumen: resumenCorreo,
    pasos: pasosCorreo,
    estaciones,
    reservaHref,
    emailEnviado,
  });
};

function reservaAbs(href: string): string {
  return /^https?:/.test(href) ? href : SITE_URL + href;
}
