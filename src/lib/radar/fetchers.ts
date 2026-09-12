import { createHash } from 'node:crypto';
import type { RadarCandidateInput, RadarCollection, RadarSource } from './types';

const DEFAULT_THEMES = ['inclusion social', 'tercer sector', 'asociacion', 'fundacion', 'cooperativa', 'voluntariado', 'ciudadania', 'empleo', 'juventud', 'comunidad', 'solidaridad', 'vivienda', 'educacion', 'innovacion', 'inteligencia artificial', 'comunicacion', 'emprendimiento', 'granada', 'empresa social'];
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function safeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function clean(raw: string): string {
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (x) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[x] || x)
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
      const value = n.toLowerCase().startsWith('x') ? parseInt(n.slice(1), 16) : Number(n);
      return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
    }).replace(/\s+/g, ' ').trim();
}

function tag(text: string, name: string): string {
  const match = text.match(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${name}>`, 'i'));
  return clean(match?.[1] || '');
}

function traffic(raw: string): number {
  const text = raw.trim().replace(/\+/g, '');
  const unit = text.match(/([\d.,]+)\s*([KM])$/i);
  const value = unit ? Number(unit[1].replace(',', '.')) * (unit[2].toUpperCase() === 'K' ? 1000 : 1000000) : Number(text.replace(/[.,\s]/g, ''));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function theme(title: string, summary: string) {
  const keywords = process.env.TREND_KEYWORDS?.trim() ? process.env.TREND_KEYWORDS.split(',') : DEFAULT_THEMES;
  const haystack = normalize(`${title} ${summary}`);
  const matched = [...new Set(keywords.map((x) => x.trim().toLowerCase()).filter((x) => x.length > 2 && haystack.includes(normalize(x))))];
  return { relevanceScore: clamp(matched.length * 20), topic: matched[0] || null, tags: matched.slice(0, 10) };
}

function itemId(source: RadarSource, identity: string): string {
  return createHash('sha256').update(`${source}::${identity}`).digest('hex').slice(0, 40);
}

function potential(signal: number, publishedAt: number | null, source: RadarSource): number {
  if (signal <= 0) return 0;
  const ageHours = publishedAt === null ? null : Math.max(0, (Date.now() / 1000 - publishedAt) / 3600);
  const freshness = ageHours === null ? 0.6 : Math.max(0.15, 1 - ageHours / 96);
  return clamp((Math.log10(signal + 1) / (source === 'google-trends' ? 6 : 5)) * 100 * freshness);
}

export function parseGoogleTrends(xml: string): RadarCandidateInput[] {
  if (!/<rss\b/i.test(xml)) throw new Error('invalid_feed');
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap((match) => {
    const body = match[1];
    const title = tag(body, 'title').slice(0, 180);
    if (!title) return [];
    const date = Date.parse(tag(body, 'pubDate'));
    const publishedAt = Number.isFinite(date) ? Math.floor(date / 1000) : null;
    const articles = [...body.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/gi)].map((m) => m[1]);
    const evidence = articles.map((article) => safeUrl(tag(article, 'news_item_url'))).filter((x): x is string => !!x).slice(0, 5);
    const summary = (tag(body, 'description') || articles.map((article) => tag(article, 'news_item_title')).filter(Boolean).join(' · ')).slice(0, 600);
    // The live RSS repeats the SAME feed link for every item. It is not an identity.
    const sourceUrl = `https://trends.google.com/trending?geo=ES&q=${encodeURIComponent(title)}`;
    const signal = traffic(tag(body, 'approx_traffic'));
    return [{ source: 'google-trends' as const,
      sourceItemId: itemId('google-trends', `${normalize(title)}::${publishedAt === null ? 'undated' : new Date(publishedAt * 1000).toISOString().slice(0, 10)}`),
      sourceUrl, title, summary, evidence, sourceSignal: signal,
      viralityScore: potential(signal, publishedAt, 'google-trends'), publishedAt, ...theme(title, summary) }];
  });
}

export function parseRedditTop(payload: unknown): RadarCandidateInput[] {
  const data = payload as { data?: { children?: Array<{ data?: Record<string, unknown> }> } } | null;
  if (!Array.isArray(data?.data?.children)) throw new Error('invalid_feed');
  return data.data.children.flatMap(({ data: item }) => {
    if (!item || typeof item.title !== 'string' || typeof item.id !== 'string' || item.over_18 === true) return [];
    const title = clean(item.title).slice(0, 180);
    const summary = typeof item.selftext === 'string' ? clean(item.selftext).slice(0, 600) : '';
    const permalink = typeof item.permalink === 'string' && item.permalink.startsWith('/r/') ? `https://www.reddit.com${item.permalink}` : null;
    const sourceUrl = safeUrl(permalink) || safeUrl(item.url);
    const ups = typeof item.ups === 'number' && Number.isFinite(item.ups) ? Math.max(0, item.ups) : 0;
    const comments = typeof item.num_comments === 'number' && Number.isFinite(item.num_comments) ? Math.max(0, item.num_comments) : 0;
    const signal = Math.round(ups + comments * 1.8);
    const publishedAt = typeof item.created_utc === 'number' && Number.isFinite(item.created_utc) ? Math.floor(item.created_utc) : null;
    return [{ source: 'reddit' as const, sourceItemId: itemId('reddit', item.id), sourceUrl, title, summary,
      evidence: sourceUrl ? [sourceUrl] : [], sourceSignal: signal,
      viralityScore: potential(signal, publishedAt, 'reddit'), publishedAt, ...theme(title, summary) }];
  });
}

export async function collectCandidates(options: { maxPerSource?: number; signalFloor?: number } = {}): Promise<RadarCollection> {
  const max = Number.isFinite(options.maxPerSource) ? Math.max(1, Math.min(30, Math.floor(options.maxPerSource!))) : 18;
  const floor = Number.isFinite(options.signalFloor) ? clamp(options.signalFloor!) : 0;
  const sources: Array<{ source: RadarSource; url: string }> = [
    { source: 'google-trends', url: 'https://trends.google.com/trending/rss?geo=ES' },
    { source: 'reddit', url: `https://www.reddit.com/r/all/top.json?limit=${max}&t=day` },
  ];
  const results = await Promise.all(sources.map(async ({ source, url }) => {
    try {
      const res = await fetch(url, { headers: { accept: source === 'reddit' ? 'application/json' : 'application/rss+xml', 'user-agent': 'StartideaTrendRadar/1.0 (+https://startidea.es)' }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const items = source === 'reddit' ? parseRedditTop(await res.json()) : parseGoogleTrends(await res.text());
      const seen = new Set<string>();
      const candidates = items.filter((item) => {
        if (seen.has(item.sourceItemId)) return false;
        seen.add(item.sourceItemId);
        return item.viralityScore >= floor;
      }).sort((a, b) => b.viralityScore - a.viralityScore).slice(0, max);
      return { candidates, report: { source, ok: true, count: candidates.length } };
    } catch (err) {
      const error = err instanceof Error && /^HTTP_\d+$/.test(err.message) ? err.message : 'source_unavailable';
      return { candidates: [] as RadarCandidateInput[], report: { source, ok: false, count: 0, error } };
    }
  }));
  return { candidates: results.flatMap((result) => result.candidates), sources: results.map((result) => result.report) };
}
