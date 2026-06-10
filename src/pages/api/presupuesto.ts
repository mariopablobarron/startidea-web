// Endpoint que recibe el form de /presupuesto.
// Los precios viven solo en el servidor (src/data/servicios.ts). El cliente
// envía únicamente los IDs de servicios marcados — el lookup y la suma
// se hacen aquí para que ni HTML ni DevTools expongan tarifas.

import type { APIRoute } from 'astro';
import { calcularPresupuesto } from '@/data/servicios';
import { sendOwnerLeadEmail, sendEmail } from '@/lib/email-resend';
import { sendTelegram, hasTelegramConfig } from '@/lib/telegram';

export const prerender = false;

const lastByIp = new Map<string, number>();

function clean(s: unknown, max = 1000): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}
function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

const SEGMENTO: Record<string, string> = {
  'tercer-sector': 'Para una entidad del Tercer Sector',
  'institucion': 'Para una institución pública',
  'empresa-proposito': 'Para una empresa con propósito',
  'iniciativa-propia': 'Para una iniciativa o proyecto propio',
};
const ENFOQUE: Record<string, string> = {
  comunicar: 'la prioridad es ordenar el relato antes de producir piezas. Recomendamos arrancar con plan de comunicación + memoria editorial.',
  captar: 'la dependencia de fuente única suele ser el problema real. Recomendamos diagnóstico financiero + plan de fundraising a 12 meses.',
  plataforma: 'la web debe ser activo de captación, no folleto. Recomendamos arquitectura de información antes de tocar diseño.',
  audiovisual: 'lo audiovisual rinde cuando se planifica como serie editorial, no como pieza suelta. Recomendamos definir formato y calendario antes de producir.',
  estrategia: 'recomendamos arrancar por un diagnóstico estratégico que ordene prioridades antes de mover el primer recurso.',
  'no-se': 'recomendamos arrancar por una llamada de diagnóstico de 30 minutos para identificar el reto real antes de ofrecer alcance.',
};
const RITMO: Record<string, string> = {
  ya: 'Con tu urgencia, podemos arrancar la próxima semana.',
  '1-3m': 'Tu plazo encaja con un arranque ordenado, sin prisa pero sin dilación.',
  '3-6m': 'Hay margen para hacer un diagnóstico previo bien hecho.',
  explorando: 'Estás en buen momento para conversar sin compromiso.',
};
const RANGO_PRES: Record<string, string> = {
  'menos-3k': 'Con presupuesto contenido, priorizaremos un alcance acotado y de alto impacto.',
  '3-10k': 'Tu rango permite un proyecto de tamaño medio bien acabado.',
  '10-30k': 'Tu rango da margen para una intervención sostenida con resultados medibles.',
  'mas-30k': 'Con ese rango podemos diseñar una intervención multi-disciplinar a varios meses.',
  'no-se': 'No pasa nada — lo cerramos en la propuesta tras el diagnóstico.',
};

