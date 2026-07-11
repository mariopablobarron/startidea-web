/**
 * Cliente mínimo de Tavily (búsqueda web) para el Copiloto de Subvenciones.
 *
 * Uso previsto: buscar en vivo convocatorias/ayudas abiertas o verificar una
 * convocatoria concreta (BOJA, BDNS, infosubvenciones.es, sedes) para enriquecer
 * el análisis del expediente. Helper reutilizable — aún no se llama desde ningún
 * sitio; la integración concreta en el Copiloto va aparte.
 *
 * La API key vive SOLO en el entorno (`TAVILY_API_KEY`, .env del container
 * Coolify) — NUNCA en el repo. Si falta, `tavilySearch` lanza un error claro.
 *
 * Docs: https://docs.tavily.com/
 */

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  query: string;
  answer: string | null;
  results: TavilyResult[];
}

export interface TavilySearchOptions {
  /** Nº máximo de resultados (por defecto 5). */
  maxResults?: number;
  /** 'basic' (rápido/barato, por defecto) | 'advanced' (más exhaustivo). */
  searchDepth?: 'basic' | 'advanced';
  /** Pedir a Tavily un resumen IA de las fuentes. */
  includeAnswer?: boolean;
  /** Restringir a dominios, p.ej. ['juntadeandalucia.es', 'infosubvenciones.es']. */
  includeDomains?: string[];
  /** Excluir dominios. */
  excludeDomains?: string[];
  /** Timeout en ms (por defecto 20000). */
  timeoutMs?: number;
}

/** True si hay API key configurada en el entorno. Útil para degradar con gracia. */
export function isTavilyConfigured(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

/**
 * Ejecuta una búsqueda web con Tavily. Lanza si falta la key o si la API falla.
 * El caller decide si captura el error para degradar sin romper el flujo.
 */
export async function tavilySearch(
  query: string,
  opts: TavilySearchOptions = {},
): Promise<TavilySearchResponse> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    throw new Error('TAVILY_API_KEY no configurada (setéala en el .env del container Coolify).');
  }

  const body: Record<string, unknown> = {
    query,
    search_depth: opts.searchDepth ?? 'basic',
    max_results: opts.maxResults ?? 5,
    include_answer: opts.includeAnswer ?? false,
  };
  if (opts.includeDomains?.length) body.include_domains = opts.includeDomains;
  if (opts.excludeDomains?.length) body.exclude_domains = opts.excludeDomains;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Tavily HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      answer?: string;
      results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
    };
    return {
      query,
      answer: data.answer ?? null,
      results: (data.results ?? []).map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        content: r.content ?? '',
        score: typeof r.score === 'number' ? r.score : 0,
      })),
    };
  } finally {
    clearTimeout(timer);
  }
}
