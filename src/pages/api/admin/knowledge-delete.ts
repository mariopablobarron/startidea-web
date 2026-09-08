/**
 * POST /api/admin/knowledge-delete — borra un documento de «Entrenar a Lazo».
 *
 * Acepta form-urlencoded/multipart (campo id) o JSON ({ id }). Misma auth,
 * comprobación de Origin y formato de respuesta que knowledge-upload (todo
 * en src/lib/knowledge-auth.ts). Borra la fila (los triggers limpian el FTS)
 * y la carpeta EXPEDIENTES_DIR/knowledge/<id>.
 */
import type { APIRoute } from 'astro';
import { rm } from 'node:fs/promises';
import { borrarDoc } from '@/lib/knowledge-db';
import { estaAutorizado, origenCoincide, dentroDeKnowledge, quiereJson, json, fallo, redirigirPanel } from '@/lib/knowledge-auth';

export const prerender = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function leerId(request: Request): Promise<string> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
    return typeof body?.id === 'string' ? body.id.trim() : '';
  }
  const form = await request.formData().catch(() => null);
  const id = form?.get('id');
  return typeof id === 'string' ? id.trim() : '';
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    if (!estaAutorizado(cookies, request)) return fallo(request, 'no_autorizado', 401);
    if (!origenCoincide(request)) return fallo(request, 'origen', 403);

    const id = await leerId(request);
    if (!UUID_RE.test(id)) return fallo(request, 'id', 400);

    const borrado = borrarDoc(id);
    // La carpeta solo se toca si la ruta queda contenida en knowledge/.
    try {
      await rm(dentroDeKnowledge(id), { recursive: true, force: true });
    } catch (err) {
      console.error('[knowledge-delete] no se pudo borrar la carpeta', id, err);
    }

    if (quiereJson(request)) return json({ ok: borrado, id });
    return redirigirPanel(new URLSearchParams({ borrado: borrado ? '1' : '0' }));
  } catch (err) {
    console.error('[knowledge-delete] error no controlado', err);
    return fallo(request, 'internal', 500);
  }
};
