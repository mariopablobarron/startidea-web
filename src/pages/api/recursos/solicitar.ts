/**
 * POST /api/recursos/solicitar
 *
 * Captura lead de un recurso descargable (lead magnet).
 * - Notifica al equipo via Telegram con datos del solicitante.
 * - Si newsletter=true, registra en Buttondown para subscribir.
 *
 * NO envía email al usuario directamente — la página /recursos/gracias
 * muestra el botón de descarga del PDF tras submit. El PDF en sí es
 * público (no protegido por DRM) — el lead magnet es aspiracional.
 */
import type { APIRoute } from 'astro';
import { sendOwnerLeadEmail } from '@/lib/email-resend';
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

const RECURSOS: Record<string, { titulo: string; pdfUrl: string }> = {
  'diagnostico-modelo-fundraising': {
    titulo: 'Diagnóstico modelo de fundraising',
    pdfUrl: '/recursos/diagnostico-modelo-fundraising.pdf',
  },
};

async function buttondownSubscribe(email: string, tags: string[] = []): Promise<void> {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    // Buttondown opcional. Si no está configurado, no rompemos.
    console.warn('[recursos] BUTTONDOWN_API_KEY no configurada — saltando suscripción');
    return;
  }
  try {
    await fetch('https://api.buttondown.email/v1/subscribers', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({ email_address: email, tags }),
    });
  } catch (err) {
    console.error('[recursos] buttondown fail', (err as Error).message);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'json' }), { status: 400 });
  }

  const name = clean(body?.name, 80);
  const email = clean(body?.email, 120);
  const organization = clean(body?.organization, 120);
  const slug = clean(body?.slug, 80);
  const newsletter = !!body?.newsletter;

  if (!name || !email) {
    return new Response(JSON.stringify({ ok: false, error: 'fields' }), { status: 400 });
  }
  if (!isEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'email' }), { status: 400 });
  }

  const recurso = RECURSOS[slug];
  if (!recurso) {
    return new Response(JSON.stringify({ ok: false, error: 'slug' }), { status: 400 });
  }

  // Rate limit por IP — 30s
  const ip = clientAddress || 'unknown';
  const now = Date.now();
  const last = lastByIp.get(ip) ?? 0;
  if (now - last < 30_000) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429 });
  }
  lastByIp.set(ip, now);

  // Notificación a Telegram
  const lines = [
    `📥 <b>Lead magnet solicitado</b>`,
    ``,
    `<b>Recurso:</b> ${escapeHtml(recurso.titulo)}`,
    `<b>Nombre:</b> ${escapeHtml(name)}`,
    `<b>Email:</b> ${escapeHtml(email)}`,
  ];
  if (organization) lines.push(`<b>Organización:</b> ${escapeHtml(organization)}`);
  lines.push(`<b>Newsletter:</b> ${newsletter ? 'sí' : 'no'}`);

  await sendTelegram(lines.join('\n'));

  // Email a Mario (no-bloqueante).
  sendOwnerLeadEmail({
    subject: `Lead magnet — ${recurso.titulo} (${name})`,
    leadName: name,
    leadEmail: email,
    bodyHtml: `
      <p style="margin:0 0 4px 0"><strong>${escapeHtml(name)}</strong></p>
      <p style="margin:0 0 16px 0;color:#666">${escapeHtml(email)}</p>
      <p style="font-size:12px;color:#888;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em">Recurso solicitado</p>
      <p style="margin:4px 0 16px 0;font-weight:600">${escapeHtml(recurso.titulo)}</p>
      ${organization ? `<p style="margin:0 0 4px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em">Organización</p><p style="margin:4px 0 16px 0">${escapeHtml(organization)}</p>` : ''}
      <p style="font-size:12px;color:#888;margin:0">Newsletter: ${newsletter ? 'sí' : 'no'}</p>
    `,
  }).catch((err) => console.error('[recursos] owner email fail:', err));

  // Suscripción opcional al newsletter
  if (newsletter) {
    await buttondownSubscribe(email, [`lead-magnet:${slug}`]);
  }

  return new Response(JSON.stringify({ ok: true, pdfUrl: recurso.pdfUrl }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
