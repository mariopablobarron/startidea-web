/**
 * seo-mini.ts — análisis SEO rápido y REAL de una URL para el regalo
 * «informe-seo» del Plano Startidea.
 *
 * Sin dependencias: fetch nativo + regex sobre el HTML. Extrae hechos
 * (title, description, H1, imágenes sin alt, enlaces, robots, sitemap,
 * viewport, JSON-LD, tiempo de respuesta…) y deja que el modelo redacte.
 *
 * Seguridad (SSRF): solo http(s), sin credenciales en la URL, host público
 * (se resuelve el DNS y se rechazan rangos privados/loopback/link-local),
 * puertos 80/443, timeout 8 s, máximo 1,5 MB, sin seguir redirecciones a
 * hosts privados (se re-valida cada salto manualmente).
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface HechosSeo {
  url: string;
  urlFinal: string;
  status: number;
  https: boolean;
  ms: number;
  bytes: number;
  title: string;
  titleLen: number;
  description: string;
  descriptionLen: number;
  canonical: string;
  lang: string;
  viewport: boolean;
  robotsMeta: string;
  h1: string[];
  h2Count: number;
  imgTotal: number;
  imgSinAlt: number;
  enlacesInternos: number;
  enlacesExternos: number;
  ogTitle: boolean;
  ogImage: boolean;
  jsonLd: number;
  palabras: number;
  robotsTxt: boolean;
  sitemap: boolean;
  avisos: string[];
}

const UA = 'Mozilla/5.0 (compatible; StartideaPlano/1.0; +https://startidea.es/asistente)';

function esPrivada(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('::ffff:');
}

async function validarUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error('URL no válida');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Solo http o https');
  if (u.username || u.password) throw new Error('URL con credenciales');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Puerto no permitido');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Host no público');
  if (isIP(host)) {
    if (esPrivada(host)) throw new Error('IP privada');
  } else {
    const res = await lookup(host, { all: true }).catch(() => []);
    if (!Array.isArray(res) || res.length === 0) throw new Error('El dominio no resuelve');
    if (res.some((r) => esPrivada(r.address))) throw new Error('El dominio apunta a una red privada');
  }
  return u;
}

async function fetchSeguro(u: URL, opts: { method?: 'GET' | 'HEAD'; maxBytes?: number; saltos?: number } = {}): Promise<{ res: Response; body: string; urlFinal: string }> {
  const method = opts.method ?? 'GET';
  const maxBytes = opts.maxBytes ?? 1_500_000;
  let actual = u;
  for (let i = 0; i <= (opts.saltos ?? 3); i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(actual.toString(), {
        method,
        redirect: 'manual',
        signal: ctl.signal,
        headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.5', 'accept-language': 'es-ES,es;q=0.9' },
      });
    } finally {
      clearTimeout(t);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { res, body: '', urlFinal: actual.toString() };
      actual = await validarUrl(new URL(loc, actual).toString());
      continue;
    }
    if (method === 'HEAD') return { res, body: '', urlFinal: actual.toString() };
    const ctype = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(ctype)) {
      return { res, body: '', urlFinal: actual.toString() };
    }
    const reader = res.body?.getReader();
    if (!reader) return { res, body: '', urlFinal: actual.toString() };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        chunks.push(value);
        if (total > maxBytes) { reader.cancel().catch(() => {}); break; }
      }
    }
    const body = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return { res, body, urlFinal: actual.toString() };
  }
  throw new Error('Demasiadas redirecciones');
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return (m?.[2] ?? m?.[3] ?? m?.[4] ?? '').trim();
}
function metas(html: string): string[] {
  return html.match(/<meta\b[^>]*>/gi) ?? [];
}
function metaContent(html: string, key: 'name' | 'property', value: string): string {
  for (const m of metas(html)) {
    if (attr(m, key).toLowerCase() === value.toLowerCase()) return decode(attr(m, 'content'));
  }
  return '';
}
function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function textoDe(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(decode(m[1].replace(/<[^>]+>/g, ' ')));
  return out;
}

export async function analizarUrl(raw: string): Promise<HechosSeo> {
  const u = await validarUrl(raw.trim());
  const t0 = Date.now();
  const { res, body: html, urlFinal } = await fetchSeguro(u);
  const ms = Date.now() - t0;
  if (!html) throw new Error(`La página no devolvió HTML (estado ${res.status})`);

  const final = new URL(urlFinal);
  const head = html.slice(0, 200_000);
  const title = decode((head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''));
  const description = metaContent(head, 'name', 'description');
  const canonical = (() => {
    for (const l of head.match(/<link\b[^>]*>/gi) ?? []) {
      if (attr(l, 'rel').toLowerCase().split(/\s+/).includes('canonical')) return attr(l, 'href');
    }
    return '';
  })();
  const lang = attr(html.match(/<html\b[^>]*>/i)?.[0] ?? '', 'lang');
  const viewport = !!metaContent(head, 'name', 'viewport');
  const robotsMeta = metaContent(head, 'name', 'robots');
  const h1 = textoDe(html, 'h1').filter(Boolean).slice(0, 5);
  const h2Count = (html.match(/<h2\b/gi) ?? []).length;
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const imgSinAlt = imgs.filter((i) => !/\salt\s*=/i.test(i) || attr(i, 'alt') === '').length;
  const anchors = html.match(/<a\b[^>]*href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi) ?? [];
  let internos = 0, externos = 0;
  for (const a of anchors) {
    const href = attr(a, 'href');
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      const h = new URL(href, final);
      if (h.hostname === final.hostname) internos++; else externos++;
    } catch { /* ignora */ }
  }
  const ogTitle = !!metaContent(head, 'property', 'og:title');
  const ogImage = !!metaContent(head, 'property', 'og:image');
  const jsonLd = (html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/gi) ?? []).length;
  const texto = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const palabras = decode(texto).split(/\s+/).filter((w) => w.length > 1).length;

  const [robotsTxt, sitemap] = await Promise.all([
    fetchSeguro(new URL('/robots.txt', final), { method: 'HEAD', saltos: 1 }).then((r) => r.res.status === 200).catch(() => false),
    fetchSeguro(new URL('/sitemap.xml', final), { method: 'HEAD', saltos: 1 }).then((r) => r.res.status === 200).catch(() => false),
  ]);

  const avisos: string[] = [];
  if (!title) avisos.push('Sin <title>');
  else if (title.length > 65) avisos.push(`Title largo (${title.length} caracteres; Google corta en ~60)`);
  else if (title.length < 25) avisos.push(`Title muy corto (${title.length} caracteres)`);
  if (!description) avisos.push('Sin meta description');
  else if (description.length > 160) avisos.push(`Description larga (${description.length} caracteres)`);
  if (h1.length === 0) avisos.push('Sin H1');
  if (h1.length > 1) avisos.push(`${h1.length} H1 en la misma página`);
  if (imgSinAlt > 0) avisos.push(`${imgSinAlt} de ${imgs.length} imágenes sin texto alternativo`);
  if (!viewport) avisos.push('Sin meta viewport (no se adapta a móvil)');
  if (!lang) avisos.push('Sin atributo lang en <html>');
  if (/noindex/i.test(robotsMeta)) avisos.push('La página lleva noindex: Google no la indexa');
  if (!ogTitle || !ogImage) avisos.push('Faltan etiquetas Open Graph (cómo se ve al compartir en redes y WhatsApp)');
  if (jsonLd === 0) avisos.push('Sin datos estructurados JSON-LD (Google y los asistentes de IA entienden peor la página)');
  if (!robotsTxt) avisos.push('Sin robots.txt');
  if (!sitemap) avisos.push('Sin sitemap.xml en la raíz');
  if (final.protocol !== 'https:') avisos.push('La web no sirve por HTTPS');
  if (ms > 2500) avisos.push(`Respuesta lenta del servidor (${ms} ms)`);
  if (palabras < 150) avisos.push(`Muy poco texto (${palabras} palabras): poco que indexar`);
  if (internos < 5) avisos.push(`Pocos enlaces internos (${internos})`);

  return {
    url: u.toString(), urlFinal, status: res.status, https: final.protocol === 'https:', ms, bytes: html.length,
    title, titleLen: title.length, description, descriptionLen: description.length, canonical, lang, viewport, robotsMeta,
    h1, h2Count, imgTotal: imgs.length, imgSinAlt, enlacesInternos: internos, enlacesExternos: externos,
    ogTitle, ogImage, jsonLd, palabras, robotsTxt, sitemap, avisos,
  };
}

