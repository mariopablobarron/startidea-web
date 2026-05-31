import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { saveRespuesta, countRespuestas } from '@/lib/encuesta-db';
import { sendTelegram } from '@/lib/telegram';

export const prerender = false;

const lastByIp = new Map<string, number>();

function clean(s: unknown, max = 500): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function intIn(v: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Listas blancas: solo se aceptan valores conocidos (evita basura).
const ENUMS: Record<string, string[]> = {
  tipo_entidad: ['Asociación', 'Fundación', 'Federación', 'Cooperativa de iniciativa social', 'Otra'],
  presupuesto: ['<50k', '50-150k', '150-300k', '300k-1M', '>1M'],
  personas_contratadas: ['0', '1-3', '4-10', '>10'],
  meses_aguante: ['<1', '1-3', '3-6', '6-12', '>12'],
  num_fuentes: ['1', '2', '3', '4+'],
};

function inEnum(key: string, v: unknown): string {
  const val = clean(v, 60);
  return ENUMS[key].includes(val) ? val : '';
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'json' }), { status: 400 });
  }

  // Honeypot anti-spam
  if (clean(body.website)) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // Rate-limit por IP (1 cada 20s)
  const ip = clientAddress || 'unknown';
  const now = Date.now();
  if (now - (lastByIp.get(ip) ?? 0) < 20_000) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429 });
  }

  const consent = body.consent === true;
  if (!consent) {
    return new Response(JSON.stringify({ ok: false, error: 'consent' }), { status: 400 });
  }

  const tipo_entidad = inEnum('tipo_entidad', body.tipo_entidad);
  const presupuesto = inEnum('presupuesto', body.presupuesto);
  if (!tipo_entidad || !presupuesto) {
    return new Response(JSON.stringify({ ok: false, error: 'fields' }), { status: 400 });
  }

  const email = clean(body.email, 120);
  if (email && !isEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'email' }), { status: 400 });
  }

  lastByIp.set(ip, now);

  const r = {
    id: randomUUID(),
    tipo_entidad,
    presupuesto,
    personas_contratadas: inEnum('personas_contratadas', body.personas_contratadas),
    pct_publico: intIn(body.pct_publico, 0, 100),
    mayor_fuente: clean(body.mayor_fuente, 120),
    mayor_fuente_pct: intIn(body.mayor_fuente_pct, 0, 100),
    meses_aguante: inEnum('meses_aguante', body.meses_aguante),
    base_social: body.base_social === true || body.base_social === 'si' ? 1 : 0,
    base_social_num: intIn(body.base_social_num, 0, 1_000_000),
    num_fuentes: inEnum('num_fuentes', body.num_fuentes),
    problema_tesoreria: body.problema_tesoreria === true || body.problema_tesoreria === 'si' ? 1 : 0,
    mayor_reto: clean(body.mayor_reto, 1000),
    email,
    ip,
    created_at: now,
  };

  try {
    saveRespuesta(r);
  } catch (err) {
    console.error('[encuesta] save fail:', err);
    return new Response(JSON.stringify({ ok: false, error: 'db' }), { status: 500 });
  }

  // Aviso no bloqueante a Telegram con el total acumulado.
  try {
    const total = countRespuestas();
    sendTelegram(
      `<b>Nueva respuesta · Encuesta fundraising</b>\n` +
        `${r.tipo_entidad} · ${r.presupuesto} · ${r.pct_publico}% público\n` +
        `Total acumulado: <b>${total}</b>`,
    ).catch(() => {});
  } catch { /* noop */ }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
