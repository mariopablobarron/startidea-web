/**
 * Scraper BDNS — cliente de la API pública de infosubvenciones.es
 *
 * Docs API (no oficial):
 *   https://www.infosubvenciones.es/bdnstrans/GE/es/api/convocatorias
 *
 * Uso:
 *   const result = await scrapeBDNS({ organismos: ['A01002981'], keywords: ['inclusión'] });
 */

// ─── Tipos API BDNS ────────────────────────────────────────────────────────

export interface BDNSConvRaw {
  id: number;
  tdns?: string;                 // código interno BDNS
  titulo?: string;
  tituloConvocatoria?: string;
  fechaPublicacion?: string;     // YYYY-MM-DD o DD/MM/YYYY
  fechaInicioSolicitud?: string;
  fechaFinSolicitud?: string;
  importeTotal?: number;
  importeMaxAyuda?: number;
  importeMinAyuda?: number;
  organismo?: {
    codigo: string;
    descripcion: string;
    codigoMinisterio?: string;
  };
  tiposBeneficiario?: { codigo: string; descripcion: string }[];
  finalidades?: { codigo: string; descripcion: string }[];
  sectoresActividad?: { codigo: string; descripcion: string }[];
  regimenConcurrencia?: string;
  descripcion?: string;
  urlConvocatoria?: string;
  fuente?: string;
}

export interface BDNSResponse {
  totalElements?: number;
  content?: BDNSConvRaw[];
  // v2
  resultados?: BDNSConvRaw[];
  total?: number;
}

export interface ScrapeResult {
  ok: boolean;
  fetched: number;
  normalized: NormalizedConv[];
  errors: string[];
}

export interface NormalizedConv {
  slug: string;
  codigo: string;
  titulo: string;
  titulo_full: string;
  organo: string;
  tipo_beneficiario: 'privada' | 'local' | 'empresa' | 'mixto';
  beneficiario_label: string;
  deadline: string;
  deadline_short: string;
  deadline_note: string | null;
  deadline_iso: string | null;
  importe_min: number | null;
  importe_max: number | null;
  importe_range: string;
  importe_detalle: string;
  tipo_entidades: string;
  financia_resumen: string[];
  gastos_ok: string[];
  gastos_no: string[];
  requisitos: string[];
  nota: string | null;
  url_boja: string | null;
  url_bases: string | null;
  url_sede: string | null;
  fuente: 'bdns';
  fuente_id: string | null;
  activa: 0;           // siempre inactiva hasta revisión manual
  destacada: 0;
}

// ─── Organismos Junta de Andalucía relevantes ─────────────────────────────

export const JUNTA_ORGANISMOS = [
  'A01002981', // Consejería de Inclusión Social, Juventud, FF y Migraciones
  'A01002977', // Consejería de Educación
  'A01002982', // Consejería de Igualdad y Políticas Sociales (anterior nombre)
  'A01003001', // Consejería de Empleo
  'A01002980', // Consejería de Salud
  'A01002983', // Consejería de Fomento
  'A01003000', // Consejería de Cultura
];

// ─── Keywords para filtrar convocatorias relevantes ───────────────────────

export const SOCIAL_KEYWORDS = [
  'inclusión social',
  'integración social',
  'entidades sociales',
  'organizaciones sociales',
  'tercer sector',
  'acción social',
  'servicios sociales',
  'intervención social',
  'exclusión social',
  'colectivos vulnerables',
  'discapacidad',
  'dependencia',
  'infancia',
  'menores',
  'juventud',
  'mujer',
  'género',
  'inmigrantes',
  'refugiados',
  'sin hogar',
  'drogodependencias',
  'salud mental',
  'comunidad gitana',
  'voluntariado',
  'cooperación',
  'igualdad',
  'empleo social',
];

