/**
 * Scraper BDNS — cliente de la API pública de SNPSAP (infosubvenciones.es)
 *
 * IMPORTANTE: el API REST vive en /bdnstrans/api (devuelve JSON).
 * La ruta /bdnstrans/GE/es/... es el FRONT-END web (devuelve HTML) y NO debe usarse.
 * Todas las llamadas requieren el parámetro vpd=GE.
 *
 * Flujo en dos fases:
 *   1. Lista ligera:  /convocatorias/busqueda?vpd=GE&descripcion=<término>
 *   2. Detalle:       /convocatorias?vpd=GE&numConv=<numeroConvocatoria>
 *
 * Uso:
 *   const result = await scrapeBDNS({ soloAbiertas: true });
 */

// ─── Tipos API BDNS ────────────────────────────────────────────────────────

/** Item del listado ligero (/convocatorias/busqueda). Campos nivelN FLAT. */
export interface BDNSListItem {
  id?: number;
  numeroConvocatoria?: string;
  descripcion?: string;            // título de la convocatoria
  fechaRecepcion?: string;         // YYYY-MM-DD
  nivel1?: string;                 // p.ej. "ESTADO" / "ANDALUCÍA"
  nivel2?: string;
  nivel3?: string;
}

export interface BDNSListResponse {
  content?: BDNSListItem[];
  totalElements?: number;
}

/** Detalle completo (/convocatorias?numConv=N). */
export interface BDNSDetail {
  codigoBDNS?: string;
  numeroConvocatoria?: string;
  descripcion?: string;            // título
  organo?: {
    nivel1?: string;
    nivel2?: string;
    nivel3?: string;
  };
  fechaInicioSolicitud?: string;   // YYYY-MM-DD
  fechaFinSolicitud?: string;      // YYYY-MM-DD
  abierto?: boolean;               // NO fiable — usar filtro por fecha
  presupuestoTotal?: number;
  tiposBeneficiarios?: { descripcion?: string; codigo?: string }[];
  sectores?: { descripcion?: string; codigo?: string }[];
  regiones?: { descripcion?: string; codigo?: string }[];
  descripcionFinalidad?: string;
  urlBasesReguladoras?: string;
  sedeElectronica?: string;        // a veces sin esquema (//... o dominio pelado)
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

// ─── Términos de búsqueda y keywords de relevancia ────────────────────────

/**
 * Términos fuertes para las consultas a la API (fase 1). Cada uno dispara una
 * búsqueda independiente; los resultados se deduplican por numeroConvocatoria.
 * Se mantienen curados y cortos para no saturar el API.
 */
export const BDNS_SEARCH_TERMS = [
  'inclusión social',
  'entidades sociales',
  'tercer sector',
  'acción social',
  'servicios sociales',
  'personas con discapacidad',
  'infancia',
  'juventud',
  'igualdad',
  'voluntariado',
  'entidades locales',
  'desarrollo local',
  // Ampliación nacional 2026-06-13 (áreas de tercer sector que faltaban)
  'personas mayores',
  'cooperación al desarrollo',
  'salud mental',
  'cultura',
];

/** Keywords para filtrar la relevancia social del detalle (fase 2). */
export const SOCIAL_KEYWORDS = [
  // Tercer sector / entidades privadas
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
  // Entidades locales / ayuntamientos
  'entidades locales',
  'corporaciones locales',
  'municipios',
  'ayuntamientos',
  'mancomunidades',
  'pequeños municipios',
  'zona rural',
  'municipios de menos',
  'equipamientos municipales',
  'planes de empleo',
  'empleo local',
  'dinamización local',
  'desarrollo local',
  'cultura local',
  // Ampliación nacional 2026-06-13
  'personas mayores',
  'envejecimiento',
  'cultura',
  'patrimonio cultural',
  'cooperación al desarrollo',
  'ayuda humanitaria',
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

const BDNS_API = 'https://www.infosubvenciones.es/bdnstrans/api';

/**
 * Fetch con timeout + guarda de content-type. Lanza si la respuesta NO es JSON
 * (defensa contra la regresión de pegar al front-end HTML).
 */
async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Startidea-Bot/1.0 (startidea.es)',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) {
      throw new Error(`respuesta no-JSON (content-type: ${ct || 'desconocido'}) — ¿URL del front-end?`);
    }
    return await res.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Relevancia geográfica: Andalucía/Granada aparece en niveles variables.
 * Estatal (ESTADO) solo si includeEstatal=true.
 */
function isAndaluciaRelevant(
  n1?: string,
  n2?: string,
  n3?: string,
  includeEstatal = false,
): boolean {
  const joined = [n1, n2, n3].filter(Boolean).join(' ').toLowerCase();
  if (joined.includes('andaluc') || joined.includes('granada')) return true;
  if (includeEstatal && joined.includes('estado')) return true;
  return false;
}

function isSocialRelevant(d: BDNSDetail): boolean {
  const text = [
    d.descripcion,
    d.descripcionFinalidad,
    ...(d.sectores ?? []).map(s => s.descripcion),
    ...(d.tiposBeneficiarios ?? []).map(b => b.descripcion),
  ].filter(Boolean).join(' ').toLowerCase();
  return SOCIAL_KEYWORDS.some(kw => text.includes(kw));
}

function guessTipoBeneficiario(d: BDNSDetail): NormalizedConv['tipo_beneficiario'] {
  const all = (d.tiposBeneficiarios ?? [])
    .map(b => b.descripcion?.toLowerCase() ?? '').join(' ');

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

function normalizeSede(url?: string): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  return `https://${u}`;
}

// ─── Normalizador ────────────────────────────────────────────────────────

export function normalizeBDNS(d: BDNSDetail): NormalizedConv | null {
  const titulo = (d.descripcion ?? '').trim();
  if (!titulo) return null;

  const fuente_id = d.codigoBDNS ?? d.numeroConvocatoria ?? null;
  if (!fuente_id) return null;

  const slug = `bdns-${fuente_id}-${slugify(titulo)}`.slice(0, 100);
  const organo = d.organo?.nivel3 || d.organo?.nivel2 || d.organo?.nivel1 || '';

  const deadlineIso = parseDate(d.fechaFinSolicitud);
  const deadlineStr = deadlineIso ? fmtDateSpanish(deadlineIso) : 'Consultar BDNS';
  const deadlineShort = deadlineIso ? fmtDateShort(deadlineIso) : '—';

  const importeMax = d.presupuestoTotal ?? null;
  const importeRange = importeMax ? `Hasta ${fmtImporte(importeMax)}` : '';

  const tipo_beneficiario = guessTipoBeneficiario(d);
  const beneficiarioLabel = (d.tiposBeneficiarios ?? [])
    .map(b => b.descripcion).filter(Boolean).join(', ');

  const financia: string[] = [];
  if (d.descripcionFinalidad) financia.push(d.descripcionFinalidad);
  for (const s of d.sectores ?? []) {
    if (s.descripcion) financia.push(s.descripcion);
  }

  const inicioIso = parseDate(d.fechaInicioSolicitud);

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
    deadline_note: inicioIso ? `Inicio solicitudes: ${inicioIso}` : null,
    deadline_iso: deadlineIso,
    importe_min: null,
    importe_max: importeMax,
    importe_range: importeRange,
    importe_detalle: '',
    tipo_entidades: beneficiarioLabel,
    financia_resumen: financia.slice(0, 5),
    gastos_ok: [],
    gastos_no: [],
    requisitos: [],
    nota: null,
    url_boja: null,
    url_bases: d.urlBasesReguladoras ?? null,
    url_sede: normalizeSede(d.sedeElectronica),
    fuente: 'bdns',
    fuente_id,
    activa: 0,
    destacada: 0,
  };
}

