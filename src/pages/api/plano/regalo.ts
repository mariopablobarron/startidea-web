/**
 * /api/plano/regalo — genera un regalo tangible (post de Instagram,
 * publicación de LinkedIn, letra de canción, informe SEO real).
 *
 * POST { tipo, datos:{...}, contexto?, audiencia?, pagina? }
 *   → { ok, tipo, titulo, cuerpo, extra? }
 *
 * Límites: 2 regalos por IP y día (SQLite, sobrevive reinicios) + tope
 * global diario (coste) + rate limit en memoria por minuto.
 */
import type { APIRoute } from 'astro';
import { rateLimit } from '@/lib/rate-limit';
import { getEnv } from '@/lib/env';
import { registrarEvento, registrarRegalo, regalosHoyPorIp, regalosHoyTotal } from '@/lib/plano-db';
import { generarRegalo, getRegalo, regalosActivos } from '@/lib/regalos';
import { getAudiencia } from '@/data/plano';

export const prerender = false;

const MAX_POR_IP_DIA = parseInt(getEnv('PLANO_REGALOS_POR_IP') || '2', 10);
const MAX_GLOBAL_DIA = parseInt(getEnv('PLANO_REGALOS_DIA') || '150', 10);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const MENSAJES_ERROR: Record<string, string> = {
  sin_modelo: 'El generador no está disponible ahora mismo. Escribe a hola@startidea.es y se prepara a mano.',
  tipo_desconocido: 'Ese regalo no existe.',
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!regalosActivos()) return json({ ok: false, error: 'desactivado', message: 'Los regalos no están disponibles por ahora.' }, 404);
  const ip = clientAddress || 'unknown';
  const limit = rateLimit({ key: ip, bucket: 'plano-regalo', maxHits: 4, windowMs: 60_000 });
  if (!limit.ok) return json({ ok: false, error: 'rate', message: 'Espera un momento antes de pedir otro.' }, 429);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'json' }, 400);
  }

  const tipo = typeof body.tipo === 'string' ? body.tipo : '';
  const regalo = getRegalo(tipo);
  if (!regalo) return json({ ok: false, error: 'tipo', message: MENSAJES_ERROR.tipo_desconocido }, 400);

  const datosRaw = (typeof body.datos === 'object' && body.datos) ? (body.datos as Record<string, unknown>) : {};
  const datos: Record<string, string> = {};
  for (const c of regalo.campos) {
    const v = datosRaw[c.id];
    datos[c.id] = typeof v === 'string' ? v.trim().slice(0, c.tipo === 'textarea' ? 800 : 300) : '';
    if (c.requerido && !datos[c.id]) return json({ ok: false, error: 'campos', message: `Falta: ${c.label.toLowerCase()}.` }, 400);
  }
  const contexto = typeof body.contexto === 'string' ? body.contexto.slice(0, 1500) : '';
  const audiencia = getAudiencia(typeof body.audiencia === 'string' ? body.audiencia : '')?.id ?? '';
  const pagina = typeof body.pagina === 'string' ? body.pagina.slice(0, 120) : '';

  if (regalosHoyPorIp(ip) >= MAX_POR_IP_DIA) {
    return json({ ok: false, error: 'limite', message: `Por hoy ya se han preparado ${MAX_POR_IP_DIA} regalos desde esta conexión. Mañana hay más. Si quieres algo a medida, 30 minutos con el equipo.` }, 429);
  }
  if (regalosHoyTotal() >= MAX_GLOBAL_DIA) {
    return json({ ok: false, error: 'limite_global', message: 'Hoy se ha llegado al máximo de regalos. Vuelve mañana o reserva 30 minutos.' }, 429);
  }

  try {
    const r = await generarRegalo(tipo, datos, contexto, getAudiencia(audiencia)?.label ?? '');
    registrarRegalo({ ip, tipo, datos, resultado: r.cuerpo, audiencia, ok: true });
    registrarEvento({ tipo: 'regalo', texto: `${tipo}: ${Object.values(datos).join(' · ')}`, destino: tipo, fuente: 'modelo', ip, pagina, audiencia });
    return json(r);
  } catch (err) {
    const code = (err as Error).message || 'error';
    registrarRegalo({ ip, tipo, datos, resultado: `ERROR ${code}`, audiencia, ok: false });
    console.error('[regalo] falló', tipo, code);
    if (code.startsWith('url_')) return json({ ok: false, error: 'url', message: `No se ha podido analizar esa web (${code.slice(4)}). Prueba con la dirección completa, con https://.` }, 400);
    if (code.startsWith('falta_')) return json({ ok: false, error: 'campos', message: 'Faltan datos para preparar el regalo.' }, 400);
    return json({ ok: false, error: 'generacion', message: MENSAJES_ERROR[code] ?? 'No se ha podido preparar ahora mismo. Inténtalo en un minuto o escribe a hola@startidea.es.' }, 502);
  }
};
