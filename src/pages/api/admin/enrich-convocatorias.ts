/**
 * /api/admin/enrich-convocatorias
 *
 * Pre-rellena con IA los campos que el scraper BDNS deja vacíos (requisitos,
 * gastos, importes por beneficiario, tipo de entidades), extrayéndolos del
 * PDF oficial que BDNS adjunta a cada convocatoria (ver bdns-enrich.ts).
 *
 * POST → Body JSON opcional: { limit?: number (def 5, máx 10), slugs?: string[],
 *        incluirActivas?: boolean (def false) }
 *        Sin slugs: procesa las fichas fuente='bdns' sin intento previo de
 *        enriquecimiento (columna enrich_attempted_at) y con requisitos y
 *        gastos vacíos — por defecto solo las activa=0 (borradores pendientes
 *        de revisión); las activas ya publicadas solo con incluirActivas=true.
 *        Reintento explícito de una ya intentada: pasar su slug en `slugs`.
 *        Responde: { ok, candidates, enriched, results }
 *
 * Endpoint separado del scraper a propósito: el cron del scraper hace curl
 * con --max-time 60 y la extracción (PDF grande + IA) no cabe ahí. El cron
 * scripts/scraper-bdns-daily.sh lo llama como segundo paso con más margen.
 *
 * Auth: x-admin-token header.
 */
import type { APIRoute } from 'astro';
import { isValidAdminHeader } from '@/lib/admin-session';
import {
  listConvocatoriasAll,
  getConvocatoria,
  upsertConvocatoria,
  setConvocatoriaEnrichAttempted,
  type ConvocatoriaView,
} from '@/lib/expedientes-db';
import { enrichFromPdf } from '@/lib/scrapers/bdns-enrich';

export const prerender = false;

/** Cuántas extracciones (PDF + IA) corren a la vez. Acotado: cada una puede
 *  mover PDFs de hasta 25MB; 2 en paralelo ~halva la pared de tiempo del
 *  batch frente al --max-time del curl del cron sin disparar la memoria. */
const CONCURRENCIA = 2;

/** Errores de extracción que no van a cambiar mañana: cuentan como intento
 *  hecho (marcan enrich_attempted_at) para no reprocesar en bucle. Los
 *  transitorios (HTTP, timeout, IA caída) NO marcan y se reintentan solos. */
const ERRORES_PERMANENTES = new Set(['sin-documento', 'sin-texto', 'pdf-demasiado-grande']);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Extrae el número de convocatoria BDNS del slug del scraper (bdns-XXXX-...).
 *  Fallback para filas antiguas sin fuente_id. */
function codigoFromSlug(slug: string): string | null {
  const m = slug.match(/^bdns-(\d+)-/);
  return m ? m[1] : null;
}

interface ResultadoSlug {
  slug: string;
  ok: boolean;
  detail: string;
}

