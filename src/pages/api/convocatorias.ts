/**
 * GET /api/convocatorias
 *
 * API pública. Devuelve convocatorias activas en JSON.
 * Param ?tipo=privada|local|empresa filtra por tipo_beneficiario.
 * Cache 5 min en el navegador.
 */
import type { APIRoute } from 'astro';
import { listConvocatoriasActivas } from '@/lib/expedientes-db';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const tipo = url.searchParams.get('tipo') ?? '';
    const convs = listConvocatoriasActivas(tipo || undefined);
    return new Response(JSON.stringify({ ok: true, data: convs }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch (err) {
    console.error('[api/convocatorias] GET error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'internal' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
