/**
 * POST /api/aceptar-contrato
 *
 * Registra la aceptación electrónica del contrato por el cliente.
 * Guarda timestamp + IP en la BD y notifica a Mario por Telegram.
 * No requiere ADMIN_TOKEN (el token del contrato actúa como autenticación).
 */

import type { APIRoute } from 'astro';
import {
  getExpedienteByContratoToken,
  markContratoAceptado,
} from '@/lib/expedientes-db';

export const prerender = false;

function getEnv(key: string): string {
  return process.env[key] ?? (import.meta as any).env?.[key] ?? '';
}

export const POST: APIRoute = async ({ request }) => {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { token } = body;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_token' }), { status: 400 });
  }

  const exp = getExpedienteByContratoToken(token);
  if (!exp) {
    return new Response(JSON.stringify({ ok: false, error: 'token_invalid' }), { status: 404 });
  }

  if (exp.contrato_at) {
    // Ya aceptado — idempotente
    return new Response(JSON.stringify({ ok: true, already: true }), { status: 200 });
  }

  // Capturar IP (Traefik/Coolify pone X-Forwarded-For)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  markContratoAceptado(exp.id, ip);

  // Notificar a Mario
  const tgToken = getEnv('TELEGRAM_BOT_TOKEN');
  const tgChat  = getEnv('TELEGRAM_CHAT_ID');
  if (tgToken && tgChat) {
    const ts = new Date().toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
    });
    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id:    tgChat,
        text:       `✅ <b>Contrato ACEPTADO por el cliente</b>\n\n<b>Expediente:</b> <code>${exp.id}</code>\n<b>Cliente:</b> ${exp.org_nombre}\n<b>Representante:</b> ${exp.representante}\n<b>Fecha:</b> ${ts}\n<b>IP:</b> <code>${ip}</code>\n\nYa puedes generar la factura cuando se conceda la subvención.`,
        parse_mode: 'HTML',
      }),
    }).catch(console.error);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