// ─── Scraper principal ───────────────────────────────────────────────────

export interface ScrapeOptions {
  /** Términos de búsqueda. Si vacío, usa BDNS_SEARCH_TERMS. */
  search?: string[];
  /** Solo convocatorias con plazo de solicitud abierto (filtro por fecha) */
  soloAbiertas?: boolean;
  /** Incluir convocatorias estatales además de las de Andalucía */
  includeEstatal?: boolean;
  /** Máximo de resultados de lista por término (default 30) */
  maxPerTerm?: number;
  /** Máximo de detalles a descargar en total (default 60) */
  maxDetails?: number;
  /** Timeout por petición en ms (default 15000) */
  timeoutMs?: number;
}

export async function scrapeBDNS(opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  const {
    search = BDNS_SEARCH_TERMS,
    soloAbiertas = true,
    includeEstatal = false,
    maxPerTerm = 30,
    maxDetails = 60,
    timeoutMs = 15000,
  } = opts;

  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // ── Fase 1: listado ligero por cada término ──────────────────────────────
  const seen = new Set<string>();
  const candidates: { num: string }[] = [];

  for (const term of search) {
    const params = new URLSearchParams({
      vpd: 'GE',
      page: '0',
      pageSize: String(maxPerTerm),
      order: 'fechaRecepcion',
      direccion: 'desc',
      descripcion: term,
    });
    const url = `${BDNS_API}/convocatorias/busqueda?${params.toString()}`;

    try {
      const data = await fetchJson<BDNSListResponse>(url, timeoutMs);
      const items = data.content ?? [];
      for (const it of items) {
        const num = it.numeroConvocatoria;
        if (!num || seen.has(num)) continue;
        // Filtro de región barato sobre la lista (nivelN FLAT)
        if (!isAndaluciaRelevant(it.nivel1, it.nivel2, it.nivel3, includeEstatal)) continue;
        seen.add(num);
        candidates.push({ num });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Lista "${term}": ${msg}`);
    }
  }

  // Cap de detalles a descargar
  const toFetch = candidates.slice(0, maxDetails);

  // ── Fase 2: detalle por convocatoria ──────────────────────────────────────
  const normalized: NormalizedConv[] = [];
  let fetched = 0;

  for (const { num } of toFetch) {
    const params = new URLSearchParams({ vpd: 'GE', numConv: num });
    const url = `${BDNS_API}/convocatorias?${params.toString()}`;

    try {
      const detail = await fetchJson<BDNSDetail>(url, timeoutMs);
      fetched++;

      // Filtro plazo abierto (por fecha, no por el flag abierto — no es fiable)
      if (soloAbiertas) {
        const dl = parseDate(detail.fechaFinSolicitud);
        if (!dl || dl < today) continue;
      }

      if (!isSocialRelevant(detail)) continue;

      const n = normalizeBDNS(detail);
      if (n) normalized.push(n);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Detalle ${num}: ${msg}`);
    }
  }

  return {
    // ok si no hubo errores, o si pese a errores parciales obtuvimos datos
    ok: errors.length === 0 || normalized.length > 0,
    fetched,
    normalized,
    errors,
  };
}
