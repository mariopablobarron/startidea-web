/**
 * POST /api/admin/knowledge-upload — «Entrenar a Lazo» con documentos.
 *
 * Multipart: files (≤ 8, ≤ 15 MB cada uno, extensiones de la lista blanca),
 * titulo?, notas?. Guarda el original en EXPEDIENTES_DIR/knowledge/<docId>/,
 * extrae el texto, lo trocea e indexa en knowledge.db. Los embeddings solo
 * se calculan si PLANO_EMBEDDINGS=on (en segundo plano, best-effort).
 *
 * Auth, CSRF y formato de respuesta: ver src/lib/knowledge-auth.ts. Un
 * cliente con Accept: application/json recibe JSON; el formulario del panel
 * recibe un 303 a /admin/knowledge con subido/errores/detalle o error=<code>.
 *
 * Content-Length es obligatorio (411 si falta o no es un entero > 0): es la
 * única forma de acotar la subida ANTES de leer el cuerpo. Tope: 40 MB (413).
 */
import type { APIRoute } from 'astro';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { extractText, EXTENSIONES_SOPORTADAS } from '@/lib/knowledge-extract';
import { insertarDoc, embedChunksPendientes } from '@/lib/knowledge-db';
import { estaAutorizado, origenCoincide, dentroDeKnowledge, quiereJson, json, fallo, redirigirPanel } from '@/lib/knowledge-auth';

export const prerender = false;

const MAX_TOTAL_BYTES = 40 * 1024 * 1024; // toda la petición
const MAX_FILE_BYTES = 15 * 1024 * 1024; // por fichero
const MAX_FILES = 8;
/** Los errores por fichero viajan en la query del 303; se recortan a esto. */
const MAX_DETALLE = 600;
const EXT_OK = new Set<string>(EXTENSIONES_SOPORTADAS);

/**
 * Content-Length declarado, o null si falta o no es un entero positivo
 * (chunked, vacío, negativo, texto). Sin él no se acota nada antes de parsear.
 */
function leerContentLength(request: Request): number | null {
  const raw = request.headers.get('content-length');
  if (raw === null) return null;
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function limpiar(v: FormDataEntryValue | null, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  try {
    if (!estaAutorizado(cookies, request)) return fallo(request, 'no_autorizado', 401);
    if (!origenCoincide(request)) return fallo(request, 'origen', 403);

    const ip = getClientIp(request) || clientAddress || 'unknown';
    const rl = rateLimit({ key: ip, bucket: 'knowledge-upload', maxHits: 40, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return fallo(request, 'rate_limit', 429, { retry_after_s: rl.retryAfter }, { 'retry-after': String(rl.retryAfter) });
    }

    // Antes de request.formData(): sin longitud declarada no se lee el cuerpo.
    const declarado = leerContentLength(request);
    if (declarado === null) return fallo(request, 'sin_content_length', 411);
    if (declarado > MAX_TOTAL_BYTES) {
      return fallo(request, 'demasiado_grande', 413, { max_mb: MAX_TOTAL_BYTES / 1024 / 1024 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fallo(request, 'parse', 400);
    }

    const ficheros = form.getAll('files').filter((f): f is File => f instanceof File && !!f.name && f.size > 0);
    if (!ficheros.length) return fallo(request, 'sin_ficheros', 400);
    if (ficheros.length > MAX_FILES) return fallo(request, 'demasiados_ficheros', 400, { max: MAX_FILES });

    const titulo = limpiar(form.get('titulo'), 200);
    const notas = limpiar(form.get('notas'), 1000);

    const docs: { id: string; nombre: string; chars: number; n_chunks: number }[] = [];
    const errores: string[] = [];

    for (const f of ficheros) {
      const ext = extname(f.name).toLowerCase();
      if (!EXT_OK.has(ext)) { errores.push(`${f.name}: extensión no admitida`); continue; }
      if (f.size > MAX_FILE_BYTES) { errores.push(`${f.name}: supera ${MAX_FILE_BYTES / 1024 / 1024} MB`); continue; }

      const docId = randomUUID();
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || `documento${ext}`;
      let dir = '';
      try {
        dir = dentroDeKnowledge(docId);
        const destino = dentroDeKnowledge(docId, safeName);
        await mkdir(dir, { recursive: true });
        const buffer = Buffer.from(await f.arrayBuffer());
        await writeFile(destino, buffer);

        const texto = await extractText(buffer, ext);
        if (!texto) {
          await rm(dir, { recursive: true, force: true });
          errores.push(`${f.name}: sin texto legible (¿PDF escaneado sin OCR?)`);
          continue;
        }
        const r = insertarDoc({ id: docId, nombre: f.name.slice(0, 200), ext, titulo, notas, texto });
        docs.push({ id: r.id, nombre: f.name, chars: r.chars, n_chunks: r.n_chunks });
        // Embeddings en segundo plano (no-op salvo PLANO_EMBEDDINGS=on); el FTS ya está operativo.
        void embedChunksPendientes(docId);
      } catch (err) {
        console.error('[knowledge-upload]', f.name, err);
        if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
        errores.push(`${f.name}: ${err instanceof Error ? err.message : 'error'}`);
      }
    }

    if (quiereJson(request)) return json({ ok: docs.length > 0, docs, errores });
    const params = new URLSearchParams({ subido: String(docs.length) });
    if (errores.length) {
      params.set('errores', String(errores.length));
      params.set('detalle', errores.join(' · ').slice(0, MAX_DETALLE));
    }
    return redirigirPanel(params);
  } catch (err) {
    console.error('[knowledge-upload] error no controlado', err);
    return fallo(request, 'internal', 500);
  }
};
