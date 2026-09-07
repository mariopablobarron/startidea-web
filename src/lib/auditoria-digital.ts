/**
 * auditoria-digital.ts
 *
 * Motor de la auditoría digital gratuita (/auditoria-digital-gratuita).
 *
 * Hace comprobaciones automáticas y baratas sobre la web del solicitante y
 * devuelve una lista de hallazgos con severidad. NO sustituye a la revisión
 * humana: el resultado se manda a Mario por Telegram/email y es él quien
 * envía al lead la auditoría final en 48 h laborables. El lead nunca recibe
 * este output en bruto.
 *
 * Cuatro bloques (los mismos que promete la landing):
 *  1. Web: HTTPS, título, meta description, H1, canonical, viewport, idioma.
 *  2. Google: robots.txt, sitemap.xml, JSON-LD, Open Graph y, si hay
 *     PAGESPEED_API_KEY (opcional; sin clave también funciona con cuota
 *     anónima), rendimiento móvil vía PageSpeed Insights.
 *  3. Visibilidad en asistentes de IA (GEO): llms.txt, bloqueo de rastreadores
 *     de IA en robots.txt, datos estructurados de Organization.
 *  4. Redes: presencia de enlaces a perfiles sociales en la home y `sameAs`.
 *
 * Sin dependencias: fetch + regex. Cada fetch tiene timeout propio para que
 * una web colgada no bloquee el proceso.
 */

export type Severidad = 'alta' | 'media' | 'baja' | 'ok';

export interface Hallazgo {
  bloque: 'web' | 'google' | 'ia' | 'redes';
  severidad: Severidad;
  titulo: string;
  detalle?: string;
}

export interface ResultadoAuditoria {
  url: string;
  urlFinal: string;
  alcanzable: boolean;
  hallazgos: Hallazgo[];
  pagespeed?: {
    score: number | null;
    lcpMs: number | null;
    cls: number | null;
  };
  duracionMs: number;
}

const UA = 'Mozilla/5.0 (compatible; StartideaAuditoria/1.0; +https://startidea.es/auditoria-digital-gratuita)';

async function fetchText(url: string, timeoutMs = 10_000): Promise<{ ok: boolean; status: number; text: string; url: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow' });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text: text.slice(0, 600_000), url: r.url };
  } catch {
    return { ok: false, status: 0, text: '', url };
  } finally {
    clearTimeout(t);
  }
}

/** Normaliza lo que escriba el usuario a una URL https absoluta o null. */
export function normalizarUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function meta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/content=["']([^"']*)["']/i)?.[1]?.trim() ?? null;
}

const BOTS_IA = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot', 'Google-Extended', 'CCBot', 'OAI-SearchBot'];

function botsBloqueados(robots: string): string[] {
  const bloqueados: string[] = [];
  const bloques = robots.split(/(?=user-agent:)/i);
  for (const b of bloques) {
    const ua = b.match(/user-agent:\s*([^\n]+)/i)?.[1]?.trim();
    if (!ua) continue;
    const disallowAll = /disallow:\s*\/\s*$/im.test(b);
    if (!disallowAll) continue;
    for (const bot of BOTS_IA) {
      if (ua.toLowerCase() === bot.toLowerCase()) bloqueados.push(bot);
    }
  }
  return bloqueados;
}

const REDES = [
  { nombre: 'Instagram', re: /instagram\.com\/[\w.]+/i },
  { nombre: 'Facebook', re: /facebook\.com\/[\w.]+/i },
  { nombre: 'LinkedIn', re: /linkedin\.com\/(company|in)\/[\w-]+/i },
  { nombre: 'X', re: /(twitter|x)\.com\/[\w]+/i },
  { nombre: 'YouTube', re: /youtube\.com\/(@|channel\/|c\/)[\w-]+/i },
  { nombre: 'TikTok', re: /tiktok\.com\/@[\w.]+/i },
];

async function pagespeed(url: string): Promise<ResultadoAuditoria['pagespeed'] | undefined> {
  const key = process.env.PAGESPEED_API_KEY ?? '';
  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url', url);
  api.searchParams.set('strategy', 'mobile');
  api.searchParams.set('category', 'performance');
  if (key) api.searchParams.set('key', key);
  const r = await fetchText(api.toString(), 60_000);
  if (!r.ok) return undefined;
  try {
    const j = JSON.parse(r.text);
    const lh = j.lighthouseResult;
    const score = lh?.categories?.performance?.score;
    return {
      score: typeof score === 'number' ? Math.round(score * 100) : null,
      lcpMs: lh?.audits?.['largest-contentful-paint']?.numericValue ?? null,
      cls: lh?.audits?.['cumulative-layout-shift']?.numericValue ?? null,
    };
  } catch {
    return undefined;
  }
}

