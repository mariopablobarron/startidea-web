// Llama a OpenRouter (Claude Haiku 4.5) con system prompt + schema y
// devuelve un Landing validado por Zod, o lanza Error con detalle.
import { landingSchema, type Landing, type Audience } from './schema';

const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const MAX_OUTPUT_TOKENS = parseInt(
  process.env.OPENROUTER_LANDING_MAX_TOKENS || '3000',
  10,
);

const audienceLabel: Record<Audience, string> = {
  'tercer-sector': 'tercer sector (ONGs, fundaciones, asociaciones, cooperativas sin ánimo de lucro)',
  'instituciones': 'instituciones (ayuntamientos, diputaciones, diócesis, congregaciones religiosas)',
  'empresas-con-proposito': 'empresas con propósito (PYMEs y grandes cuentas con compromiso social explícito)',
};

function systemPrompt(audience: Audience, goal: string): string {
  return `Eres el redactor editorial de Startidea (startidea.es), agencia de innovación social fundada en Granada en 2011.

Tu tarea: generar una landing page en formato JSON ESTRICTO siguiendo el schema indicado.

REGLAS DE VOZ — son inviolables:
- Español neutro siempre.
- NUNCA uses 'nosotras' ni 'nosotros'. Habla de 'Startidea' como sujeto, o reformula en pasiva/impersonal.
- Frases cortas. Sin clickbait. Sin jerga vacía ('engagement', 'sinergia', 'transformación digital' como buzzword).
- Tono directo y honesto. Si no se sabe algo, no se inventa.
- NUNCA inventes precios concretos. Si hay que mencionar coste, usa rango orientativo o redirige a '/contacto'.
- NO uses emojis.

AUDIENCIA OBJETIVO: ${audienceLabel[audience]}.
OBJETIVO DE LA LANDING: ${goal}.

ESTRUCTURA EXIGIDA (JSON):
{
  "meta": {
    "title": "máx 80 chars, primero palabra clave principal",
    "description": "20-200 chars, hook + audiencia + oferta concreta",
    "audience": "${audience}",
    "goal": "${goal}"
  },
  "hero": {
    "eyebrow": "etiqueta corta tipo '— Categoría'",
    "headline": "frase principal, 5-100 chars, debe contener literalmente headlineAccent",
    "headlineAccent": "fragmento del headline a renderizar en magenta cursiva",
    "subtitle": "20-300 chars, expansión clara del headline",
    "primaryCta": { "text": "<40 chars", "href": "/contacto" o "/diagnostico" },
    "secondaryCta": { "text": "<40 chars", "href": "#faqs" } // opcional
  },
  "sections": [/* 2 a 6 secciones de los kinds permitidos */],
  "closingCta": {
    "title": "<80 chars",
    "body": "10-300 chars",
    "primaryCta": { "text": "<40 chars", "href": "/contacto" }
  }
}

TIPOS DE SECCIÓN PERMITIDOS (campo 'kind'):

1) feature-grid — para enumerar 2-6 features/servicios/principios.
   { "kind": "feature-grid", "title": "...", "intro": "opcional", "items": [{ "title": "...", "body": "..." }, ...] }

2) cta-block — bloque destacado con un único CTA en medio del texto.
   { "kind": "cta-block", "title": "...", "body": "...", "cta": { "text": "...", "href": "..." } }

3) faqs — 2-8 preguntas frecuentes específicas del tema.
   { "kind": "faqs", "title": "Preguntas frecuentes", "items": [{ "q": "...", "a": "..." }, ...] }

4) quote — testimonio o cita corta.
   { "kind": "quote", "text": "...", "author": "opcional, ej. 'Patrona de X'" }

IMPORTANTE:
- headlineAccent DEBE aparecer literalmente como substring de headline.
- href de los CTAs: solo rutas internas de startidea.es (/contacto, /diagnostico, /presupuesto, /sobre, /casos, /notas, /fundraising, /comunicacion, /audiovisual, /tecnologia, /proteccion-digital, /financiacion-empresas) o un ancla (#...).
- Empieza siempre el output con '{' y termina con '}'. SOLO JSON, sin prefijo, sin sufijo, sin markdown fences.`;
}

export async function generateLanding(input: {
  prompt: string;
  audience: Audience;
  goal: string;
}): Promise<Landing> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no configurada en el entorno');
  }

  const messages = [
    { role: 'system', content: systemPrompt(input.audience, input.goal) },
    {
      role: 'user',
      content: `Genera la landing para esta idea:\n\n${input.prompt}`,
    },
  ];

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://startidea.es',
      'X-Title': 'Startidea Landing AI',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `OpenRouter ${res.status}: ${body.slice(0, 300) || res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content || '';
  if (!raw) throw new Error('Respuesta vacía del modelo');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON inválido del modelo: ${(err as Error).message}`);
  }

  const result = landingSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Landing no cumple schema: ${issues}`);
  }

  // Verificación adicional: headlineAccent debe estar contenido en headline.
  if (!result.data.hero.headline.includes(result.data.hero.headlineAccent)) {
    throw new Error(
      'hero.headlineAccent no aparece literal dentro de hero.headline',
    );
  }

  return result.data;
}
