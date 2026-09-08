/**
 * regalos.ts — lo tangible del Plano Startidea: cosas prácticas que la IA
 * genera al momento y la persona se lleva, como muestra de cómo trabaja
 * Startidea. Límite por IP y día (plano-db) y tope global diario.
 *
 * Cada regalo define sus campos (para el mini formulario del cliente), cómo
 * se prepara el prompt y qué devuelve. El informe SEO es REAL: analiza la
 * URL con seo-mini.ts y el modelo redacta a partir de hechos, no inventa.
 */
import { pickModel } from '@/lib/model-router';
import { getEnv } from '@/lib/env';
import { BRAND_CONSTITUTION } from '@/lib/brand-constitution';
import { analizarUrl, hechosParaModelo, type HechosSeo } from '@/lib/seo-mini';

export interface CampoRegalo {
  id: string;
  label: string;
  placeholder: string;
  /** 'text' | 'url' | 'textarea' */
  tipo: 'text' | 'url' | 'textarea';
  requerido?: boolean;
}

export interface Regalo {
  id: string;
  nombre: string;
  /** Para el modelo y para el tooltip. */
  descripcion: string;
  campos: CampoRegalo[];
}

export const REGALOS: Regalo[] = [
  {
    id: 'post-instagram',
    nombre: 'Una creatividad para tu Instagram',
    descripcion: 'titular, texto, hashtags y concepto visual de una publicación, con vista previa descargable',
    campos: [
      { id: 'organizacion', label: 'Tu organización o proyecto', placeholder: 'Ej.: Clínica Dental Sol, Asociación Aldaima…', tipo: 'text', requerido: true },
      { id: 'tema', label: 'De qué va la publicación', placeholder: 'Ej.: abrimos consulta los sábados / campaña de familias acogedoras', tipo: 'textarea', requerido: true },
    ],
  },
  {
    id: 'publicacion-linkedin',
    nombre: 'Una publicación para LinkedIn',
    descripcion: 'una publicación de LinkedIn con voz propia, lista para pegar',
    campos: [
      { id: 'organizacion', label: 'Tu organización o proyecto', placeholder: 'Ej.: Fundación X, Ayuntamiento de…', tipo: 'text', requerido: true },
      { id: 'tema', label: 'Qué quieres contar', placeholder: 'Ej.: hemos cerrado el primer año del programa de empleo…', tipo: 'textarea', requerido: true },
    ],
  },
  {
    id: 'cancion',
    nombre: 'La letra de una canción sobre tu proyecto',
    descripcion: 'letra con estructura (estrofas y estribillo) para un evento, un vídeo o una campaña',
    campos: [
      { id: 'organizacion', label: 'Tu organización o proyecto', placeholder: 'Ej.: Coro de la parroquia, Startup Verde…', tipo: 'text', requerido: true },
      { id: 'tema', label: 'De qué habla y para qué es', placeholder: 'Ej.: himno para la gala anual, sobre 20 años acompañando familias', tipo: 'textarea', requerido: true },
      { id: 'estilo', label: 'Estilo (opcional)', placeholder: 'Ej.: pop luminoso, rumba, balada', tipo: 'text' },
    ],
  },
  {
    id: 'informe-seo',
    nombre: 'Un informe rápido y real de tu web',
    descripcion: 'se analiza la URL de verdad (title, description, H1, imágenes, enlaces, robots, sitemap, velocidad) y se entregan los tres arreglos que más cambian',
    campos: [
      { id: 'url', label: 'La dirección de tu web', placeholder: 'https://tuweb.es', tipo: 'url', requerido: true },
    ],
  },
];

export function esTipoRegalo(id: string): boolean {
  return REGALOS.some((r) => r.id === id);
}
export function getRegalo(id: string): Regalo | undefined {
  return REGALOS.find((r) => r.id === id);
}

export interface ResultadoRegalo {
  ok: true;
  tipo: string;
  titulo: string;
  /** Texto principal en Markdown ligero (párrafos, **negritas**, listas con «- »). */
  cuerpo: string;
  /** Datos extra para render especial (tarjeta Instagram, hechos SEO). */
  extra?: Record<string, unknown>;
}

const SITE_URL = 'https://startidea.es';

async function llm(system: string, user: string, maxTokens: number, json = false): Promise<string> {
  const apiKey = getEnv('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('sin_modelo');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 40_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': SITE_URL,
        'X-Title': 'Startidea Plano · regalo',
      },
      body: JSON.stringify({
        model: getEnv('MODELO_REGALOS') || pickModel('redaccion'),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: maxTokens,
        temperature: 0.7,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content ?? '').trim();
  } finally {
    clearTimeout(timer);
  }
}

function campo(datos: Record<string, string>, id: string, max = 400): string {
  return (datos[id] ?? '').toString().trim().slice(0, max);
}

const BASE = `Eres el equipo creativo de Startidea (agencia de comunicación e innovación social, Granada). Escribes en español neutro, directo, sin clickbait ni jerga vacía, sin exclamaciones gratuitas. Este texto es un REGALO que la persona se lleva de la web de Startidea: tiene que ser útil tal cual, con su voz, no con la de Startidea. No menciones a Startidea dentro del contenido. No inventes datos, cifras ni nombres que la persona no haya dado.\n\n${BRAND_CONSTITUTION}`;

