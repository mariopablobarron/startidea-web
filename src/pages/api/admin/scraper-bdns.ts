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
import { upsertConvocatoria, getConvocatoria } from '@/lib/expedientes-db';
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
  const token = import.meta.env.TELEGRAM_BOT_TOKEN;
  const chatId = import.meta.env.TELEGRAM_CHAT_ID;
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

  let result;
  try {
    result = await scrapeBDNS(scrapeOpts);
  } catch (e) {
    console.error('[scraper-bdns] Error:', e);
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
