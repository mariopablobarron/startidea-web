import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { saveSolicitud, countSolicitudes } from '@/lib/impulsa-db';
import { sendTelegram } from '@/lib/telegram';
import { sendOwnerLeadEmail } from '@/lib/email-resend';

export const prerender = false;

const lastByIp = new Map<string, number>();

function clean(s: unknown, max = 500): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

const TIPOS = ['Asociación', 'Fundación', 'Federación', 'ONG', 'Cooperativa de iniciativa social'];
const ESTADOS = ['No tenemos', 'Desactualizada', 'Aceptable', 'Buena'];
const SERVICIOS = ['Web', 'Redes sociales', 'Plan de comunicación', 'Audiovisual', 'Software de gestión', 'Diagnóstico'];

function inList(list: string[], v: unknown): string {
  const val = clean(v, 60);
  return list.includes(val) ? val : '';
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
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

  const ip = clientAddress || 'unknown';
  const now = Date.now();
  if (now - (lastByIp.get(ip) ?? 0) < 20_000) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429 });
  }

  if (body.consent !== true) {
    return new Response(JSON.stringify({ ok: false, error: 'consent' }), { status: 400 });
  }

  const org_nombre = clean(body.org_nombre, 160);
  const org_tipo = inList(TIPOS, body.org_tipo);
  const contacto_nombre = clean(body.contacto_nombre, 120);
  const contacto_email = clean(body.contacto_email, 120);

  if (!org_nombre || !org_tipo || !contacto_nombre || !contacto_email) {
    return new Response(JSON.stringify({ ok: false, error: 'fields' }), { status: 400 });
  }
  if (!isEmail(contacto_email)) {
    return new Response(JSON.stringify({ ok: false, error: 'email' }), { status: 400 });
  }

  // Servicios de interés: filtrar a la lista blanca
  let servicios: string[] = [];
  if (Array.isArray(body.servicios_interes)) {
    servicios = body.servicios_interes
      .map((s: unknown) => clean(s, 40))
      .filter((s: string) => SERVICIOS.includes(s));
  }

  lastByIp.set(ip, now);

  const s = {
    id: randomUUID(),
    org_nombre,
    org_tipo,
    org_cif: clean(body.org_cif, 20),
    web_actual: clean(body.web_actual, 200),
    ambito: clean(body.ambito, 60),
    anio_constitucion: clean(body.anio_constitucion, 8),
    num_personas: clean(body.num_personas, 20),
    presupuesto: clean(body.presupuesto, 20),
    mision: clean(body.mision, 1200),
    web_estado: inList(ESTADOS, body.web_estado),
    redes_estado: inList(ESTADOS, body.redes_estado),
    audiovisual: body.audiovisual === true || body.audiovisual === 'si' ? 'si' : 'no',
    software_gestion: body.software_gestion === true || body.software_gestion === 'si' ? 'si' : 'no',
    retos: clean(body.retos, 1500),
    servicios_interes: JSON.stringify(servicios),
    objetivo: clean(body.objetivo, 1500),
    contacto_nombre,
    contacto_cargo: clean(body.contacto_cargo, 120),
    contacto_email,
    contacto_telefono: clean(body.contacto_telefono, 30),
    ip,
    created_at: now,
  };

  try {
    saveSolicitud(s);
  } catch (err) {
    console.error('[impulsa] save fail:', err);
    return new Response(JSON.stringify({ ok: false, error: 'db' }), { status: 500 });
  }

  // Avisos no bloqueantes
  try {
    const total = countSolicitudes();
    sendTelegram(
      `<b>Nueva solicitud · Startidea Impulsa</b>\n` +
        `${s.org_nombre} (${s.org_tipo})\n` +
        `Contacto: ${s.contacto_nombre} · ${s.contacto_email}\n` +
        `Interés: ${servicios.join(', ') || '—'}\n` +
        `Total acumulado: <b>${total}</b>`,
    ).catch(() => {});
  } catch { /* noop */ }

  sendOwnerLeadEmail({
    subject: `Nueva solicitud Impulsa — ${s.org_nombre}`,
    leadName: s.contacto_nombre,
    leadEmail: s.contacto_email,
    bodyHtml: `
      <p style="margin:0 0 4px 0"><strong>${s.org_nombre}</strong> · ${s.org_tipo}</p>
      <p style="margin:0 0 12px 0;color:#666">${s.contacto_nombre} (${s.contacto_cargo}) · ${s.contacto_email} · ${s.contacto_telefono}</p>
      <p style="margin:0 0 4px 0"><strong>Servicios de interés:</strong> ${servicios.join(', ') || '—'}</p>
      <p style="margin:0 0 4px 0"><strong>Retos:</strong> ${s.retos}</p>
      <p style="margin:0 0 4px 0"><strong>Objetivo:</strong> ${s.objetivo}</p>
    `,
  }).catch((err) => console.error('[impulsa] email fail:', err));

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
