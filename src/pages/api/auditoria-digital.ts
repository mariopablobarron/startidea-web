/**
 * POST /api/auditoria-digital
 *
 * Lead magnet "Auditoría digital gratuita" (/auditoria-digital-gratuita).
 *
 * Flujo:
 *  1. Valida (honeypot, campos, email, URL) y aplica rate-limit por IP.
 *  2. Responde al instante al navegador y avisa a Mario por Telegram.
 *  3. Envía al lead un email de acuse: la auditoría revisada llega en 48 h
 *     laborables. El lead NUNCA recibe el análisis automático en bruto.
 *  4. En segundo plano corre `auditarSitio` (web + Google + IA + redes,
 *     con PageSpeed) y manda el resultado a Mario por Telegram y email para
 *     que lo revise y redacte la auditoría final.
 *
 * Sin persistencia: igual que el resto de lead magnets, el registro vive en
 * Telegram + email. Buttondown opcional si newsletter=true.
 */
import type { APIRoute } from 'astro';
import { sendEmail, sendOwnerLeadEmail } from '@/lib/email-resend';
import { sendTelegram } from '@/lib/telegram';
import { rateLimit } from '@/lib/rate-limit';
import { auditarSitio, normalizarUrl, resumenHtml, resumenTexto } from '@/lib/auditoria-digital';

export const prerender = false;

function clean(s: unknown, max = 200): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}
function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

const TIPOS = new Set(['asociacion', 'fundacion', 'iglesia', 'institucion', 'empresa', 'otro']);
const TIPO_LABEL: Record<string, string> = {
  asociacion: 'Asociación',
  fundacion: 'Fundación',
  iglesia: 'Parroquia, diócesis o congregación',
  institucion: 'Institución o administración',
  empresa: 'Empresa con propósito',
  otro: 'Otro',
};

async function buttondownSubscribe(email: string, tags: string[]): Promise<void> {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) return;
  try {
    await fetch('https://api.buttondown.email/v1/subscribers', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Token ${apiKey}` },
      body: JSON.stringify({ email_address: email, tags }),
    });
  } catch (err) {
    console.error('[auditoria] buttondown fail', (err as Error).message);
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'json' }, 400);
  }

  // Honeypot: fingimos éxito.
  if (clean(body?.website)) return json({ ok: true });

  const name = clean(body?.name, 80);
  const email = clean(body?.email, 120);
  const organization = clean(body?.organization, 120);
  const tipo = TIPOS.has(clean(body?.tipo, 20)) ? clean(body?.tipo, 20) : 'otro';
  const redes = clean(body?.redes, 300);
  const reto = clean(body?.reto, 600);
  const newsletter = !!body?.newsletter;
  const consent = !!body?.consent;
  const url = normalizarUrl(clean(body?.url, 200));

  if (!name || !email || !url) return json({ ok: false, error: 'fields' }, 400);
  if (!isEmail(email)) return json({ ok: false, error: 'email' }, 400);
  if (!consent) return json({ ok: false, error: 'consent' }, 400);

  const ip = clientAddress || 'unknown';
  const limit = rateLimit({ key: ip, bucket: 'auditoria', maxHits: 3, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) return json({ ok: false, error: 'rate', retry_after_s: limit.retryAfter }, 429);

  const tipoLabel = TIPO_LABEL[tipo];

  // 1. Aviso inmediato a Mario.
  const lines = [
    `🔍 <b>Auditoría digital solicitada</b>`,
    ``,
    `<b>Nombre:</b> ${esc(name)}`,
    `<b>Email:</b> ${esc(email)}`,
    organization ? `<b>Organización:</b> ${esc(organization)}` : '',
    `<b>Tipo:</b> ${esc(tipoLabel)}`,
    `<b>Web:</b> ${esc(url)}`,
    redes ? `<b>Redes:</b> ${esc(redes)}` : '',
    reto ? `<b>Reto:</b> ${esc(reto)}` : '',
    `<b>Newsletter:</b> ${newsletter ? 'sí' : 'no'}`,
    ``,
    `⏳ Análisis automático en marcha, llega en 1-2 min.`,
  ].filter(Boolean);
  await sendTelegram(lines.join('\n'));

  // 2. Acuse al lead (no bloqueante).
  sendEmail({
    to: email,
    subject: 'Tu auditoría digital está en marcha — Startidea',
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;line-height:1.5">
<p>Hola, ${esc(name)}.</p>
<p>Startidea ha recibido la solicitud de auditoría digital para <strong>${esc(url)}</strong>.</p>
<p>Ahora mismo un sistema automático está comprobando la web, la indexación en Google, la visibilidad en asistentes de IA (ChatGPT, Perplexity, Claude) y las redes enlazadas. Después, una persona del equipo revisa el resultado y redacta la auditoría con las tres correcciones que más impacto tienen para ${organization ? esc(organization) : 'tu organización'}.</p>
<p><strong>La recibirás en este correo en un plazo de 48 horas laborables.</strong> Sin coste y sin compromiso.</p>
<p>Si quieres adelantar algo o corregir la URL, responde a este mensaje.</p>
<p style="margin-top:32px;color:#666;font-size:13px">Startidea · Agencia de innovación social · Granada<br><a href="https://startidea.es" style="color:#666">startidea.es</a></p>
</body></html>`,
  }).catch((err) => console.error('[auditoria] lead email fail:', err));

  if (newsletter) buttondownSubscribe(email, ['lead-magnet:auditoria-digital', `tipo:${tipo}`]);

  // 3. Análisis en segundo plano. No esperamos: la respuesta al navegador
  //    sale ya. Cualquier error solo se registra en logs.
  void (async () => {
    try {
      const r = await auditarSitio(url);
      await sendTelegram(`📋 <b>Resultado automático · ${esc(name)}</b>\n\n${resumenTexto(r)}`);
      await sendOwnerLeadEmail({
        subject: `Auditoría digital — ${organization || name} (${url})`,
        leadName: name,
        leadEmail: email,
        bodyHtml: `
          <p style="margin:0 0 4px 0"><strong>${esc(name)}</strong>${organization ? ` · ${esc(organization)}` : ''} · ${esc(tipoLabel)}</p>
          <p style="margin:0 0 16px 0;color:#666">${esc(email)}</p>
          ${redes ? `<p style="margin:0 0 4px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em">Redes</p><p style="margin:4px 0 16px 0">${esc(redes)}</p>` : ''}
          ${reto ? `<p style="margin:0 0 4px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em">Reto que cuenta</p><p style="margin:4px 0 16px 0">${esc(reto)}</p>` : ''}
          <p style="margin:0 0 4px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em">Análisis automático</p>
          ${resumenHtml(r)}
          <p style="margin:16px 0 0 0;font-size:12px;color:#888">Compromiso con el lead: auditoría revisada en 48 h laborables.</p>
        `,
      });
    } catch (err) {
      console.error('[auditoria] analisis fail:', (err as Error).message);
      await sendTelegram(`⚠️ La auditoría automática de ${esc(url)} falló: ${esc((err as Error).message)}. Hay que hacerla a mano.`).catch(() => {});
    }
  })();

  return json({ ok: true });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
