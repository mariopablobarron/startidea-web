/**
 * bdns-enrich.ts — extracción de campos desde el PDF oficial de BDNS.
 *
 * El scraper deja gastos_ok/gastos_no/requisitos/importe_detalle vacíos a
 * propósito: la API de BDNS no los da en campos. Pero sí adjunta el PDF
 * oficial de la convocatoria (texto de la resolución/orden), y ahí están.
 * Este módulo baja ese PDF, extrae el texto (pdf-parse, ya en el proyecto)
 * y se lo pasa a Haiku con una regla dura: SOLO puede afirmar lo que esté
 * en el texto — un campo sin respaldo se devuelve vacío. El resultado
 * pre-rellena la ficha (que sigue entrando con activa=0), y la revisión
 * humana en /admin/convocatorias sigue siendo la puerta de publicación.
 *
 * Validado a mano el 2026-08-22: el mismo enfoque (PDF oficial + extracción
 * con cita) produjo las 7 fichas curadas del catálogo sin un solo dato
 * inventado que sobreviviera a la verificación adversarial.
 */
import { createRequire } from 'node:module';
import { pickModel } from '@/lib/model-router';

const _require = createRequire(import.meta.url);

const BDNS_API = 'https://www.infosubvenciones.es/bdnstrans/api';
const MAX_PDF_BYTES = 25 * 1024 * 1024; // la Orden del Plan Corresponsables pesa 12,9 MB
const MAX_TEXT_CHARS = 120_000; // ~35k tokens de entrada en Haiku: céntimos

export interface EnrichedFields {
  tipo_entidades: string;
  financia_resumen: string[];
  gastos_ok: string[];
  gastos_no: string[];
  requisitos: string[];
  importe_min: number | null;
  importe_max: number | null;
  importe_range: string;
  importe_detalle: string;
  /** Fin de plazo según el TEXTO del PDF (YYYY-MM-DD), para contrastar con el
   *  de BDNS — que a veces es la fecha genérica del ejercicio. */
  plazo_fin_iso: string | null;
}

export interface EnrichOutcome {
  ok: boolean;
  fields?: EnrichedFields;
  /** motivo cuando ok=false: sin-documento | sin-texto | sin-api-key | error técnico */
  error?: string;
}

interface BDNSDocumento {
  id?: number;
  descripcion?: string;
  nombreFic?: string;
  long?: number;
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'startidea-scraper/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM = [
  'Extraes datos de convocatorias de subvenciones públicas españolas a partir del texto oficial (resolución/orden publicada).',
  'REGLA DE ORO: usa EXCLUSIVAMENTE lo que diga el texto. Un campo que el texto no respalde se devuelve vacío ("" o [] o null).',
  'NUNCA completes con conocimiento general, con lo habitual en convocatorias parecidas ni con suposiciones: estas fichas hablan de dinero público y un dato plausible inventado es un fallo grave; un hueco es correcto.',
  'Si el documento cubre varias líneas o programas, extrae SOLO lo aplicable a la línea que se te indique; si no se puede distinguir, deja el campo vacío.',
  'Responde SIEMPRE con JSON válido, sin texto fuera del bloque.',
].join(' ');

function buildPrompt(titulo: string, texto: string): string {
  return [
    `CONVOCATORIA (según BDNS): ${titulo}`,
    '',
    'TAREA: extrae del texto oficial estos campos. Frases cortas, español neutro, sin primera persona del plural.',
    '- tipo_entidades: qué entidades pueden solicitar (forma jurídica, registros exigidos, ámbito territorial). "" si no consta.',
    '- financia_resumen: 2-4 bullets con qué financia. [] si no consta.',
    '- gastos_ok: gastos subvencionables (bullets). [] si no consta.',
    '- gastos_no: gastos NO subvencionables (bullets). [] si no consta.',
    '- requisitos: requisitos concretos para solicitar (bullets). [] si no consta.',
    '- importe_min / importe_max: euros POR BENEFICIARIO según el texto (NO el crédito total de la convocatoria). null si el texto no fija cuantías por beneficiario.',
    '- importe_range: representación corta ("hasta 30.000 €", "3.000 € – 80.000 €"). "" si no hay cuantías por beneficiario.',
    '- importe_detalle: qué dice el texto sobre cuantías y porcentajes (si menciona el crédito total, etiquétalo como crédito total, nunca como importe por beneficiario). "" si no consta.',
    '- plazo_fin_iso: fecha fin del plazo de solicitud que fije el TEXTO, en formato YYYY-MM-DD. Si el texto solo da una regla relativa ("X días desde la publicación del extracto") o no lo fija, null.',
    '',
    'FORMATO (JSON estricto):',
    '{"tipo_entidades":"...","financia_resumen":[],"gastos_ok":[],"gastos_no":[],"requisitos":[],"importe_min":null,"importe_max":null,"importe_range":"","importe_detalle":"","plazo_fin_iso":null}',
    '',
    'TEXTO OFICIAL (puede estar truncado):',
    texto,
  ].join('\n');
}

