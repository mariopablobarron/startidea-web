/**
 * knowledge-auth.ts — helpers compartidos por los endpoints de «Entrenar a
 * Lazo» (/api/admin/knowledge-upload y /api/admin/knowledge-delete).
 *
 * Viven aquí y no en un fichero de ruta: cada fichero de src/pages/api es un
 * módulo de ruta de Astro y que un endpoint importe de otro es frágil (el
 * bundler puede duplicarlo o arrastrar side-effects de la ruta).
 *
 * - estaAutorizado: cookie de sesión admin O cabecera x-admin-token
 *   (sha256 del ADMIN_TOKEN, como el resto del panel).
 * - origenCoincide: CSRF mínimo — si llega Origin, debe apuntar al host.
 * - knowledgeRoot / dentroDeKnowledge: rutas contenidas en
 *   EXPEDIENTES_DIR/knowledge (anti path-traversal).
 * - quiereJson / json / fallo / redirigirPanel: respuestas uniformes. Un
 *   cliente API (Accept: application/json) recibe JSON con status real; el
 *   formulario del panel recibe un 303 a /admin/knowledge con el código de
 *   error en la query para pintarlo como frase legible.
 */
import type { AstroCookies } from 'astro';
import { resolve, sep } from 'node:path';
import { isAdminLoggedIn, isValidAdminHeader } from '@/lib/admin-session';

/** Página del panel a la que vuelven los formularios. */
export const PANEL_KNOWLEDGE = '/admin/knowledge';

export function estaAutorizado(cookies: AstroCookies, request: Request): boolean {
  if (isAdminLoggedIn(cookies)) return true;
  const header = request.headers.get('x-admin-token') ?? '';
  return !!header && isValidAdminHeader(header);
}

/** Si la petición trae Origin, debe apuntar al mismo host (CSRF mínimo). */
export function origenCoincide(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  let host = '';
  try { host = new URL(origin).host; } catch { return false; }
  const aceptados = new Set<string>();
  try { aceptados.add(new URL(request.url).host); } catch { /* sin url */ }
  const h = request.headers.get('host');
  if (h) aceptados.add(h);
  const xfh = request.headers.get('x-forwarded-host');
  if (xfh) xfh.split(',').forEach((v) => aceptados.add(v.trim()));
  return aceptados.has(host);
}

/** Directorio raíz de los originales; se crea al primer uso. */
export function knowledgeRoot(): string {
  return resolve(process.env.EXPEDIENTES_DIR ?? '/data/expedientes', 'knowledge');
}

/** Ruta contenida dentro del root o error (anti path-traversal). */
export function dentroDeKnowledge(...segmentos: string[]): string {
  const base = knowledgeRoot();
  const target = resolve(base, ...segmentos);
  if (target === base || !target.startsWith(base + sep)) throw new Error('knowledge_path_outside_root');
  return target;
}

/** true si el cliente pide JSON (Accept con application/json). */
export function quiereJson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('application/json');
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/** 303 al panel con los parámetros dados (subido, errores, detalle, error…). */
export function redirigirPanel(params: URLSearchParams): Response {
  const qs = params.toString();
  return new Response(null, { status: 303, headers: { location: qs ? `${PANEL_KNOWLEDGE}?${qs}` : PANEL_KNOWLEDGE } });
}

/**
 * Respuesta de error uniforme.
 * - Si la petición pide JSON: { ok: false, error: code, ...extra } con el
 *   status real (y las cabeceras extra, p. ej. retry-after).
 * - Si no (formulario del panel): 303 a /admin/knowledge?error=<code>, que
 *   la página traduce a una frase legible.
 */
export function fallo(
  request: Request,
  code: string,
  status: number,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  if (quiereJson(request)) return json({ ok: false, error: code, ...extra }, status, headers);
  return redirigirPanel(new URLSearchParams({ error: code }));
}
