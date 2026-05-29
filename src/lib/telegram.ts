/**
 * telegram.ts — Helper único para enviar notificaciones a Telegram.
 *
 * Centraliza el envío a la Bot API (sendMessage) que una quincena de
 * endpoints reimplementaba inline. Lee credenciales con getEnv() (process.env
 * con fallback a import.meta.env), igual que el resto del backend SSR.
 *
 * Nunca lanza: si Telegram falla o faltan credenciales, loguea y devuelve
 * false. El caller decide si eso es bloqueante:
 *
 *   // best-effort (no importa el resultado):
 *   void sendTelegram(text);
 *
 *   // bloqueante (el endpoint depende del aviso):
 *   if (!(await sendTelegram(text))) {
 *     return new Response(JSON.stringify({ ok: false, error: 'telegram' }), { status: 502 });
 *   }
 *
 * NO confundir con notify-error.ts: ese es para alertas de error con
 * rate-limit y formato de severidad propios, y es independiente de este
 * helper a propósito (no debe silenciarse por la misma lógica).
 */
import { getEnv } from '@/lib/env';

export interface TelegramOptions {
  /**
   * Modo de formato. 'HTML' por defecto (la mayoría de mensajes usan <b>,
   * <code>, etc.). Pasar null para texto plano SIN escapar — necesario cuando
   * el texto contiene contenido de usuario sin sanitizar (p.ej. chat.ts), que
   * rompería el parseo HTML de Telegram y abortaría el envío.
   */
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown' | null;
  /** Oculta la preview de enlaces. true por defecto (avisos internos a Mario). */
  disablePreview?: boolean;
  /** chat_id alternativo. Por defecto, TELEGRAM_CHAT_ID del entorno. */
  chatId?: string;
}

/** true si hay TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID configurados. */
export function hasTelegramConfig(): boolean {
  return Boolean(getEnv('TELEGRAM_BOT_TOKEN') && getEnv('TELEGRAM_CHAT_ID'));
}

/**
 * Envía un mensaje a Telegram (sendMessage). Devuelve true solo si la API
 * confirmó el envío (HTTP ok && data.ok). Nunca lanza.
 */
export async function sendTelegram(text: string, opts: TelegramOptions = {}): Promise<boolean> {
  const token = getEnv('TELEGRAM_BOT_TOKEN');
  const chatId = opts.chatId || getEnv('TELEGRAM_CHAT_ID');
  if (!token || !chatId) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN/CHAT_ID no configurados — saltando envío');
    return false;
  }

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: opts.disablePreview ?? true,
  };
  // parseMode === null → texto plano (sin parse_mode). undefined → 'HTML'.
  if (opts.parseMode !== null) {
    payload.parse_mode = opts.parseMode ?? 'HTML';
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.ok) {
      console.error('[telegram] sendMessage falló:', r.status, JSON.stringify(data)?.slice(0, 200) ?? '');
      return false;
    }
    return true;
  } catch (e) {
    console.error('[telegram] sendMessage error de red:', e);
    return false;
  }
}
