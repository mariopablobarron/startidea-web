/**
 * /api/admin/enrich-convocatorias
 *
 * Pre-rellena con IA los campos que el scraper BDNS deja vacíos (requisitos,
 * gastos, importes por beneficiario, tipo de entidades), extrayéndolos del
 * PDF oficial que BDNS adjunta a cada convocatoria (ver bdns-enrich.ts).
 *
 * POST → Body JSON opcional: { limit?: number (def 5, máx 10), slugs?: string[],
 *        incluirActivas?: boolean (def false) }
 *        Sin slugs: procesa las fichas fuente='bdns' con requisitos Y gastos
 *        vacíos — por defecto solo las activa=0 (borradores pendientes de
 *        revisión); las activas ya publicadas solo con incluirActivas=true.
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
import { listConvocatoriasAll, getConvocatoria, upsertConvocatoria } from '@/lib/expedientes-db';
import { enrichFromPdf } from '@/lib/scrapers/bdns-enrich';

export const prerender = false;

const NOTA_IA =
  'Borrador extraído por IA del PDF oficial de BDNS — revisar contra las bases antes de activar.';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Extrae el número de convocatoria BDNS del slug del scraper (bdns-XXXX-...). */
function codigoFromSlug(slug: string): string | null {
  const m = slug.match(/^bdns-(\d+)-/);
  return m ? m[1] : null;
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

  // Candidatas: pedidas por slug, o las bdns con contenido vacío
  let slugs: string[];
  if (Array.isArray(body.slugs) && body.slugs.length > 0) {
    slugs = body.slugs.slice(0, limit);
  } else {
    slugs = listConvocatoriasAll()
      .filter(
        (c) =>
          c.fuente === 'bdns' &&
          (body.incluirActivas ? true : !c.activa) &&
          c.requisitos.length === 0 &&
          c.gastosOk.length === 0 &&
          // La nota-IA marca "ya intentado": si el PDF no traía esas secciones
          // los campos siguen vacíos, y sin este filtro la ficha se
          // reprocesaría cada día en bucle. Reintento explícito: por slugs.
          !(c.nota ?? '').includes(NOTA_IA) &&
          codigoFromSlug(c.slug) !== null,
      )
      .map((c) => c.slug)
      .slice(0, limit);
  }

  const results: { slug: string; ok: boolean; detail: string }[] = [];
  let enriched = 0;

  for (const slug of slugs) {
    const conv = getConvocatoria(slug);
    if (!conv) {
      results.push({ slug, ok: false, detail: 'no-existe' });
      continue;
    }
    const codigo = codigoFromSlug(slug);
    if (!codigo) {
      results.push({ slug, ok: false, detail: 'slug-sin-codigo-bdns' });
      continue;
    }

    const outcome = await enrichFromPdf(codigo, conv.tituloFull || conv.titulo);
    if (!outcome.ok || !outcome.fields) {
      results.push({ slug, ok: false, detail: outcome.error ?? 'sin-campos' });
      continue;
    }
    const f = outcome.fields;

    // Contraste de plazos: si el PDF fija un fin distinto al de BDNS, avisar
    // en deadline_note (BDNS a veces registra la fecha genérica del ejercicio).
    let deadlineNote = conv.deadlineNote;
    if (f.plazo_fin_iso && conv.deadlineIso && f.plazo_fin_iso !== conv.deadlineIso) {
      deadlineNote = `⚠️ El texto oficial fija el fin de plazo el ${f.plazo_fin_iso}; BDNS registra ${conv.deadlineIso}. Confirmar antes de activar.`;
    }

    const nota = conv.nota ? (conv.nota.includes(NOTA_IA) ? conv.nota : `${conv.nota} · ${NOTA_IA}`) : NOTA_IA;

    // Merge conservador: la IA solo rellena huecos; lo ya escrito no se pisa.
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
      // Importes: el scraper guarda el CRÉDITO TOTAL como importe_max/"Hasta X €"
      // (etiquetado erróneo) — si el PDF da cuantías por beneficiario, mandan.
      importe_min: f.importe_min ?? conv.importeMin,
      importe_max: f.importe_max ?? conv.importeMax,
      importe_range: f.importe_range || conv.importeRange,
      importe_detalle: conv.importe || f.importe_detalle,
      tipo_entidades: conv.tipoEntidades || f.tipo_entidades,
      financia_resumen: conv.financiaResumen.length > 0 ? conv.financiaResumen : f.financia_resumen,
      gastos_ok: conv.gastosOk.length > 0 ? conv.gastosOk : f.gastos_ok,
      gastos_no: conv.gastosNo.length > 0 ? conv.gastosNo : f.gastos_no,
      requisitos: conv.requisitos.length > 0 ? conv.requisitos : f.requisitos,
      nota,
      url_boja: conv.bojaUrl,
      url_bases: conv.basesUrl,
      url_sede: conv.sedeUrl,
      fuente: conv.fuente,
      fuente_id: codigo,
      activa: conv.activa ? 1 : 0,
      destacada: conv.destacada ? 1 : 0,
    });
    enriched += 1;
    results.push({ slug, ok: true, detail: `req:${f.requisitos.length} ok:${f.gastos_ok.length} no:${f.gastos_no.length} imp:${f.importe_range || '—'}` });
  }

  console.info(`[enrich-convocatorias] candidates=${slugs.length} enriched=${enriched}`);
  return json({ ok: true, candidates: slugs.length, enriched, results });
};