/**
 * Enriquece una convocatoria BDNS bajando su PDF oficial y extrayendo los
 * campos con IA. No toca la base de datos: devuelve los campos y el caller
 * decide el merge.
 */
export async function enrichFromPdf(
  codigoBDNS: string,
  tituloContexto: string,
  opts: { timeoutMs?: number } = {},
): Promise<EnrichOutcome> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const orKey = import.meta.env.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;
  if (!orKey) return { ok: false, error: 'sin-api-key' };

  // 1. Detalle BDNS → documentos adjuntos
  let docs: BDNSDocumento[];
  try {
    const detail = (await fetchJson(
      `${BDNS_API}/convocatorias?vpd=GE&numConv=${encodeURIComponent(codigoBDNS)}`,
      timeoutMs,
    )) as { documentos?: BDNSDocumento[] };
    docs = detail.documentos ?? [];
  } catch (e) {
    return { ok: false, error: `detalle: ${e instanceof Error ? e.message : String(e)}` };
  }
  // Preferir el texto en castellano de la convocatoria; si no, el primero
  const doc =
    docs.find((d) => /castellano/i.test(d.descripcion ?? '')) ?? docs[0];
  if (!doc?.id) return { ok: false, error: 'sin-documento' };
  if ((doc.long ?? 0) > MAX_PDF_BYTES) return { ok: false, error: 'pdf-demasiado-grande' };

  // 2. Descargar y extraer texto
  let text: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    const res = await fetch(`${BDNS_API}/convocatorias/documentos?idDocumento=${doc.id}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'startidea-scraper/1.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `pdf HTTP ${res.status}` };
    const buffer = Buffer.from(await res.arrayBuffer());
    // pdf-parse v1 exporta directamente una función (mismo patrón que doc-extractor.ts)
    const pdfParse = _require('pdf-parse') as typeof import('pdf-parse');
    const data = await pdfParse(buffer, { max: 0 });
    text = (data.text ?? '').replace(/\s+\n/g, '\n').trim();
  } catch (e) {
    return { ok: false, error: `pdf: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (text.length < 500) return { ok: false, error: 'sin-texto' }; // escaneado sin OCR
  if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS) + '\n[TEXTO TRUNCADO]';

  // 3. Extracción con IA
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${orKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://startidea.es',
        'X-Title': 'Startidea Scraper BDNS Enrich',
      },
      body: JSON.stringify({
        model: pickModel('clasificacion'),
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildPrompt(tituloContexto, text) },
        ],
        max_tokens: 1800,
        temperature: 0.1,
      }),
    });
    clearTimeout(timer);
    if (!aiRes.ok) return { ok: false, error: `openrouter HTTP ${aiRes.status}` };
    const aiJson = (await aiRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = aiJson.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, error: 'sin-json-en-respuesta' };
    const raw = JSON.parse(match[0]) as Partial<EnrichedFields>;

    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
    const num = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const iso = (v: unknown): string | null =>
      typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

    return {
      ok: true,
      fields: {
        tipo_entidades: str(raw.tipo_entidades),
        financia_resumen: arr(raw.financia_resumen),
        gastos_ok: arr(raw.gastos_ok),
        gastos_no: arr(raw.gastos_no),
        requisitos: arr(raw.requisitos),
        importe_min: num(raw.importe_min),
        importe_max: num(raw.importe_max),
        importe_range: str(raw.importe_range),
        importe_detalle: str(raw.importe_detalle),
        plazo_fin_iso: iso(raw.plazo_fin_iso),
      },
    };
  } catch (e) {
    return { ok: false, error: `ia: ${e instanceof Error ? e.message : String(e)}` };
  }
}
