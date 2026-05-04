import type { APIRoute } from 'astro';

export const prerender = false;

const lastByIp = new Map<string, number>();

function clean(s: unknown, max = 1000): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
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

  if (clean(body.website)) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const name = clean(body.name, 80);
  const email = clean(body.email, 120);
  const message = clean(body.message, 2000);
  const path = clean(body.path, 200) || '/';
  const consent = body.consent === true;

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ ok: false, error: 'fields' }), { status: 400 });
  }
  if (!isEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'email' }), { status: 400 });
  }
  if (!consent) {
    return new Response(
      JSON.stringify({ ok: false, error: 'consent' }),
      { status: 400 }
    );
  }

  const ip = clientAddress || 'unknown';
  const now = Date.now();
  const last = lastByIp.get(ip) ?? 0;
  if (now - last < 30_000) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429 });
  }
  lastByIp.set(ip, now);

  const text =
    `<b>Nuevo mensaje · startidea.es</b>\n\n` +
    `<b>De:</b> ${escape(name)}\n` +
    `<b>Email:</b> ${escape(email)}\n` +
    `<b>Página:</b> <code>${escape(path)}</code>\n` +
    `<b>Consentimiento RGPD:</b> ${consent ? 'sí' : 'no'}\n\n` +
    `${escape(message)}`;

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

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
