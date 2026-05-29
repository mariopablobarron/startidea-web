/**
 * POST /api/conversion-rapida
 *
 * Captura el CTA de homepage (form ultra corto): nombre, email, tipo de
 * organización, mensaje opcional. Notifica a Telegram.
 *
 * Rate limit por IP — 30s entre submits.
 * Honeypot ya filtrado en el cliente (campo `website`).
 */
import type { APIRoute } from 'astro';
import { sendTelegram } from '@/lib/telegram';

export const prerender = false;

const lastByIp = new Map<string, number>();

function clean(s: unknown, max = 200): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

const ORG_LABEL: Record<string, string> = {
  'tercer-sector': 'ONG, fundación o asociación',
  'institucion': 'Administración o institución',
  'empresa-proposito': 'Empresa con propósito',
  'otro': 'Otro / aún no lo sé',
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'json' }), { status: 400 });
  }

  const name = clean(body?.name, 80);
  const email = clean(body?.email, 120);
  const orgType = clean(body?.org_type, 40);
  const message = clean(body?.message, 500);
  const source = clean(body?.source, 50) || 'home_cta';

  if (!name || !email) {
    return new Response(JSON.stringify({ ok: false, error: 'fields' }), { status: 400 });
  }
  if (!isEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'email' }), { status: 400 });
  }
  if (!orgType || !(orgType in ORG_LABEL)) {
    return new Response(JSON.stringify({ ok: false, error: 'org_type' }), { status: 400 });
  }

  // Rate limit por IP — 30s
  const ip = clientAddress || 'unknown';
  const now = Date.now();
  const last = lastByIp.get(ip) ?? 0;
  if (now - last < 30_000) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429 });
  }
  lastByIp.set(ip, now);

  const lines = [
    `⚡ <b>Conversión rápida (homepage CTA)</b>`,
    ``,
    `<b>Nombre:</b> ${escapeHtml(name)}`,
    `<b>Email:</b> ${escapeHtml(email)}`,
    `<b>Tipo:</b> ${escapeHtml(ORG_LABEL[orgType] ?? orgType)}`,
  ];
  if (message) lines.push(`<b>Reto:</b> ${escapeHtml(message)}`);
  lines.push(``, `<b>Source:</b> ${escapeHtml(source)}`);

  await sendTelegram(lines.join('\n'));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
