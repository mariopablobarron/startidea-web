/**
 * GET /api/expediente-status/[id]
 *
 * Endpoint público para que el cliente pueda consultar el estado
 * de su propio expediente tras enviarlo. Se usa en la página /gracias
 * para mostrar el progreso en tiempo real.
 *
 * No requiere autenticación: el ID es suficientemente opaco (8-char hex).
 * No devuelve datos sensibles — solo status, label y si hay documentos listos.
 */
import type { APIRoute } from 'astro';
import { getExpediente } from '@/lib/expedientes-db';

export const prerender = false;

const STATUS_LABEL: Record<string, string> = {
  recibido:      'Expediente recibido ✓',
  analizando_ia: 'Analizando el encaje y generando documentos…',
  docs_listos:   'Documentos preparados',
  entregado:     'Documentos enviados',
  presentado:    'Solicitud presentada',
  rechazado:     'Resolución recibida',
};

const STATUS_DONE = new Set(['docs_listos', 'entregado', 'presentado', 'rechazado']);

export const GET: APIRoute = async ({ params }) => {
  const id = (params.id ?? '').trim().toUpperCase();
  // Validación básica: IDs son 8-char hex uppercase
  if (!id || !/^[A-Z0-9]{6,12}$/.test(id)) {
    return new Response(JSON.stringify({ ok: false, error: 'bad_id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const exp = getExpediente(id);
    if (!exp) {
      return new Response(JSON.stringify({ ok: false, status: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        ok:         true,
        status:     exp.status,
        label:      STATUS_LABEL[exp.status] ?? exp.status,
        done:       STATUS_DONE.has(exp.status),
        hasMemoria: !!exp.ai_memoria,
        hasWizardMemoria: !!exp.ai_memoria,  // alias semántico
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store, no-cache',
        },
      },
    );
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'db_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
