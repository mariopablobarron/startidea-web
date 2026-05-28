/**
 * notify-error.ts
 *
 * Sistema ligero de alertas para errores críticos en producción.
 * Envía Telegram a Mario cuando un componente crítico falla.
 *
 * No reemplaza Sentry, pero sí cubre el caso esencial:
 *   - el cron del Copiloto Autónomo falla → enterarse el mismo día
 *   - OpenRouter devuelve 500 repetidamente → enterarse antes de perder un cliente
 *   - el wizard /api/expediente devuelve error sin email enviado → enterarse antes
 *
 * Implementa rate limit interno (1 alerta del mismo tipo por 30 min) para no
 * spamear Telegram si un error se dispara en bucle.
 *
 * Uso:
 *   import { notifyError } from '@/lib/notify-error';
 *   try { ... }
 *   catch (err) {
 *     await notifyError({
 *       component: 'auto-copiloto/trigger',
 *       severity: 'critical',
 *       message: 'OpenRouter timeout tras 3 intentos',
 *       error: err,
 *       context: { profileId, convSlug },
 *     });
 *     throw err; // Re-lanzar si procede
 *   }
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Rate limit: por componente+severity, máx 1 alerta cada 30 min
const lastNotified = new Map<string, number>();
const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutos

export type ErrorSeverity = 'warning' | 'error' | 'critical';

export interface NotifyErrorOpts {
  /** Identificador del componente (ej. 'auto-copiloto/trigger') */
  component: string;
  /** Nivel de gravedad */
  severity: ErrorSeverity;
  /** Mensaje legible para Mario */
  message: string;
  /** Error opcional con stack trace */
  error?: unknown;
  /** Contexto adicional útil para debug (org, expediente, etc.) */
  context?: Record<string, unknown>;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c));
}

function emojiFor(severity: ErrorSeverity): string {
  return severity === 'critical' ? '🚨' : severity === 'error' ? '❌' : '⚠️';
}

/**
 * Envía notificación a Telegram. Nunca lanza — si Telegram falla, solo
 * loguea por consola. Devuelve true si se envió.
 */
export async function notifyError(opts: NotifyErrorOpts): Promise<boolean> {
  // Siempre logueamos por consola para tener traza local
  const errMsg = opts.error instanceof Error
    ? `${opts.error.message}\n${opts.error.stack?.slice(0, 500) ?? ''}`
    : opts.error !== undefined ? String(opts.error) : '';

  console.error(`[${opts.component}] [${opts.severity}] ${opts.message}`, errMsg, opts.context ?? {});

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

  // Rate limit por componente+severity
  const dedupKey = `${opts.component}:${opts.severity}`;
  const now = Date.now();
  const last = lastNotified.get(dedupKey);
  if (last && now - last < DEDUP_WINDOW_MS) {
    // Dentro de la ventana — silenciamos para no spamear
    return false;
  }
  lastNotified.set(dedupKey, now);

  // Construir mensaje
  const lines = [
    `${emojiFor(opts.severity)} <b>${esc(opts.severity.toUpperCase())}</b> en <code>${esc(opts.component)}</code>`,
    '',
    esc(opts.message),
  ];

  if (errMsg) {
    lines.push('', `<pre>${esc(errMsg.slice(0, 800))}</pre>`);
  }

  if (opts.context && Object.keys(opts.context).length > 0) {
    lines.push('', '<b>Contexto:</b>');
    for (const [k, v] of Object.entries(opts.context)) {
      const val = typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : String(v).slice(0, 200);
      lines.push(`• <code>${esc(k)}</code>: ${esc(val)}`);
    }
  }

  lines.push('', `<i>Próxima alerta del mismo tipo en ≥30 min para evitar spam.</i>`);

  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    return r.ok;
  } catch (e) {
    console.error('[notify-error] Telegram send failed:', e);
    return false;
  }
}
