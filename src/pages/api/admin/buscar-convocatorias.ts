/**
 * /api/admin/buscar-convocatorias
 *
 * Búsqueda web en vivo (Tavily) de convocatorias/ayudas abiertas relacionadas
 * con un expediente, restringida a fuentes oficiales. On-demand desde el panel
 * admin (coste controlado). No persiste nada: devuelve resultados al vuelo.
 *
 * POST { id }  →  { ok, query, answer, results: [{ title, url, content, score }] }
 * Auth: x-admin-token (o sesión admin por cookie).
 * Requiere TAVILY_API_KEY en el entorno; si falta, 503 claro.
 */
import type { APIRoute } from 'astro';
import { isValidAdminHeader, isAdminLoggedIn } from '@/lib/admin-session';
import { getExpediente } from '@/lib/expedientes-db';
import { tavilySearch, isTavilyConfigured } from '@/lib/tavily';

export const prerender = false;

// Fuentes oficiales de convocatorias (BOJA/Junta, BDNS, BOE, Diputación Granada).
const DOMINIOS_OFICIALES = [
  'juntadeandalucia.es',
  'infosubvenciones.es',
  'pap.hacienda.gob.es',
  'boe.es',
  'dipgra.es',
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminLoggedIn(cookies) && !isValidAdminHeader(request.headers.get('x-admin-token') ?? '')) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  if (!isTavilyConfigured()) {
    return json({
      ok: false,
      error: 'no_configurado',
      detail: 'Falta TAVILY_API_KEY en el .env del container. Setéala en Coolify.',
    }, 503);
  }

  let id = '';
  try {
    const body = (await request.json()) as { id?: string };
    id = (body.id ?? '').trim();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  if (!id) return json({ ok: false, error: 'id_required' }, 400);

  const exp = getExpediente(id);
  if (!exp) return json({ ok: false, error: 'expediente_no_encontrado' }, 404);

  // Query natural a partir de los datos del expediente.
  const query = [
    'convocatorias y subvenciones abiertas',
    exp.org_tipo || '',
    exp.provincia ? `en ${exp.provincia}` : '',
    (exp.descripcion_proyecto || exp.convocatoria_title || '').slice(0, 160),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  try {
    const r = await tavilySearch(query, {
      maxResults: 6,
      searchDepth: 'advanced',
      includeAnswer: true,
      includeDomains: DOMINIOS_OFICIALES,
    });
    return json({ ok: true, query, answer: r.answer, results: r.results });
  } catch (e) {
    return json({
      ok: false,
      error: 'tavily_error',
      detail: e instanceof Error ? e.message : String(e),
    }, 502);
  }
};