// ─── Utilidades ───────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function parseDate(s?: string): string | null {
  if (!s) return null;
  // DD/MM/YYYY → YYYY-MM-DD
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function fmtDateSpanish(iso: string): string {
  const [y, m, d] = iso.split('-');
  const meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${parseInt(d)} de ${meses[parseInt(m)]} de ${y}`;
}

function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  const meses = ['', 'ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.',
    'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
  return `${parseInt(d)} ${meses[parseInt(m)]}`;
}

function fmtImporte(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function isSocialRelevant(raw: BDNSConvRaw): boolean {
  const text = [raw.titulo, raw.tituloConvocatoria, raw.descripcion]
    .filter(Boolean).join(' ').toLowerCase();
  return SOCIAL_KEYWORDS.some(kw => text.includes(kw));
}

function guessTipoBeneficiario(raw: BDNSConvRaw): NormalizedConv['tipo_beneficiario'] {
  const beneficiarios = (raw.tiposBeneficiario ?? []).map(b => b.descripcion?.toLowerCase() ?? '');
  const all = beneficiarios.join(' ');

  const tienePrivada = all.includes('entidad sin') || all.includes('ong') ||
    all.includes('asociaci') || all.includes('fundaci') || all.includes('privad');
  const tieneLocal = all.includes('corporaci') || all.includes('ayuntamiento') ||
    all.includes('diputaci') || all.includes('municipal') || all.includes('entidad local');
  const tieneEmpresa = all.includes('empresa') || all.includes('pyme') || all.includes('autónomo');

  if (tienePrivada && tieneLocal) return 'mixto';
  if (tienePrivada) return 'privada';
  if (tieneLocal) return 'local';
  if (tieneEmpresa) return 'empresa';
  return 'privada'; // por defecto
}

// ─── Normalizador ────────────────────────────────────────────────────────

export function normalizeBDNS(raw: BDNSConvRaw): NormalizedConv | null {
  const titulo = (raw.titulo ?? raw.tituloConvocatoria ?? '').trim();
  if (!titulo) return null;

  const fuente_id = raw.tdns ?? String(raw.id);
  const slug = `bdns-${fuente_id}-${slugify(titulo)}`.slice(0, 100);
  const organo = raw.organismo?.descripcion ?? '';

  const deadlineIso = parseDate(raw.fechaFinSolicitud);
  const deadlineStr = deadlineIso ? fmtDateSpanish(deadlineIso) : 'Consultar BDNS';
  const deadlineShort = deadlineIso ? fmtDateShort(deadlineIso) : '—';

  const importeMin = raw.importeMinAyuda ?? null;
  const importeMax = raw.importeMaxAyuda ?? raw.importeTotal ?? null;

  let importeRange = '';
  if (importeMax) {
    importeRange = importeMin && importeMin !== importeMax
      ? `${fmtImporte(importeMin)} – ${fmtImporte(importeMax)}`
      : `Hasta ${fmtImporte(importeMax)}`;
  }

  const tipo_beneficiario = guessTipoBeneficiario(raw);
  const beneficiarioLabel = (raw.tiposBeneficiario ?? [])
    .map(b => b.descripcion).filter(Boolean).join(', ');

  const finalidades = (raw.finalidades ?? []).map(f => f.descripcion).filter(Boolean);

  return {
    slug,
    codigo: `BDNS-${fuente_id}`,
    titulo: titulo.slice(0, 160),
    titulo_full: titulo,
    organo,
    tipo_beneficiario,
    beneficiario_label: beneficiarioLabel,
    deadline: deadlineStr,
    deadline_short: deadlineShort,
    deadline_note: raw.fechaInicioSolicitud
      ? `Inicio solicitudes: ${parseDate(raw.fechaInicioSolicitud) ?? raw.fechaInicioSolicitud}`
      : null,
    deadline_iso: deadlineIso,
    importe_min: importeMin,
    importe_max: importeMax,
    importe_range: importeRange,
    importe_detalle: '',
    tipo_entidades: beneficiarioLabel,
    financia_resumen: finalidades.slice(0, 5),
    gastos_ok: [],
    gastos_no: [],
    requisitos: [],
    nota: raw.descripcion ? raw.descripcion.slice(0, 500) : null,
    url_boja: null,
    url_bases: raw.urlConvocatoria ?? null,
    url_sede: null,
    fuente: 'bdns',
    fuente_id,
    activa: 0,
    destacada: 0,
  };
}

// ─── Scraper principal ───────────────────────────────────────────────────

export interface ScrapeOptions {
  /** Códigos de organismo (DIR3). Si vacío, busca por keywords sin filtro de organismo. */
  organismos?: string[];
  /** Keywords para filtrar por relevancia social */
  keywords?: string[];
  /** Número máximo de resultados a traer de la API (default 200) */
  maxResults?: number;
  /** Solo convocatorias con plazo abierto */
  soloAbiertas?: boolean;
  /** Timeout en ms (default 15000) */
  timeoutMs?: number;
}

const BDNS_API = 'https://www.infosubvenciones.es/bdnstrans/GE/es/api/convocatorias';

export async function scrapeBDNS(opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  const {
    organismos = JUNTA_ORGANISMOS,
    keywords = SOCIAL_KEYWORDS,
    maxResults = 200,
    soloAbiertas = true,
    timeoutMs = 20000,
  } = opts;

  const errors: string[] = [];
  const allRaw: BDNSConvRaw[] = [];

  // La API BDNS acepta parámetros de búsqueda
  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({
    page: '0',
    pageSize: String(maxResults),
    order: 'fechaPublicacion',
    dir: 'DESC',
    ...(soloAbiertas ? { fechaFinSolicitudDesde: today } : {}),
  });

  // Buscamos por cada organismo o una búsqueda general si no hay organismos
  const searchList: (string | null)[] = organismos.length > 0 ? organismos : [null];

  for (const org of searchList) {
    const searchParams = new URLSearchParams(params);
    if (org) searchParams.set('codigoOrganismo', org);

    const url = `${BDNS_API}?${searchParams.toString()}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Startidea-Bot/1.0 (startidea.es)',
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        errors.push(`BDNS API ${org ?? 'general'}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json() as BDNSResponse;
      const items: BDNSConvRaw[] = data.content ?? data.resultados ?? [];
      allRaw.push(...items);

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`BDNS API ${org ?? 'general'}: ${msg}`);
    }
  }

  // Deduplicar por id/tdns
  const seen = new Set<string>();
  const unique = allRaw.filter(r => {
    const k = r.tdns ?? String(r.id);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Filtrar por relevancia social si hay keywords
  const relevant = keywords.length > 0
    ? unique.filter(r => isSocialRelevant(r))
    : unique;

  // Normalizar
  const normalized: NormalizedConv[] = [];
  for (const r of relevant) {
    try {
      const n = normalizeBDNS(r);
      if (n) normalized.push(n);
    } catch (e) {
      errors.push(`Normalización ${r.tdns ?? r.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    ok: errors.length === 0 || normalized.length > 0,
    fetched: unique.length,
    normalized,
    errors,
  };
}
