/**
 * SeoOpportunityService — analiza los datos persistidos de GA4 + GSC y genera
 * oportunidades SEO accionables.
 *
 * 10 reglas (kind):
 *   p4_20                Keywords en posición 4-20 (ganancias rápidas)
 *   low_ctr              URLs con muchas impresiones y bajo CTR
 *   traffic_drop         Páginas con caída de clicks reciente
 *   growing_imp          Impresiones crecientes pero pocos clicks
 *   cannibalization      Múltiples URLs compitiendo por la misma query
 *   low_conv             Tráfico orgánico alto pero poca conversión (GA4)
 *   high_conv_low_traffic Conversión alta con poco tráfico (escalable)
 *   content_gap          Queries con impresiones sin URL ranqueando bien
 *   title_meta           Page con CTR muy por debajo del benchmark de su posición
 *   internal_linking     Pages con muchas impresiones pero rank>20 (subir con enlaces)
 *
 * Las oportunidades se persisten en seo_opportunities con metric_summary (JSON).
 * Idempotencia: cada run limpia oportunidades sin resolved_at de los últimos 7 días
 * antes de regenerar, para evitar duplicados acumulados.
 */

import { getDb } from './db';

type OpKind =
  | 'p4_20'
  | 'low_ctr'
  | 'traffic_drop'
  | 'growing_imp'
  | 'cannibalization'
  | 'low_conv'
  | 'high_conv_low_traffic'
  | 'content_gap'
  | 'title_meta'
  | 'internal_linking';

type Opportunity = {
  kind: OpKind;
  priority: 1 | 2 | 3 | 4 | 5;
  url: string | null;
  keyword: string | null;
  metric_summary: Record<string, unknown>;
  recommendation: string;
};

// CTR esperado por posición media (estudios públicos sector — orientativo)
const CTR_BENCHMARK: Record<number, number> = {
  1: 0.32, 2: 0.18, 3: 0.12, 4: 0.085, 5: 0.063,
  6: 0.05, 7: 0.04, 8: 0.033, 9: 0.028, 10: 0.024,
};

function ctrExpected(pos: number): number {
  const p = Math.round(pos);
  if (p <= 1) return CTR_BENCHMARK[1];
  if (p >= 10) return 0.018;
  return CTR_BENCHMARK[p] ?? 0.02;
}