export async function generarRegalo(tipo: string, datos: Record<string, string>, contexto: string, audiencia: string): Promise<ResultadoRegalo> {
  const r = getRegalo(tipo);
  if (!r) throw new Error('tipo_desconocido');
  for (const c of r.campos) {
    if (c.requerido && !campo(datos, c.id)) throw new Error(`falta_${c.id}`);
  }
  const ctx = contexto ? `\n\nContexto de la conversación previa (para el tono y el enfoque, no lo cites): ${contexto.slice(0, 1200)}` : '';
  const aud = audiencia ? `\nTipo de organización: ${audiencia}.` : '';

  if (tipo === 'post-instagram') {
    const raw = await llm(
      `${BASE}\n\nDevuelve SOLO JSON: {"titular":"<máx 8 palabras, para ir sobre la imagen>","texto":"<caption de 60-110 palabras, con una llamada a la acción clara, sin hashtags>","hashtags":["<8-12 hashtags sin #>"],"concepto_visual":"<2 frases: qué foto o composición, colores, encuadre>","alt":"<texto alternativo de la imagen, 1 frase>"}`,
      `Organización: ${campo(datos, 'organizacion')}.${aud}\nDe qué va la publicación: ${campo(datos, 'tema', 800)}${ctx}`,
      700, true,
    );
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Record<string, unknown>;
    const hashtags = Array.isArray(p.hashtags) ? (p.hashtags as unknown[]).map((h) => String(h).replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 12) : [];
    const titular = String(p.titular ?? '').slice(0, 80);
    const texto = String(p.texto ?? '').slice(0, 1200);
    return {
      ok: true, tipo, titulo: r.nombre,
      cuerpo: `**${titular}**\n\n${texto}\n\n${hashtags.map((h) => `#${h}`).join(' ')}\n\n**Concepto visual.** ${String(p.concepto_visual ?? '')}`,
      extra: { titular, texto, hashtags, concepto_visual: p.concepto_visual, alt: p.alt, organizacion: campo(datos, 'organizacion') },
    };
  }

  if (tipo === 'publicacion-linkedin') {
    const texto = await llm(
      `${BASE}\n\nEscribe UNA publicación de LinkedIn de 120-200 palabras en primera persona (o en nombre de la organización si es institucional). Primera línea que haga parar el scroll sin trucos. Párrafos cortos. Una idea, no cinco. Cierra con una pregunta o una invitación concreta. Sin hashtags o como mucho tres al final. Devuelve solo el texto.`,
      `Organización: ${campo(datos, 'organizacion')}.${aud}\nQué quiere contar: ${campo(datos, 'tema', 800)}${ctx}`,
      600,
    );
    return { ok: true, tipo, titulo: r.nombre, cuerpo: texto.slice(0, 2500) };
  }

  if (tipo === 'cancion') {
    const texto = await llm(
      `${BASE}\n\nEscribe la LETRA de una canción original: dos o tres estrofas y un estribillo que se repita, en español, cantable (versos de 8-11 sílabas, rima asonante suficiente). Título en la primera línea con formato "**Título**". Marca las partes con "Estrofa 1", "Estribillo", etc. en líneas propias. Nada de explicaciones. Es original: no copies ninguna canción existente.`,
      `Organización o proyecto: ${campo(datos, 'organizacion')}.${aud}\nDe qué habla y para qué es: ${campo(datos, 'tema', 800)}\nEstilo: ${campo(datos, 'estilo') || 'el que mejor encaje'}${ctx}`,
      900,
    );
    return { ok: true, tipo, titulo: r.nombre, cuerpo: texto.slice(0, 4000) };
  }

  if (tipo === 'informe-seo') {
    let hechos: HechosSeo;
    try {
      hechos = await analizarUrl(campo(datos, 'url', 300));
    } catch (err) {
      throw new Error(`url_${(err as Error).message}`);
    }
    const texto = await llm(
      `${BASE}\n\nEres además consultor SEO. Te paso HECHOS medidos de una página. Redacta un informe breve y honesto en Markdown ligero con este esquema exacto:\n**Lo que está bien** (2-3 puntos, solo si de verdad lo están)\n**Lo que frena** (los avisos importantes, explicados en una frase cada uno, sin tecnicismos sin traducir)\n**Los tres arreglos que más cambian** (numerados, concretos, con el porqué en una frase y quién puede hacerlo: la propia persona o un técnico)\n**Nota** (una frase: qué NO mide este informe rápido: posicionamiento real, velocidad en móvil, competencia).\nNo inventes nada que no esté en los hechos. Máximo 260 palabras.`,
      hechosParaModelo(hechos),
      800,
    );
    return {
      ok: true, tipo, titulo: `${r.nombre}: ${new URL(hechos.urlFinal).hostname}`,
      cuerpo: texto.slice(0, 4000),
      extra: { hechos },
    };
  }

  throw new Error('tipo_desconocido');
}
