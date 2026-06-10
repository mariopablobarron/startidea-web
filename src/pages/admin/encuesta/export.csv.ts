import type { APIRoute } from 'astro';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { getAllRespuestas } from '@/lib/encuesta-db';

export const prerender = false;

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  // Anti CSV/formula injection: neutraliza celdas que empiezan por = + - @ (o tab/CR)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export const GET: APIRoute = async ({ cookies, redirect }) => {
  if (!isAdminLoggedIn(cookies)) {
    return redirect('/admin/login?next=' + encodeURIComponent('/admin/encuesta'));
  }

  const rows = getAllRespuestas();
  const cols = [
    'created_at', 'tipo_entidad', 'presupuesto', 'personas_contratadas',
    'pct_publico', 'mayor_fuente', 'mayor_fuente_pct', 'meses_aguante',
    'base_social', 'base_social_num', 'num_fuentes', 'problema_tesoreria',
    'mayor_reto', 'email',
  ];

  const lines = [cols.join(',')];
  for (const r of rows as any[]) {
    const row = cols.map((c) => {
      if (c === 'created_at') return csvCell(new Date(r.created_at).toISOString());
      return csvCell(r[c]);
    });
    lines.push(row.join(','));
  }
  const body = '﻿' + lines.join('\r\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="encuesta-fundraising.csv"',
    },
  });
};