async function procesarSlug(slug: string): Promise<ResultadoSlug> {
  const conv = getConvocatoria(slug);
  if (!conv) return { slug, ok: false, detail: 'no-existe' };

  const codigo = conv.fuenteId ?? codigoFromSlug(slug);
  if (!codigo) return { slug, ok: false, detail: 'sin-codigo-bdns' };

  const outcome = await enrichFromPdf(codigo, conv.tituloFull || conv.titulo);
  if (!outcome.ok || !outcome.fields) {
    const err = outcome.error ?? 'sin-campos';
    if (ERRORES_PERMANENTES.has(err)) setConvocatoriaEnrichAttempted(slug);
    return { slug, ok: false, detail: err };
  }
  const f = outcome.fields;

  // Contraste de plazos: si el PDF fija un fin distinto al de BDNS, avisar
  // en deadline_note (BDNS a veces registra la fecha genérica del ejercicio).
  let deadlineNote = conv.deadlineNote;
  if (f.plazo_fin_iso && conv.deadlineIso && f.plazo_fin_iso !== conv.deadlineIso) {
    deadlineNote = `⚠️ El texto oficial fija el fin de plazo el ${f.plazo_fin_iso}; BDNS registra ${conv.deadlineIso}. Confirmar antes de activar.`;
  }

  // Merge conservador en los campos de contenido (la IA solo rellena huecos).
  // Importes: el scraper guarda el CRÉDITO TOTAL como importe_max/"Hasta X €"
  // (etiquetado erróneo) — si el PDF da datos por beneficiario, mandan; misma
  // dirección para importe_detalle, que describe esas mismas cifras.
  upsertConvocatoria({
    slug: conv.slug,
    codigo: conv.codigo,
    titulo: conv.titulo,
    titulo_full: conv.tituloFull,
    organo: conv.organo,
    tipo_beneficiario: conv.beneficiario,
    beneficiario_label: conv.beneficiarioLabel,
    deadline: conv.deadline,
    deadline_short: conv.deadlineShort,
    deadline_note: deadlineNote,
    deadline_iso: conv.deadlineIso,
    importe_min: f.importe_min ?? conv.importeMin,
    importe_max: f.importe_max ?? conv.importeMax,
    importe_range: f.importe_range || conv.importeRange,
    importe_detalle: f.importe_detalle || conv.importe,
    tipo_entidades: conv.tipoEntidades || f.tipo_entidades,
    financia_resumen: conv.financiaResumen.length > 0 ? conv.financiaResumen : f.financia_resumen,
    gastos_ok: conv.gastosOk.length > 0 ? conv.gastosOk : f.gastos_ok,
    gastos_no: conv.gastosNo.length > 0 ? conv.gastosNo : f.gastos_no,
    requisitos: conv.requisitos.length > 0 ? conv.requisitos : f.requisitos,
    nota: conv.nota,
    url_boja: conv.bojaUrl,
    url_bases: conv.basesUrl,
    url_sede: conv.sedeUrl,
    fuente: conv.fuente,
    fuente_id: codigo,
    activa: conv.activa ? 1 : 0,
    destacada: conv.destacada ? 1 : 0,
  });
  setConvocatoriaEnrichAttempted(slug);
  return {
    slug,
    ok: true,
    detail: `req:${f.requisitos.length} ok:${f.gastos_ok.length} no:${f.gastos_no.length} imp:${f.importe_range || '—'}`,
  };
}

export const POST: APIRoute = async ({ request }) => {
  if (!isValidAdminHeader(request.headers.get('x-admin-token') ?? '')) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let body: { limit?: number; slugs?: string[]; incluirActivas?: boolean } = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw) as typeof body;
  } catch {
    // body vacío o inválido → defaults
  }
  const limit = Math.min(10, Math.max(1, body.limit ?? 5));

  // Candidatas: pedidas por slug (reintento explícito, sin filtros), o las
  // bdns con contenido vacío y sin intento previo de enriquecimiento.
  let slugs: string[];
  if (Array.isArray(body.slugs) && body.slugs.length > 0) {
    slugs = body.slugs.slice(0, limit);
  } else {
    slugs = listConvocatoriasAll()
      .filter(
        (c: ConvocatoriaView) =>
          c.fuente === 'bdns' &&
          (body.incluirActivas ? true : !c.activa) &&
          c.enrichAttemptedAt == null &&
          c.requisitos.length === 0 &&
          c.gastosOk.length === 0 &&
          (c.fuenteId ?? codigoFromSlug(c.slug)) !== null,
      )
      .map((c) => c.slug)
      .slice(0, limit);
  }

  const results: ResultadoSlug[] = [];
  for (let i = 0; i < slugs.length; i += CONCURRENCIA) {
    const tanda = await Promise.all(
      slugs.slice(i, i + CONCURRENCIA).map((slug) =>
        procesarSlug(slug).catch((e) => ({
          slug,
          ok: false,
          detail: `error: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`,
        })),
      ),
    );
    results.push(...tanda);
  }
  const enriched = results.filter((r) => r.ok).length;

  console.info(`[enrich-convocatorias] candidates=${slugs.length} enriched=${enriched}`);
  return json({ ok: true, candidates: slugs.length, enriched, results });
};
