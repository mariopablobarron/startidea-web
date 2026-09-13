// Helper para consumir la API pública de subvenciones del HUB
// (hub.startidea.tech). Se usa en build (getStaticPaths) y en runtime
// (componentes JS del navegador).
//
// FASE C5: Arquitectura resiliente con LAST_KNOWN_GOOD_DATA. Si el HUB no está
// disponible, está en mantenimiento o responde 503, se recurre de forma
// automática e inmediata al snapshot estático (`subsidies-snapshot.json`).
// Esto garantiza que el build de Astro nunca falle y que los metadatos SEO
// y el número de convocatorias nunca queden a cero por caídas transitorias.

import { HUB_URL } from '@/lib/hub';
import snapshotData from '@/data/subsidies-snapshot.json';

export const SUBSIDY_API = {
  list: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, String(v));
    }
    return `${HUB_URL}/api/public/subsidies?${qs.toString()}`;
  },
  detail: (slug: string) =>
    `${HUB_URL}/api/public/subsidies/${encodeURIComponent(slug)}`,
  createWatch: () => `${HUB_URL}/api/public/subsidy-watch`,
  manageWatch: (token: string) =>
    `${HUB_URL}/api/public/subsidy-watch/${encodeURIComponent(token)}`,
};

export interface SubsidyListItem {
  id: number;
  slug: string | null;
  source: string;
  source_url: string;
  title: string;
  organization: string | null;
  deadline: string | null;
  amount_eur: number | null;
  published_at: string | null;
  geo_level: string | null;
  ccaa: string | null;
  province: string | null;
  municipality: string | null;
  beneficiary_types: string[];
  finalidades: string[];
  instrument_types: string[];
  funding_origins: string[];
  status: string;
  meta_description: string | null;
}

export interface SubsidyDetail extends SubsidyListItem {
  source_id: string;
  description: string | null;
  start_date: string | null;
  sectores_cnae: string[];
  bases_url: string | null;
  bases_text: string | null;
  startidea_summary: string | null;
  ai_tags: string[];
  extra: unknown;
  detected_at: number;
  updated_at: number;
}

export interface ListResponse {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: SubsidyListItem[];
}

export interface DetailResponse {
  ok: boolean;
  subsidy: SubsidyDetail;
}

interface SnapshotType {
  generatedAt: string;
  andalucia: ListResponse;
  granada: ListResponse;
  estatal: ListResponse;
}

const snapshot = snapshotData as unknown as SnapshotType;

/** Recupera el snapshot LAST_KNOWN_GOOD_DATA según los parámetros de consulta. */
export function getSnapshotFallback(
  params: Parameters<typeof SUBSIDY_API.list>[0] = {},
): ListResponse {
  if (params.province === 'granada') return snapshot.granada;
  if (params.ccaa === 'andalucia') return snapshot.andalucia;
  if (params.geo === 'ESTATAL') return snapshot.estatal;
  return snapshot.andalucia;
}