/** Texto compacto para el prompt del modelo. */
export function hechosParaModelo(h: HechosSeo): string {
  return [
    `URL analizada: ${h.urlFinal} (estado ${h.status}, ${h.https ? 'HTTPS' : 'sin HTTPS'}, ${h.ms} ms, ${Math.round(h.bytes / 1024)} KB de HTML)`,
    `Title (${h.titleLen}): ${h.title || '—'}`,
    `Description (${h.descriptionLen}): ${h.description || '—'}`,
    `Canonical: ${h.canonical || '—'} · lang: ${h.lang || '—'} · viewport: ${h.viewport ? 'sí' : 'no'} · robots meta: ${h.robotsMeta || '—'}`,
    `H1 (${h.h1.length}): ${h.h1.join(' | ') || '—'} · H2: ${h.h2Count}`,
    `Imágenes: ${h.imgTotal}, sin alt: ${h.imgSinAlt}`,
    `Enlaces internos: ${h.enlacesInternos} · externos: ${h.enlacesExternos}`,
    `Open Graph title/image: ${h.ogTitle ? 'sí' : 'no'}/${h.ogImage ? 'sí' : 'no'} · JSON-LD: ${h.jsonLd}`,
    `Palabras visibles: ${h.palabras} · robots.txt: ${h.robotsTxt ? 'sí' : 'no'} · sitemap.xml: ${h.sitemap ? 'sí' : 'no'}`,
    `Avisos detectados (${h.avisos.length}): ${h.avisos.join('; ') || 'ninguno'}`,
  ].join('\n');
}
