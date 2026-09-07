/**
 * /api/plano — backend del «Plano Startidea» (hero del prototipo
 * /lab/home-plano).
 *
 * POST { tipo: 'pregunta', texto }        → clasifica y devuelve la ruta
 * POST { tipo: 'atajo'|'estacion'|'clic', intencion?, estaciones?, destino? }
 *                                          → solo registra (sin modelo)
 *
 * Solo el texto libre llama al modelo (Haiku por defecto vía OpenRouter),
 * con salida JSON estricta y el catálogo de estaciones como único universo.
 * Si no hay API key, el modelo falla o devuelve algo inválido, cae a la
 * clasificación por patrones de `src/data/plano.ts`. Nunca inventa URLs:
 * las estaciones que devuelve el modelo se validan contra el catálogo.
 */
import type { APIRoute } from 'astro';
import { pickModel } from '@/lib/model-router';
import { rateLimit } from '@/lib/rate-limit';
import { getEnv } from '@/lib/env';
import { registrarEvento } from '@/lib/plano-db';
import {
  INTENCIONES,
  catalogoParaModelo,
  clasificarPorPatron,
  getEstacion,
  getIntencion,
  getAudiencia,
} from '@/data/plano';

export const prerender = false;

const MODEL = getEnv('MODELO_PLANO') || pickModel('clasificacion');
const SITE_URL = 'https://startidea.es';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function clean(s: unknown, max = 500): string {
  return typeof s === 'string' ? s.trim().slice(0, max) : '';
}

interface Ruta {
  intencion: string;
  say: string;
  estaciones: string[];
  fuente: 'modelo' | 'patron' | 'ninguna';
}

const SIN_RUTA: Ruta = {
  intencion: '',
  say: 'No hay una ruta clara para eso en el plano. Cuéntalo en treinta minutos: Startidea te dice honestamente si es el partner adecuado y, si no, quién sí.',
  estaciones: [],
  fuente: 'ninguna',
};

function rutaPorPatron(texto: string): Ruta {
  const i = clasificarPorPatron(texto);
  if (!i) return SIN_RUTA;
  return { intencion: i.id, say: i.say, estaciones: i.estaciones, fuente: 'patron' };
}

async function rutaPorModelo(texto: string, audiencia: string): Promise<Ruta | null> {
  const apiKey = getEnv('OPENROUTER_API_KEY');
  if (!apiKey) return null;

  const system = `Eres el guía del «Plano Startidea», el mapa de servicios de Startidea (agencia de comunicación e innovación social en Granada). Trabaja con cuatro públicos por igual: empresas (pymes, grandes empresas, startups, autónomos), instituciones (públicas, educativas, sanitarias, eclesiales), entidades sociales (asociaciones, fundaciones, cooperativas, ONG, redes) y personas que emprenden. No des por hecho que quien escribe es una ONG ni que busca captar fondos: escucha lo que dice. El visitante escribe qué necesita su organización o proyecto y tú eliges hasta 3 estaciones del catálogo y escribes UNA frase de orientación (máximo 30 palabras), en español neutro, sin "nosotros" ni "nosotras", hablando de Startidea en tercera persona.

Intenciones posibles (elige una): ${INTENCIONES.map((i) => i.id).join(', ')}. Si el texto no encaja con ningún servicio (spam, otro tema, sin sentido), devuelve intencion "" y estaciones [].

Catálogo de estaciones (usa SOLO estos ids):
${catalogoParaModelo()}

Responde SOLO con JSON válido, sin texto alrededor, con esta forma exacta:
{"intencion":"<id o vacío>","say":"<frase>","estaciones":["<id>","<id>"]}`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': SITE_URL,
        'X-Title': 'Startidea Plano',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: (audiencia ? `[Se identifica como: ${audiencia}] ` : '') + texto },
        ],
        max_tokens: 220,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      console.error('[plano] upstream', res.status, (await res.text().catch(() => '')).slice(0, 300));
      return null;
    }
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { intencion?: unknown; say?: unknown; estaciones?: unknown };

    const estaciones = Array.isArray(parsed.estaciones)
      ? (parsed.estaciones as unknown[]).filter((id): id is string => typeof id === 'string' && !!getEstacion(id)).slice(0, 3)
      : [];
    const intencionId = typeof parsed.intencion === 'string' && getIntencion(parsed.intencion) ? parsed.intencion : '';
    const say = clean(parsed.say, 240);

    if (estaciones.length === 0) return { ...SIN_RUTA, fuente: 'modelo' };
    return {
      intencion: intencionId,
      say: say || getIntencion(intencionId)?.say || 'Esta es la ruta que mejor encaja con lo que cuentas.',
      estaciones,
      fuente: 'modelo',
    };
  } catch (err) {
    console.error('[plano] modelo falló', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || 'unknown';
  const limit = rateLimit({ key: ip, bucket: 'plano', maxHits: 20, windowMs: 60_000 });
  if (!limit.ok) return json({ ok: false, error: 'rate', message: 'Demasiadas consultas seguidas. Espera un momento.' }, 429);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'json' }, 400);
  }

  const tipo = clean(body.tipo, 20);
  const pagina = clean(body.pagina, 120);
  const audiencia = getAudiencia(clean(body.audiencia, 30))?.id ?? '';

  if (tipo === 'atajo' || tipo === 'estacion' || tipo === 'clic') {
    const estaciones = Array.isArray(body.estaciones)
      ? (body.estaciones as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 5)
      : [];
    registrarEvento({
      tipo,
      intencion: clean(body.intencion, 40),
      estaciones,
      destino: clean(body.destino, 200),
      fuente: 'mapa',
      ip,
      pagina,
      audiencia,
    });
    return json({ ok: true });
  }

  if (tipo !== 'pregunta') return json({ ok: false, error: 'tipo' }, 400);

  const texto = clean(body.texto, 500);
  if (texto.length < 3) return json({ ok: false, error: 'empty' }, 400);

  const ruta = (await rutaPorModelo(texto, getAudiencia(audiencia)?.label ?? '')) ?? rutaPorPatron(texto);

  registrarEvento({
    tipo: 'pregunta',
    texto,
    intencion: ruta.intencion,
    estaciones: ruta.estaciones,
    fuente: ruta.fuente,
    ip,
    pagina,
    audiencia,
  });

  return json({
    ok: true,
    intencion: ruta.intencion,
    say: ruta.say,
    estaciones: ruta.estaciones.map((id) => {
      const e = getEstacion(id)!;
      return { id, label: e.label, url: e.url, linea: e.lineas[0] };
    }),
  });
};