/** Fetch con fallback garantizado a LAST_KNOWN_GOOD_DATA (inmune a caídas del HUB o 503). */
export async function fetchSubsidies(
  params: Parameters<typeof SUBSIDY_API.list>[0] = {},
): Promise<ListResponse> {
  const fallback = getSnapshotFallback(params);
  try {
    const res = await fetch(SUBSIDY_API.list(params), {
      headers: { Accept: 'application/json' },
      // Timeout corto para agilizar builds
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.warn(
        `[subsidies-api] list HTTP ${res.status} — aplicando LAST_KNOWN_GOOD_DATA (${fallback.total} items)`,
      );
      return fallback;
    }
    const data = (await res.json()) as ListResponse;
    if (data && data.ok && Array.isArray(data.items) && data.items.length > 0) {
      return data;
    }
    console.warn(`[subsidies-api] respuesta sin items válidos — aplicando LAST_KNOWN_GOOD_DATA`);
    return fallback;
  } catch (err) {
    console.warn(
      `[subsidies-api] list error: ${(err as Error).message} — aplicando LAST_KNOWN_GOOD_DATA (${fallback.total} items)`,
    );
    return fallback;
  }
}

export async function fetchSubsidyDetail(
  slug: string,
): Promise<SubsidyDetail | null> {
  try {
    const res = await fetch(SUBSIDY_API.detail(slug), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as DetailResponse;
    return j.ok ? j.subsidy : null;
  } catch (err) {
    console.warn('[subsidies-api] detail error:', (err as Error).message);
    return null;
  }
}

// ─── Taxonomía pública (espejo de la del HUB) ─────────────────────────

export const FINALIDADES = [
  { slug: 'cultura', label: 'Cultura' },
  { slug: 'servicios-sociales', label: 'Servicios sociales' },
  { slug: 'educacion', label: 'Educación' },
  { slug: 'fomento-empleo', label: 'Empleo' },
  { slug: 'i-d-i', label: 'Investigación e innovación' },
  { slug: 'cooperacion-internacional', label: 'Cooperación internacional' },
  { slug: 'comercio-turismo', label: 'Comercio, turismo y PYMEs' },
  { slug: 'agricultura-pesca', label: 'Agricultura y pesca' },
  { slug: 'industria-energia', label: 'Industria y energía' },
  { slug: 'sanidad', label: 'Sanidad' },
  { slug: 'acceso-vivienda', label: 'Vivienda' },
  { slug: 'infraestructuras', label: 'Infraestructuras' },
  { slug: 'desempleo', label: 'Desempleo' },
  { slug: 'transporte', label: 'Transporte' },
] as const;

export const BENEFICIARIOS = [
  { slug: 'persona-juridica-no-economica', label: 'Asociaciones y fundaciones' },
  { slug: 'pyme', label: 'PYMEs y autónomos' },
  { slug: 'gran-empresa', label: 'Grandes empresas' },
  { slug: 'persona-fisica-no-economica', label: 'Particulares' },
] as const;

export const TERRITORIOS_PUBLIC = [
  { slug: 'andalucia', label: 'Andalucía' },
  { slug: 'madrid', label: 'Madrid' },
  { slug: 'catalunya', label: 'Cataluña' },
  { slug: 'comunitat-valenciana', label: 'Comunitat Valenciana' },
  { slug: 'galicia', label: 'Galicia' },
  { slug: 'euskadi', label: 'Euskadi' },
  { slug: 'castilla-y-leon', label: 'Castilla y León' },
  { slug: 'castilla-la-mancha', label: 'Castilla-La Mancha' },
  { slug: 'aragon', label: 'Aragón' },
  { slug: 'canarias', label: 'Canarias' },
  { slug: 'asturias', label: 'Asturias' },
  { slug: 'murcia', label: 'Murcia' },
  { slug: 'illes-balears', label: 'Illes Balears' },
  { slug: 'extremadura', label: 'Extremadura' },
  { slug: 'navarra', label: 'Navarra' },
  { slug: 'cantabria', label: 'Cantabria' },
  { slug: 'la-rioja', label: 'La Rioja' },
  { slug: 'ceuta', label: 'Ceuta' },
  { slug: 'melilla', label: 'Melilla' },
] as const;

export const INSTRUMENTOS = [
  { slug: 'subvencion', label: 'Subvención' },
  { slug: 'prestamo', label: 'Préstamo' },
  { slug: 'beca', label: 'Beca' },
  { slug: 'premio', label: 'Premio' },
  { slug: 'convenio', label: 'Convenio' },
  { slug: 'deduccion', label: 'Deducción fiscal' },
  { slug: 'garantia', label: 'Garantía' },
] as const;

export function finalidadLabel(slug: string | null | undefined): string {
  if (!slug) return '';
  return FINALIDADES.find((f) => f.slug === slug)?.label ?? slug;
}

export function beneficiarioLabel(slug: string): string {
  return BENEFICIARIOS.find((b) => b.slug === slug)?.label ?? slug;
}

export function territorioLabel(slug: string | null | undefined): string {
  if (!slug) return '';
  return TERRITORIOS_PUBLIC.find((t) => t.slug === slug)?.label ?? slug;
}

export function instrumentoLabel(slug: string): string {
  return INSTRUMENTOS.find((i) => i.slug === slug)?.label ?? slug;
}

export function fmtAmount(eur: number | null | undefined): string {
  if (!eur) return '—';
  if (eur >= 1_000_000)
    return `${(eur / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`;
  if (eur >= 1_000) return `${(eur / 1_000).toLocaleString('es-ES')} K€`;
  return `${eur.toLocaleString('es-ES')} €`;
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function daysToDeadline(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
