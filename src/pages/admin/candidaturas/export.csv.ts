/**
 * GET /admin/candidaturas/export.csv
 * Exporta todas las candidaturas a CSV. Solo admin.
 */

import type { APIRoute } from 'astro';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { getAllCandidaturas, type Adjunto } from '@/lib/candidaturas-db';

export const prerender = false;

function csvCell(v: unknown): string {
  const s = String(v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

function adjuntosText(raw: string): string {
  try {
    const a = JSON.parse(raw) as Adjunto[];
    return Array.isArray(a) ? a.map((x) => `${x.nombre} (${x.kb}KB)`).join(' | ') : '';
  } catch {
    return '';
  }
}

export const GET: APIRoute = async ({ cookies, redirect }) => {
  if (!isAdminLoggedIn(cookies)) {
    return redirect('/admin/login?next=' + encodeURIComponent('/admin/candidaturas'));
  }

  const rows = getAllCandidaturas();
  const headers = [
    'id', 'fecha', 'tipo', 'area', 'nombre', 'email', 'telefono', 'ubicacion',
    'linkedin', 'web', 'mensaje', 'adjuntos', 'estado', 'notas_admin',
  ];
  const lines = [headers.join(',')];
  for (const c of rows) {
    lines.push([
      csvCell(c.id),
      csvCell(new Date(c.created_at).toISOString()),
      csvCell(c.tipo),
      csvCell(c.area),
      csvCell(c.nombre),
      csvCell(c.email),
      csvCell(c.telefono),
      csvCell(c.ubicacion),
      csvCell(c.linkedin),
      csvCell(c.web),
      csvCell(c.mensaje),
      csvCell(adjuntosText(c.adjuntos)),
      csvCell(c.estado),
      csvCell(c.notas_admin),
    ].join(','));
  }

  const csv = '﻿' + lines.join('\r\n'); // BOM para Excel
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="candidaturas-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'private, no-store',
    },
  });
};
