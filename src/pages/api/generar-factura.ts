/**
 * POST /api/generar-factura
 *
 * Genera el número de factura secuencial (FAC-YYYY-NNN) y lo guarda
 * junto con el importe concedido en la BD.
 * Solo accesible con ADMIN_TOKEN.
 *
 * Body: { id: string, importeConcedido?: string }
 *   - Si importeConcedido se omite, usa el ya guardado en el expediente.
 */

import type { APIRoute } from 'astro';
import {
  getExpediente,
  nextFacturaNum,
  saveFactura,
  setImporteConcedido,
} from '@/lib/expedientes-db';
import { isValidAdminHeader } from '@/lib/admin-session';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: { id?: string; importeConcedido?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { id, importeConcedido } = body;
  if (!id) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
  }

  const exp = getExpediente(id);
  if (!exp) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
  }

  // Determinar importe a usar
  const importeStr = importeConcedido?.trim() || exp.importe_concedido;
  if (!importeStr) {
    return new Response(
      JSON.stringify({ ok: false, error: 'importe_required' }),
      { status: 400 },
    );
  }

  // Validar que el importe es un número válido
  const importeNum = parseFloat(importeStr.replace(/[.,\s€]/g, (c) => (c === ',' ? '.' : '')));
  if (isNaN(importeNum) || importeNum <= 0) {
    return new Response(
      JSON.stringify({ ok: false, error: 'importe_invalid' }),
      { status: 400 },
    );
  }

  // Guardar importe si lo mandaron (actualiza aunque ya hubiera uno)
  if (importeConcedido?.trim()) {
    setImporteConcedido(id, importeConcedido.trim());
  }

  // Si ya tiene número de factura, reutilizarlo (idempotente)
  let facturaNum = exp.factura_num;
  if (!facturaNum) {
    facturaNum = nextFacturaNum();
    saveFactura(id, facturaNum, importeStr);
  }

  return new Response(JSON.stringify({ ok: true, facturaNum }), { status: 200 });
};
