/**
 * GET /admin/seo/report
 *
 * Devuelve oportunidades como CSV. Filtros opcionales:
 *   ?kind=p4_20&priority=1&since=2026-04-01
 */
import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/seo/auth';
import { getDb } from '@/lib/seo/db';

export const prerender = false;

const KIND_LABEL: Record<string, string> = {
  p4_20: 'Posición 4-20',
  low_ctr: 'CTR bajo',
  traffic_drop: 'Caída de tráfico',
  growing_imp: 'Impresiones crecientes',
  cannibalization: 'Canibalización',
  low_conv: 'Baja conversión',
  high_conv_low_traffic: 'Alta conv, poco tráfico',
  content_gap: 'Hueco de contenido',
  title_meta: 'Title/meta',
  internal_linking: 'Enlazado interno',
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const GET: APIRoute = (context) => {
  const denied = requireAdmin(context);
  if (denied) return denied;

  const url = new URL(context.request.url);
  const kind = url.searchParams.get('kind') || '';
  const priority = url.searchParams.get('priority') || '';
  const since = url.searchParams.get('since') || ''; // YYYY-MM-DD

  const where: string[] = ['resolved_at IS NULL'];
  const args: any[] = [];
  if (kind) { where.push('kind = ?'); args.push(kind); }
  if (priority) { where.push('priority = ?'); args.push(Number(priority)); }
  if (since) {
    where.push('detected_at >= ?');
    args.push(Math.floor(new Date(since).getTime() / 1000));
  }

  const rows = getDb()
    .prepare(`
      SELECT priority, kind, url, keyword, metric_summary, recommendation, detected_at
      FROM seo_opportunities
      WHERE ${where.join(' AND ')}
      ORDER BY priority ASC, detected_at DESC
    `)
    .all(...args) as Array<{
      priority: number;
      kind: string;
      url: string | null;
      keyword: string | null;
      metric_summary: string;
      recommendation: string;
      detected_at: number;
    }>;

  const headers = [
    'Prioridad',
    'Tipo',
    'URL',
    'Keyword',
    'Métricas',
    'Recomendación',
    'Detectada',
  ].map(csvEscape).join(',');

  const lines = rows.map((r) => [
    r.priority,
    KIND_LABEL[r.kind] || r.kind,
    r.url || '',
    r.keyword || '',
    r.metric_summary,
    r.recommendation,
    new Date(r.detected_at * 1000).toISOString(),
  ].map(csvEscape).join(','));

  // BOM UTF-8 para que Excel lea ñ y acentos bien
  const csv = '﻿' + headers + '\n' + lines.join('\n');

  const filename = `startidea-seo-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
};
