// Endpoint que recibe el form de /presupuesto.
// Los precios viven solo en el servidor (src/data/servicios.ts). El cliente
// envía únicamente los IDs de servicios marcados — el lookup y la suma
// se hacen aquí para que ni HTML ni DevTools expongan tarifas.

import type { APIRoute } from 'astro';
import { calcularPresupuesto } from '@/data/servicios';

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
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN || import.meta.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || import.meta.env.TELEGRAM_CHAT_ID;

  if (!TOKEN || !CHAT_ID) {
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

  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await r.json();
    if (!data.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'telegram' }), { status: 502 });
    }
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'network' }), { status: 502 });
  }

  // Devolver al cliente solo el diagnóstico (texto cualitativo, sin números)
  return new Response(
    JSON.stringify({ ok: true, diagnostico }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
};