function generarDiagnostico(r: Record<string, string>): string {
  const seg = SEGMENTO[r.tipologia] || 'Para tu caso';
  const enf = ENFOQUE[r.reto] || 'recomendamos una primera conversación de diagnóstico.';
  const rit = RITMO[r.urgencia] || '';
  const pres = RANGO_PRES[r.presupuesto] || '';
  return `${seg}, ${enf} ${rit} ${pres}`.trim();
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!hasTelegramConfig()) {
    return new Response(JSON.stringify({ ok: false, error: 'config' }), { status: 500 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'json' }), { status: 400 });
  }

  // Honeypot
  if (clean(body.website)) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const name = clean(body.name, 80);
  const email = clean(body.email, 120);
  const contexto = clean(body.contexto, 1000);
  const consent = body.consent === true;
  const respuestas = body.respuestas && typeof body.respuestas === 'object' ? body.respuestas : {};
  const serviciosIds = Array.isArray(body.servicios) ? body.servicios.filter((s: unknown): s is string => typeof s === 'string').slice(0, 30) : [];

  if (!name || !email) {
    return new Response(JSON.stringify({ ok: false, error: 'fields' }), { status: 400 });
  }
  if (!isEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'email' }), { status: 400 });
  }
  if (!consent) {
    return new Response(JSON.stringify({ ok: false, error: 'consent' }), { status: 400 });
  }

  // Rate-limit por IP
  const ip = clientAddress || 'unknown';
  const now = Date.now();
  const last = lastByIp.get(ip) ?? 0;
  if (now - last < 30_000) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429 });
  }
  lastByIp.set(ip, now);

  // Lookup + cálculo en server (precios nunca salen del backend)
  const calc = calcularPresupuesto(serviciosIds);
  const diagnostico = generarDiagnostico(respuestas as Record<string, string>);

  const tipologia = clean(respuestas.tipologia, 50) || '—';
  const reto = clean(respuestas.reto, 50) || '—';
  const urgencia = clean(respuestas.urgencia, 50) || '—';
  const presupuestoRango = clean(respuestas.presupuesto, 50) || '—';

  // Texto Telegram
  const text =
    `<b>🧮 Nuevo briefing de presupuesto · startidea.es</b>\n\n` +
    `<b>De:</b> ${escapeHtml(name)}\n` +
    `<b>Email:</b> ${escapeHtml(email)}\n` +
    `<b>Consentimiento RGPD:</b> sí\n\n` +
    `<b>— Briefing —</b>\n` +
    `Tipología: ${escapeHtml(tipologia)}\n` +
    `Reto: ${escapeHtml(reto)}\n` +
    `Urgencia: ${escapeHtml(urgencia)}\n` +
    `Presupuesto orientativo: ${escapeHtml(presupuestoRango)}\n` +
    (contexto ? `Contexto: ${escapeHtml(contexto)}\n` : '') +
    `\n<b>— Diagnóstico autogenerado —</b>\n${escapeHtml(diagnostico)}\n\n` +
    `<b>— Servicios marcados (${serviciosIds.length}) —</b>\n` +
    (calc.lineas.length ? escapeHtml(calc.lineas.join('\n')) : '(ninguno)') +
    `\n\n<b>Estimación interna:</b> ${escapeHtml(calc.resumen)}`;

  if (!(await sendTelegram(text))) {
    return new Response(JSON.stringify({ ok: false, error: 'telegram' }), { status: 502 });
  }

  // Email de confirmación al cliente (no-bloqueante: si falla, el form sigue
  // siendo exitoso porque el equipo ya recibió el aviso por Telegram).
  enviarEmailConfirmacion({
    name,
    email,
    diagnostico,
    serviciosNombres: calc.lineas.map((l) => l.replace(/\s*\(desde [^)]*\)/, '')),
  }).catch((err) => console.error('[presupuesto] email fail:', err));

  // Email a Mario con el briefing completo (no-bloqueante).
  sendOwnerLeadEmail({
    subject: `Nuevo briefing presupuesto — ${name}`,
    leadName: name,
    leadEmail: email,
    bodyHtml: `
      <p style="margin:0 0 4px 0"><strong>${escapeHtml(name)}</strong></p>
      <p style="margin:0 0 16px 0;color:#666">${escapeHtml(email)}</p>
      <p style="font-size:12px;color:#888;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em">Briefing</p>
      <ul style="margin:4px 0 16px 0;padding-left:18px">
        <li>Tipología: ${escapeHtml(tipologia)}</li>
        <li>Reto: ${escapeHtml(reto)}</li>
        <li>Urgencia: ${escapeHtml(urgencia)}</li>
        <li>Presupuesto orientativo: ${escapeHtml(presupuestoRango)}</li>
      </ul>
      ${contexto ? `<p style="font-size:12px;color:#888;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em">Contexto</p><div style="border-left:3px solid #E6356B;padding:8px 16px;background:#fff;margin:0 0 16px 0;white-space:pre-wrap">${escapeHtml(contexto)}</div>` : ''}
      <p style="font-size:12px;color:#888;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em">Diagnóstico autogenerado</p>
      <p style="margin:4px 0 16px 0;font-style:italic;color:#444">${escapeHtml(diagnostico)}</p>
      <p style="font-size:12px;color:#888;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em">Servicios marcados (${serviciosIds.length})</p>
      <pre style="margin:4px 0 16px 0;font-family:Inter,Arial,sans-serif;white-space:pre-wrap;color:#444;font-size:13px">${escapeHtml(calc.lineas.join('\n') || '(ninguno)')}</pre>
      <p style="margin:0;font-size:14px"><strong>Estimación interna:</strong> ${escapeHtml(calc.resumen)}</p>
    `,
  }).catch((err) => console.error('[presupuesto] owner email fail:', err));

  // Devolver al cliente solo el diagnóstico (texto cualitativo, sin números)
  return new Response(
    JSON.stringify({ ok: true, diagnostico }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
};

async function enviarEmailConfirmacion(opts: {
  name: string;
  email: string;
  diagnostico: string;
  serviciosNombres: string[];
}): Promise<void> {
  const serviciosHtml = opts.serviciosNombres.length
    ? `<ul style="padding-left:1.2em;margin:0">${opts.serviciosNombres
        .map((s) => `<li style="margin:0 0 0.3em 0">${escapeHtml(s)}</li>`)
        .join('')}</ul>`
    : '<p style="color:#666;font-style:italic">No has marcado servicios concretos — lo comentamos en la llamada.</p>';

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1a1a1a;max-width:560px;margin:0 auto;padding:32px 24px;background:#f9fafb">
  <p style="margin:0 0 24px 0;font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Startidea — Agencia de innovación social · Granada</p>
  <h1 style="font-size:28px;line-height:1.2;margin:0 0 24px 0;font-weight:600">Hola ${escapeHtml(opts.name.split(' ')[0] || opts.name)},</h1>
  <p>Recibido tu briefing en startidea.es. Lo está leyendo el equipo y te respondemos con un presupuesto detallado en las próximas 24 horas laborales.</p>
  <p style="margin-top:24px"><strong>Primera lectura del diagnóstico:</strong></p>
  <p style="border-left:3px solid #E6356B;padding:4px 0 4px 16px;color:#333;font-style:italic">${escapeHtml(opts.diagnostico)}</p>
  <p style="margin-top:24px"><strong>Servicios que marcaste:</strong></p>
  ${serviciosHtml}
  <p style="margin-top:32px">Si quieres acelerar, puedes <a href="https://startidea.es/contacto" style="color:#E6356B">reservar una llamada directa de 30 minutos</a>.</p>
  <p style="margin-top:32px">— Mario Pablo · <a href="mailto:hola@startidea.es" style="color:#E6356B">hola@startidea.es</a></p>
  <hr style="border:0;border-top:1px solid #eee;margin:40px 0 16px 0" />
  <p style="font-size:12px;color:#999">Startidea · C/ Conde Cifuentes 33, 18005 Granada · <a href="https://startidea.es" style="color:#999">startidea.es</a></p>
</body></html>`;

  // Usa el helper compartido (mismo FROM/reply-to/error-handling que el resto
  // de endpoints). El FROM correcto sale de RESEND_FROM; nunca hardcodear un
  // dominio distinto a startidea.es aquí.
  await sendEmail({
    to: opts.email,
    subject: 'Hemos recibido tu briefing — Startidea',
    html,
  });
}
