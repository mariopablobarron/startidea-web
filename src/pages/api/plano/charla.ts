/**
 * /api/plano/charla — un turno de conversación del consejero del Plano.
 *
 * POST { messages: [{role, content}], audiencia?, pagina? }
 *   → { ok, reply, estaciones:[{id,label,url,linea}], intencion, regalo, cierre }
 *
 * El historial viaja desde el cliente (sessionStorage), como en /api/chat.
 * Cada turno se registra anonimizado (tipo 'charla': texto = lo que dijo
 * la persona, respuesta = lo que contestó el asistente).
 */
import type { APIRoute } from 'astro';
import { rateLimit } from '@/lib/rate-limit';
import { registrarEvento } from '@/lib/plano-db';
import { charlar, sanitizarHistorial, MAX_TURNOS_USUARIO } from '@/lib/plano-charla';
import { getAudiencia, getEstacion } from '@/data/plano';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || 'unknown';
  const limit = rateLimit({ key: ip, bucket: 'plano-charla', maxHits: 12, windowMs: 60_000 });
  if (!limit.ok) return json({ ok: false, error: 'rate', message: 'Vas muy rápido. Espera un momento y seguimos.' }, 429);
  const limitDia = rateLimit({ key: ip, bucket: 'plano-charla-dia', maxHits: 80, windowMs: 24 * 3_600_000 });
  if (!limitDia.ok) return json({ ok: false, error: 'rate_dia', message: 'Por hoy es suficiente conversación. Si quieres seguir, reserva 30 minutos con el equipo.' }, 429);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'json' }, 400);
  }

  const messages = sanitizarHistorial(body.messages);
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return json({ ok: false, error: 'empty' }, 400);
  const turnos = messages.filter((m) => m.role === 'user').length;
  if (turnos > MAX_TURNOS_USUARIO + 1) return json({ ok: false, error: 'fin', message: 'Esta conversación ya llegó a su cierre. Reserva 30 minutos y seguimos en persona.' }, 400);

  const audiencia = getAudiencia(typeof body.audiencia === 'string' ? body.audiencia : '')?.id ?? '';
  const pagina = typeof body.pagina === 'string' ? body.pagina.slice(0, 120) : '';

  const turno = await charlar(messages, audiencia);

  registrarEvento({
    tipo: 'charla',
    texto: messages[messages.length - 1].content,
    respuesta: turno.reply,
    intencion: turno.intencion,
    estaciones: turno.estaciones,
    fuente: turno.fuente,
    destino: turno.regalo ? `regalo:${turno.regalo}` : (turno.cierre ? 'cierre' : ''),
    ip,
    pagina,
    audiencia,
  });

  return json({
    ok: true,
    reply: turno.reply,
    estaciones: turno.estaciones.map((id) => {
      const e = getEstacion(id)!;
      return { id, label: e.label, url: e.url, linea: e.lineas[0] };
    }),
    intencion: turno.intencion,
    regalo: turno.regalo,
    cierre: turno.cierre,
    turnos,
    maxTurnos: MAX_TURNOS_USUARIO,
  });
};
