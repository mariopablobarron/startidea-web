import type { APIRoute } from 'astro';
import { sendOwnerLeadEmail } from '@/lib/email-resend';
import { sendTelegram, hasTelegramConfig } from '@/lib/telegram';
import { formatAttribution } from '@/lib/attribution';

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
  if (!hasTelegramConfig()) {
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

  const origen = formatAttribution(body.attribution);
  const text =
    `<b>Nuevo mensaje · startidea.es</b>\n\n` +
    `<b>De:</b> ${escape(name)}\n` +
    `<b>Email:</b> ${escape(email)}\n` +
    `<b>Página:</b> <code>${escape(path)}</code>\n` +
    (origen ? `<b>Origen:</b> ${escape(origen)}\n` : '') +
    `<b>Consentimiento RGPD:</b> ${consent ? 'sí' : 'no'}\n\n` +
    `${escape(message)}`;

  if (!(await sendTelegram(text))) {
    return new Response(JSON.stringify({ ok: false, error: 'telegram' }), { status: 502 });
  }

  // Email a Mario (no-bloqueante, ya recibió Telegram).
  sendOwnerLeadEmail({
    subject: `Nuevo mensaje de ${name} — Contacto startidea.es`,
    leadName: name,
    leadEmail: email,
    bodyHtml: `
      <p style="font-size:13px;color:#666;margin:0 0 8px 0">Nuevo mensaje desde <code>${escape(path)}</code></p>
      <p style="margin:0 0 4px 0"><strong>${escape(name)}</strong></p>
      <p style="margin:0 0 16px 0;color:#666">${escape(email)}</p>
      <div style="border-left:3px solid #E6356B;padding:8px 16px;background:#fff;margin:8px 0">
        <p style="margin:0;white-space:pre-wrap">${escape(message)}</p>
      </div>
      <p style="font-size:12px;color:#888;margin-top:16px">Consentimiento RGPD: ${consent ? 'sí' : 'no'}</p>
    `,
  }).catch((err) => console.error('[contacto] email fail:', err));

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