export async function analyze(runId: number): Promise<number> {
  const db = getDb();

  // Limpia oportunidades no resueltas anteriores → recrear en cada run mantiene
  // la tabla compacta. Si quieres histórico permanente, cambia esto a UPDATE
  // resolved_at = now donde no aparezcan ya.
  db.prepare(`DELETE FROM seo_opportunities WHERE resolved_at IS NULL`).run();

  const ops: Opportunity[] = [];

  // Ventana de análisis: últimos 28 días vs 28 anteriores.
  const recent = '-28 days';
  const previous = '-56 days';

  // ── 1. Keywords en posición 4-20 ─────────────────────────────────────
  const p420 = db.prepare(`
    SELECT query, AVG(position) AS pos, SUM(clicks) AS clicks, SUM(impressions) AS imps
    FROM gsc_daily_queries
    WHERE date >= date('now', ?) AND query != ''
    GROUP BY query
    HAVING pos BETWEEN 4 AND 20 AND imps >= 50
    ORDER BY imps DESC
    LIMIT 50
  `).all(recent) as { query: string; pos: number; clicks: number; imps: number }[];
  for (const r of p420) {
    ops.push({
      kind: 'p4_20',
      priority: r.pos < 11 ? 1 : 2,
      url: null,
      keyword: r.query,
      metric_summary: { posicion_media: +r.pos.toFixed(1), clicks: r.clicks, impresiones: r.imps },
      recommendation: r.pos < 11
        ? 'Keyword en página 1 fuera del top 3 — refuerza copy del title/H1 y enlaza desde páginas más fuertes.'
        : 'Keyword en página 2 con tracción — actualiza contenido, añade FAQ y enlaces internos.',
    });
  }

  // ── 2. URLs con muchas impresiones y bajo CTR ────────────────────────
  const lowCtr = db.prepare(`
    SELECT page, AVG(position) AS pos, SUM(clicks) AS clicks, SUM(impressions) AS imps,
           CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) ELSE 0 END AS ctr
    FROM gsc_daily_pages
    WHERE date >= date('now', ?) AND page != ''
    GROUP BY page
    HAVING imps >= 200 AND pos < 15
    ORDER BY imps DESC
    LIMIT 30
  `).all(recent) as { page: string; pos: number; clicks: number; imps: number; ctr: number }[];
  for (const r of lowCtr) {
    const expected = ctrExpected(r.pos);
    if (r.ctr < expected * 0.6) {
      ops.push({
        kind: 'low_ctr',
        priority: r.imps > 1000 ? 1 : 2,
        url: r.page,
        keyword: null,
        metric_summary: { ctr_actual: +(r.ctr * 100).toFixed(2), ctr_esperado: +(expected * 100).toFixed(2), pos: +r.pos.toFixed(1), impresiones: r.imps },
        recommendation: 'CTR muy por debajo del esperado para esta posición. Revisa title y meta description: gancho directo, menos genérico.',
      });
    }
  }

  // ── 3. Caída de clicks (traffic_drop) ────────────────────────────────
  const drop = db.prepare(`
    WITH rec AS (
      SELECT page, SUM(clicks) AS c FROM gsc_daily_pages
      WHERE date >= date('now', ?) GROUP BY page
    ), prev AS (
      SELECT page, SUM(clicks) AS c FROM gsc_daily_pages
      WHERE date >= date('now', ?) AND date < date('now', ?) GROUP BY page
    )
    SELECT rec.page, rec.c AS recent_clicks, prev.c AS prev_clicks
    FROM rec JOIN prev USING(page)
    WHERE prev.c >= 20 AND rec.c < prev.c * 0.6
    ORDER BY (prev.c - rec.c) DESC
    LIMIT 20
  `).all(recent, previous, recent) as { page: string; recent_clicks: number; prev_clicks: number }[];
  for (const r of drop) {
    const pct = Math.round((1 - r.recent_clicks / r.prev_clicks) * 100);
    ops.push({
      kind: 'traffic_drop',
      priority: pct >= 50 ? 1 : 2,
      url: r.page,
      keyword: null,
      metric_summary: { clicks_recientes: r.recent_clicks, clicks_previos: r.prev_clicks, caida_pct: pct },
      recommendation: 'Pérdida de clicks significativa vs ventana anterior. Revisa actualizaciones de algoritmo, cambios on-page, y posiciones perdidas.',
    });
  }

  // ── 4. Impresiones crecientes pero pocos clicks ──────────────────────
  const growing = db.prepare(`
    WITH rec AS (
      SELECT page, SUM(impressions) AS i, SUM(clicks) AS c FROM gsc_daily_pages
      WHERE date >= date('now', ?) GROUP BY page
    ), prev AS (
      SELECT page, SUM(impressions) AS i FROM gsc_daily_pages
      WHERE date >= date('now', ?) AND date < date('now', ?) GROUP BY page
    )
    SELECT rec.page, rec.i AS recent_imps, prev.i AS prev_imps, rec.c AS clicks
    FROM rec JOIN prev USING(page)
    WHERE prev.i >= 100 AND rec.i > prev.i * 1.4 AND rec.c < 15
    ORDER BY (rec.i - prev.i) DESC
    LIMIT 20
  `).all(recent, previous, recent) as { page: string; recent_imps: number; prev_imps: number; clicks: number }[];
  for (const r of growing) {
    ops.push({
      kind: 'growing_imp',
      priority: 2,
      url: r.page,
      keyword: null,
      metric_summary: { impresiones_recientes: r.recent_imps, impresiones_previas: r.prev_imps, clicks: r.clicks },
      recommendation: 'Impresiones subiendo pero clicks no acompañan. Optimiza title/meta para mejorar CTR antes de que la posición se estabilice.',
    });
  }

  // ── 5. Canibalización ────────────────────────────────────────────────
  const cann = db.prepare(`
    SELECT q.query, COUNT(DISTINCT p.page) AS n_pages, GROUP_CONCAT(DISTINCT p.page) AS pages, SUM(q.clicks) AS clicks
    FROM gsc_daily_queries q
    JOIN gsc_daily_pages p ON q.date = p.date AND q.site_url = p.site_url
    WHERE q.date >= date('now', ?) AND q.query != ''
    GROUP BY q.query
    HAVING n_pages >= 3 AND SUM(q.clicks) >= 10
    ORDER BY SUM(q.clicks) DESC
    LIMIT 15
  `).all(recent) as { query: string; n_pages: number; pages: string; clicks: number }[];
  // Nota: este JOIN es aproximado (GSC no expone page+query simultáneo a este nivel) →
  // sirve como pista de canibalización, no diagnóstico definitivo.
  for (const r of cann) {
    ops.push({
      kind: 'cannibalization',
      priority: r.n_pages >= 5 ? 1 : 2,
      url: null,
      keyword: r.query,
      metric_summary: { paginas_compitiendo: r.n_pages, urls: r.pages.split(',').slice(0, 5), clicks_total: r.clicks },
      recommendation: 'Posible canibalización: varias URLs ranquean para esta query. Decide URL canónica, redirige las demás con 301 o consolida contenido.',
    });
  }

  // ── 6. Tráfico orgánico alto, baja conversión (necesita GA4) ─────────
  const lowConv = db.prepare(`
    SELECT page_path, SUM(active_users) AS users, SUM(conversions) AS convs,
           CASE WHEN SUM(active_users) > 0 THEN CAST(SUM(conversions) AS REAL) / SUM(active_users) ELSE 0 END AS rate
    FROM ga4_daily_metrics
    WHERE date >= date('now', ?)
    GROUP BY page_path
    HAVING users >= 200 AND rate < 0.005
    ORDER BY users DESC
    LIMIT 20
  `).all(recent) as { page_path: string; users: number; convs: number; rate: number }[];
  for (const r of lowConv) {
    ops.push({
      kind: 'low_conv',
      priority: r.users > 1000 ? 1 : 2,
      url: r.page_path,
      keyword: null,
      metric_summary: { usuarios: r.users, conversiones: r.convs, tasa_pct: +(r.rate * 100).toFixed(2) },
      recommendation: 'Mucho tráfico, casi nada convierte. Añade CTA visible arriba del fold, prueba social específica, y formulario corto.',
    });
  }

  // ── 7. Alta conversión con poco tráfico (escalable) ──────────────────
  const escalable = db.prepare(`
    SELECT page_path, SUM(active_users) AS users, SUM(conversions) AS convs,
           CASE WHEN SUM(active_users) > 0 THEN CAST(SUM(conversions) AS REAL) / SUM(active_users) ELSE 0 END AS rate
    FROM ga4_daily_metrics
    WHERE date >= date('now', ?)
    GROUP BY page_path
    HAVING users BETWEEN 30 AND 300 AND rate >= 0.03
    ORDER BY rate DESC
    LIMIT 15
  `).all(recent) as { page_path: string; users: number; convs: number; rate: number }[];
  for (const r of escalable) {
    ops.push({
      kind: 'high_conv_low_traffic',
      priority: 1,
      url: r.page_path,
      keyword: null,
      metric_summary: { usuarios: r.users, conversiones: r.convs, tasa_pct: +(r.rate * 100).toFixed(2) },
      recommendation: 'Conversión alta pero pocas visitas. Invierte SEO, enlazado interno, y considera campaña pagada — escalar funcionará.',
    });
  }

  // ── 8. Content gap ───────────────────────────────────────────────────
  const gap = db.prepare(`
    SELECT query, SUM(impressions) AS imps, AVG(position) AS pos
    FROM gsc_daily_queries
    WHERE date >= date('now', ?) AND query != ''
    GROUP BY query
    HAVING pos > 20 AND imps >= 100
    ORDER BY imps DESC
    LIMIT 25
  `).all(recent) as { query: string; imps: number; pos: number }[];
  for (const r of gap) {
    ops.push({
      kind: 'content_gap',
      priority: r.imps > 500 ? 2 : 3,
      url: null,
      keyword: r.query,
      metric_summary: { impresiones: r.imps, posicion_media: +r.pos.toFixed(1) },
      recommendation: 'Hueco de contenido: la query aparece en búsquedas pero ninguna URL ranquea bien. Crea contenido específico que la responda.',
    });
  }

  // ── 9. title_meta ────────────────────────────────────────────────────
  // Cubierto parcialmente por low_ctr — generamos para queries específicas con CTR muy bajo
  const tm = db.prepare(`
    SELECT query, AVG(position) AS pos, SUM(clicks) AS clicks, SUM(impressions) AS imps,
           CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) ELSE 0 END AS ctr
    FROM gsc_daily_queries
    WHERE date >= date('now', ?) AND query != ''
    GROUP BY query
    HAVING imps >= 300 AND pos < 11
    ORDER BY imps DESC
    LIMIT 15
  `).all(recent) as { query: string; pos: number; clicks: number; imps: number; ctr: number }[];
  for (const r of tm) {
    const exp = ctrExpected(r.pos);
    if (r.ctr < exp * 0.5) {
      ops.push({
        kind: 'title_meta',
        priority: 2,
        url: null,
        keyword: r.query,
        metric_summary: { pos: +r.pos.toFixed(1), ctr_pct: +(r.ctr * 100).toFixed(2), ctr_esperado_pct: +(exp * 100).toFixed(2), impresiones: r.imps },
        recommendation: 'Para esta query estás en página 1 con CTR muy bajo. Reformula title y meta description de la URL principal asociada.',
      });
    }
  }

  // ── 10. Internal linking (impresiones pero rank > 20) ────────────────
  const internalLink = db.prepare(`
    SELECT page, SUM(impressions) AS imps, AVG(position) AS pos
    FROM gsc_daily_pages
    WHERE date >= date('now', ?) AND page != ''
    GROUP BY page
    HAVING imps >= 200 AND pos > 20
    ORDER BY imps DESC
    LIMIT 15
  `).all(recent) as { page: string; imps: number; pos: number }[];
  for (const r of internalLink) {
    ops.push({
      kind: 'internal_linking',
      priority: 3,
      url: r.page,
      keyword: null,
      metric_summary: { impresiones: r.imps, posicion_media: +r.pos.toFixed(1) },
      recommendation: 'Página con muchas impresiones pero ranquea fuera del top 20. Añade enlaces internos contextuales desde páginas con autoridad.',
    });
  }

  // Insertar todas
  const insert = db.prepare(`
    INSERT INTO seo_opportunities (kind, priority, url, keyword, metric_summary, recommendation, run_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((arr: Opportunity[]) => {
    for (const o of arr) {
      insert.run(o.kind, o.priority, o.url, o.keyword, JSON.stringify(o.metric_summary), o.recommendation, runId);
    }
  });
  tx(ops);

  return ops.length;
}