export async function auditarSitio(urlInput: string, opts: { conPagespeed?: boolean } = {}): Promise<ResultadoAuditoria> {
  const t0 = Date.now();
  const url = normalizarUrl(urlInput) ?? urlInput;
  const h: Hallazgo[] = [];
  const home = await fetchText(url);

  if (!home.ok) {
    h.push({ bloque: 'web', severidad: 'alta', titulo: 'La web no responde', detalle: `HTTP ${home.status || 'sin respuesta'} al pedir ${url}` });
    return { url, urlFinal: home.url, alcanzable: false, hallazgos: h, duracionMs: Date.now() - t0 };
  }

  const html = home.text;
  const origin = new URL(home.url).origin;

  // ── 1. Web ──────────────────────────────────────────────────────────
  if (!home.url.startsWith('https://')) h.push({ bloque: 'web', severidad: 'alta', titulo: 'Sin HTTPS', detalle: 'La web sirve en HTTP. Google y los navegadores la marcan como no segura.' });
  else h.push({ bloque: 'web', severidad: 'ok', titulo: 'HTTPS activo' });

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  if (!title) h.push({ bloque: 'web', severidad: 'alta', titulo: 'Sin etiqueta <title>' });
  else if (title.length < 20 || title.length > 70) h.push({ bloque: 'web', severidad: 'media', titulo: 'Título fuera de rango', detalle: `${title.length} caracteres: «${title.slice(0, 80)}»` });
  else h.push({ bloque: 'web', severidad: 'ok', titulo: 'Título correcto', detalle: title });

  const desc = meta(html, 'description') ?? '';
  if (!desc) h.push({ bloque: 'web', severidad: 'alta', titulo: 'Sin meta description', detalle: 'Google y los asistentes de IA improvisan el resumen de la página.' });
  else if (desc.length < 70 || desc.length > 165) h.push({ bloque: 'web', severidad: 'baja', titulo: 'Meta description fuera de rango', detalle: `${desc.length} caracteres` });
  else h.push({ bloque: 'web', severidad: 'ok', titulo: 'Meta description correcta' });

  const h1s = html.match(/<h1[\s>]/gi)?.length ?? 0;
  if (h1s === 0) h.push({ bloque: 'web', severidad: 'media', titulo: 'Sin H1 en la portada' });
  else if (h1s > 1) h.push({ bloque: 'web', severidad: 'baja', titulo: `${h1s} H1 en la portada`, detalle: 'Conviene uno solo que diga qué es la organización.' });
  else h.push({ bloque: 'web', severidad: 'ok', titulo: 'Un H1' });

  if (!/<link[^>]+rel=["']canonical["']/i.test(html)) h.push({ bloque: 'web', severidad: 'baja', titulo: 'Sin canonical' });
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) h.push({ bloque: 'web', severidad: 'alta', titulo: 'Sin meta viewport', detalle: 'La web no está preparada para móvil.' });
  const lang = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1];
  if (!lang) h.push({ bloque: 'web', severidad: 'baja', titulo: 'Sin atributo lang en <html>' });

  // ── 2. Google ───────────────────────────────────────────────────────
  const [robots, sitemap, llms] = await Promise.all([
    fetchText(`${origin}/robots.txt`, 6_000),
    fetchText(`${origin}/sitemap.xml`, 6_000),
    fetchText(`${origin}/llms.txt`, 6_000),
  ]);

  const robotsEsTexto = robots.ok && !/<html/i.test(robots.text);
  if (!robotsEsTexto) h.push({ bloque: 'google', severidad: 'media', titulo: 'Sin robots.txt' });
  else if (/user-agent:\s*\*\s*[\r\n]+\s*disallow:\s*\/\s*$/im.test(robots.text)) h.push({ bloque: 'google', severidad: 'alta', titulo: 'robots.txt bloquea toda la web', detalle: 'Google no puede indexarla.' });
  else h.push({ bloque: 'google', severidad: 'ok', titulo: 'robots.txt presente' });

  const sitemapEsXml = sitemap.ok && /<(urlset|sitemapindex)/i.test(sitemap.text);
  const sitemapEnRobots = robotsEsTexto && /sitemap:/i.test(robots.text);
  if (!sitemapEsXml && !sitemapEnRobots) h.push({ bloque: 'google', severidad: 'media', titulo: 'Sin sitemap.xml' });
  else h.push({ bloque: 'google', severidad: 'ok', titulo: 'Sitemap presente' });

  if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) h.push({ bloque: 'google', severidad: 'alta', titulo: 'La portada lleva noindex' });

  const jsonldBloques = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const jsonldTipos = new Set<string>();
  for (const b of jsonldBloques) {
    for (const m of b.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) jsonldTipos.add(m[1]);
  }
  if (jsonldBloques.length === 0) h.push({ bloque: 'google', severidad: 'media', titulo: 'Sin datos estructurados (JSON-LD)', detalle: 'Google y los asistentes no saben qué tipo de entidad es.' });
  else h.push({ bloque: 'google', severidad: 'ok', titulo: 'JSON-LD presente', detalle: [...jsonldTipos].slice(0, 6).join(', ') });

  if (!meta(html, 'og:title') && !meta(html, 'og:image')) h.push({ bloque: 'google', severidad: 'baja', titulo: 'Sin Open Graph', detalle: 'Los enlaces compartidos en redes y WhatsApp salen sin imagen ni título.' });

  let ps: ResultadoAuditoria['pagespeed'];
  if (opts.conPagespeed !== false) {
    ps = await pagespeed(home.url);
    if (ps?.score != null) {
      const sev: Severidad = ps.score < 50 ? 'alta' : ps.score < 80 ? 'media' : 'ok';
      const lcp = ps.lcpMs != null ? `LCP ${(ps.lcpMs / 1000).toFixed(1)} s` : '';
      const cls = ps.cls != null ? `CLS ${ps.cls.toFixed(2)}` : '';
      h.push({ bloque: 'google', severidad: sev, titulo: `Rendimiento móvil ${ps.score}/100`, detalle: [lcp, cls].filter(Boolean).join(' · ') });
    }
  }

  // ── 3. Visibilidad en asistentes de IA ──────────────────────────────
  const llmsEsTexto = llms.ok && !/<html/i.test(llms.text);
  if (!llmsEsTexto) h.push({ bloque: 'ia', severidad: 'media', titulo: 'Sin llms.txt', detalle: 'Los asistentes de IA no tienen un resumen de quién es la organización y qué ofrece.' });
  else h.push({ bloque: 'ia', severidad: 'ok', titulo: 'llms.txt presente' });

  if (robotsEsTexto) {
    const bloqueados = botsBloqueados(robots.text);
    if (bloqueados.length) h.push({ bloque: 'ia', severidad: 'alta', titulo: 'Rastreadores de IA bloqueados', detalle: `${bloqueados.join(', ')} no pueden leer la web: no aparecerá en ChatGPT, Claude o Perplexity.` });
    else h.push({ bloque: 'ia', severidad: 'ok', titulo: 'Rastreadores de IA permitidos' });
  }

  const tieneOrg = [...jsonldTipos].some((t) => /Organization|LocalBusiness|NGO|Church|GovernmentOrganization|EducationalOrganization|Corporation/i.test(t));
  if (!tieneOrg) h.push({ bloque: 'ia', severidad: 'media', titulo: 'Sin entidad Organization declarada', detalle: 'Sin nombre, sede y sameAs en JSON-LD, los asistentes confunden a la organización con otras de nombre parecido.' });
  else h.push({ bloque: 'ia', severidad: 'ok', titulo: 'Entidad Organization declarada' });

  // ── 4. Redes ────────────────────────────────────────────────────────
  const redesEncontradas = REDES.filter((r) => r.re.test(html)).map((r) => r.nombre);
  if (redesEncontradas.length === 0) h.push({ bloque: 'redes', severidad: 'media', titulo: 'La web no enlaza a ninguna red social' });
  else h.push({ bloque: 'redes', severidad: 'ok', titulo: `Redes enlazadas: ${redesEncontradas.join(', ')}` });
  const tieneSameAs = /"sameAs"/.test(html);
  if (redesEncontradas.length > 0 && !tieneSameAs) h.push({ bloque: 'redes', severidad: 'baja', titulo: 'Perfiles sin sameAs', detalle: 'Los perfiles sociales no están vinculados a la entidad en los datos estructurados.' });

  return { url, urlFinal: home.url, alcanzable: true, hallazgos: h, pagespeed: ps, duracionMs: Date.now() - t0 };
}

