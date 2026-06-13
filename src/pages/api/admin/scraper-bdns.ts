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
import { sendTelegram } from '@/lib/telegram';
import { isValidAdminHeader } from '@/lib/admin-session';
import { upsertConvocatoria, getConvocatoria, logScraperRun } from '@/lib/expedientes-db';
import { scrapeBDNS, type ScrapeOptions } from '@/lib/scrapers/bdns';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
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
    search:         opts.search,
    soloAbiertas:   opts.soloAbiertas ?? true,
    // Default nacional (2026-06-13): Startidea trabaja con toda España, así que
    // el catálogo ingiere también convocatorias estatales, no solo Andalucía.
    // El filtro de relevancia social (SOCIAL_KEYWORDS) sigue aplicando, y todo
    // entra como activa=0 para revisión humana antes de publicarse.
    includeEstatal: opts.includeEstatal ?? true,
    maxPerTerm:     30,
    maxDetails:     60,
    timeoutMs:      15000,
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
  // ok refleja la salud REAL del scrape (result.ok): false si todo falló y no
  // se obtuvo nada. La RESPUESTA del endpoint sigue siendo ok:true porque el
  // disparo (cron/admin) se ejecutó — scraper_runs.ok es la fuente de verdad.
  logScraperRun({
    scraper: 'bdns',
    started_at,
    finished_at: Math.floor(Date.now() / 1000),
    ok: result.ok,
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
