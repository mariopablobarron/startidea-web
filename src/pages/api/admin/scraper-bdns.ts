/**
 * /api/admin/scraper-bdns
 *
 * Ejecuta el scraper BDNS y encola las convocatorias nuevas como inactivas
 * para revisión manual en /admin/convocatorias.
 *
 * POST  → ejecuta scrape + upsert
 *         Body JSON opcional: { organismos?: string[], keywords?: string[], soloAbiertas?: boolean }
 *         Responde: { ok, inserted, skipped, errors, items }
 *
 * Auth: x-admin-token header
 */
import type { APIRoute } from 'astro';
import { isValidAdminHeader } from '@/lib/admin-session';
import { upsertConvocatoria, getConvocatoria, logScraperRun } from '@/lib/expedientes-db';
import {
  scrapeBDNS,
  JUNTA_ORGANISMOS,
  SOCIAL_KEYWORDS,
  type ScrapeOptions,
} from '@/lib/scrapers/bdns';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function sendTelegram(msg: string): Promise<void> {
  // En SSR con adapter Node, las vars runtime se leen de process.env.
  // Fallback a import.meta.env por compatibilidad con preview local.
  const token = process.env.TELEGRAM_BOT_TOKEN ?? import.meta.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID ?? import.meta.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
    });
  } catch {
    // no bloquear si Telegram falla
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!isValidAdminHeader(request.headers.get('x-admin-token') ?? '')) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let opts: Partial<ScrapeOptions> = {};
  try {
    const body = await request.text();
    if (body.trim()) opts = JSON.parse(body) as Partial<ScrapeOptions>;
  } catch {
    // body vacío o inválido → usar defaults
  }

  const scrapeOpts: ScrapeOptions = {
    organismos: opts.organismos ?? JUNTA_ORGANISMOS,
    keywords:   opts.keywords   ?? SOCIAL_KEYWORDS,
    soloAbiertas: opts.soloAbiertas ?? true,
    maxResults: 200,
    timeoutMs:  25000,
  };

  // Trackeamos la ejecución completa para el panel SOS. Si el scraper crashea
  // antes de terminar, registramos como ok=false con el error capturado.
  const started_at = Math.floor(Date.now() / 1000);
  const triggered_by = request.headers.get('x-cron') === '1' ? 'cron' : 'admin';

  let result;
  try {
    result = await scrapeBDNS(scrapeOpts);
  } catch (e) {
    console.error('[scraper-bdns] Error:', e);
    logScraperRun({
      scraper: 'bdns',
      started_at,
      finished_at: Math.floor(Date.now() / 1000),
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500),
      triggered_by,
    });
    return json({ ok: false, error: 'scrape_failed', detail: String(e) }, 500);
  }

  // Insertar solo las nuevas (slug no existe aún)
  let inserted = 0;
  let skipped = 0;
  const insertedTitles: string[] = [];

  for (const conv of result.normalized) {
    try {
      const existing = getConvocatoria(conv.slug);
      if (existing) {
        skipped++;
        continue;
      }
      upsertConvocatoria({
        ...conv,
        financia_resumen: conv.financia_resumen,
        gastos_ok:        conv.gastos_ok,
        gastos_no:        conv.gastos_no,
        requisitos:       conv.requisitos,
      });
      inserted++;
      insertedTitles.push(conv.titulo.slice(0, 80));
    } catch (e) {
      result.errors.push(`Upsert ${conv.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Notificación Telegram si hay nuevas
  if (inserted > 0) {
    const listItems = insertedTitles
      .slice(0, 8)
      .map((t, i) => `${i + 1}. ${t}`)
      .join('\n');
    const extra = inserted > 8 ? `\n…y ${inserted - 8} más` : '';
    await sendTelegram(
      `🔔 <b>Scraper BDNS — ${inserted} convocatoria${inserted > 1 ? 's' : ''} nueva${inserted > 1 ? 's' : ''}</b>\n\n` +
      `${listItems}${extra}\n\n` +
      `Revisión pendiente en /admin/convocatorias`
    );
  }

  console.info(
    `[scraper-bdns] fetched=${result.fetched} normalized=${result.normalized.length} ` +
    `inserted=${inserted} skipped=${skipped} errors=${result.errors.length}`
  );

  // Registrar la ejecución en scraper_runs (panel SOS lo lee).
  // ok = true incluso si hay errors parciales en upserts — el scraper en sí
  // funcionó (devolvió datos). Si quisiéramos distinguir, podríamos marcar
  // ok=false cuando errors.length === fetched (todo falló).
  logScraperRun({
    scraper: 'bdns',
    started_at,
    finished_at: Math.floor(Date.now() / 1000),
    ok: true,
    total_found:   result.fetched,
    total_new:     inserted,
    total_updated: skipped,    // upsert sin cambios — interpretamos como "ya estaba"
    error: result.errors.length > 0 ? result.errors.slice(0, 3).join(' | ').slice(0, 500) : null,
    triggered_by,
  });

  return json({
    ok: true,
    fetched: result.fetched,
    normalized: result.normalized.length,
    inserted,
    skipped,
    errors: result.errors,
    items: insertedTitles,
  });
};