const ICONO: Record<Severidad, string> = { alta: '🔴', media: '🟠', baja: '🟡', ok: '🟢' };
const BLOQUE: Record<Hallazgo['bloque'], string> = { web: 'Web', google: 'Google', ia: 'Asistentes de IA', redes: 'Redes' };

/** Resumen en texto plano (para Telegram, HTML permitido: <b>). */
export function resumenTexto(r: ResultadoAuditoria): string {
  const out: string[] = [];
  const n = (s: Severidad) => r.hallazgos.filter((x) => x.severidad === s).length;
  out.push(`<b>${r.urlFinal}</b> — ${n('alta')} graves · ${n('media')} medios · ${n('baja')} leves · ${n('ok')} ok`);
  for (const b of ['web', 'google', 'ia', 'redes'] as const) {
    const items = r.hallazgos.filter((x) => x.bloque === b && x.severidad !== 'ok');
    if (!items.length) continue;
    out.push('', `<b>${BLOQUE[b]}</b>`);
    for (const x of items) out.push(`${ICONO[x.severidad]} ${x.titulo}${x.detalle ? ` — ${x.detalle}` : ''}`);
  }
  return out.join('\n');
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

/** Resumen HTML para el email a Mario. */
export function resumenHtml(r: ResultadoAuditoria): string {
  const filas = r.hallazgos
    .map((x) => `<tr><td style="padding:4px 8px 4px 0;white-space:nowrap">${ICONO[x.severidad]} ${BLOQUE[x.bloque]}</td><td style="padding:4px 0"><strong>${esc(x.titulo)}</strong>${x.detalle ? `<br><span style="color:#666">${esc(x.detalle)}</span>` : ''}</td></tr>`)
    .join('');
  return `<p style="margin:0 0 8px 0"><a href="${esc(r.urlFinal)}">${esc(r.urlFinal)}</a> · ${Math.round(r.duracionMs / 1000)} s</p><table style="border-collapse:collapse;font-size:13px">${filas}</table>`;
}
