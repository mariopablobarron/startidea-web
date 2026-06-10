import type { APIRoute } from 'astro';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { getAllSolicitudes } from '@/lib/impulsa-db';

export const prerender = false;

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  // Anti CSV/formula injection: neutraliza celdas que empiezan por = + - @ (o tab/CR)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export const GET: APIRoute = async ({ cookies, redirect }) => {
  if (!isAdminLoggedIn(cookies)) {
    return redirect('/admin/login?next=' + encodeURIComponent('/admin/impulsa'));
  }

  const rows = getAllSolicitudes();
  const cols = [
    'created_at', 'estado', 'org_nombre', 'org_tipo', 'org_cif', 'web_actual',
    'ambito', 'anio_constitucion', 'num_personas', 'presupuesto', 'web_estado',
    'redes_estado', 'audiovisual', 'software_gestion', 'servicios_interes',
    'mision', 'retos', 'objetivo', 'contacto_nombre', 'contacto_cargo',
    'contacto_email', 'contacto_telefono', 'notas_admin',
  ];

  const lines = [cols.join(',')];
  for (const r of rows as any[]) {
    const row = cols.map((c) => {
      if (c === 'created_at') return csvCell(new Date(r.created_at).toISOString());
      return csvCell(r[c]);
    });
    lines.push(row.join(','));
  }
  // BOM para que Excel respete UTF-8
  const body = '﻿' + lines.join('\r\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="impulsa-solicitudes.csv"',
    },
  });
};
