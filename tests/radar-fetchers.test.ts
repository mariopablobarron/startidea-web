import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectCandidates, parseGoogleTrends, parseRedditTop } from '../src/lib/radar/fetchers';

const trendsXml = `<?xml version="1.0"?>
<rss xmlns:ht="https://trends.google.com/trends/">
  <channel>
    <item>
      <title><![CDATA[Voluntariado en Andalucía]]></title>
      <description><![CDATA[Más personas buscan inclusión social y apoyo comunitario.]]></description>
      <link><![CDATA[https://example.test/trend/shared]]></link>
      <pubDate>Sat, 12 Sep 2026 08:30:00 GMT</pubDate>
      <ht:approx_traffic><![CDATA[200K+]]></ht:approx_traffic>
    </item>
    <item>
      <title>Vivienda para jóvenes</title>
      <description>Una señal sin dato de tráfico.</description>
      <link>https://example.test/trend/shared</link>
      <pubDate>Sat, 12 Sep 2026 09:30:00 GMT</pubDate>
      <ht:approx_traffic>5,000+</ht:approx_traffic>
    </item>
    <item>
      <title>Tráfico no disponible</title>
      <description>Sin métrica.</description>
      <link>https://example.test/trend/tres</link>
      <pubDate>Sat, 12 Sep 2026 10:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const redditPayload = {
  data: {
    children: [
      { data: { id: 'abc123', title: 'Cooperativas y ciudadanía', selftext: 'Una conversación', url: 'https://reddit.test/a', ups: 100, num_comments: 20, created_utc: 1789201800 } },
      { data: { id: 'abc124', title: 'Sin enlace javascript', selftext: 'Contenido', url: 'javascript:alert(1)', ups: 10, num_comments: 2, created_utc: 1789201801 } },
    ],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('radar fetchers', () => {
  it('parsea RSS con namespace, CDATA y tráfico 200K+, 2M+ y 5,000+', () => {
    const xml = trendsXml.replace('5,000+', '2M+');
    const candidates = parseGoogleTrends(xml);

    expect(candidates.map((candidate) => candidate.sourceSignal)).toEqual([200000, 2000000, 0]);
    expect(candidates[0]).toMatchObject({
      title: 'Voluntariado en Andalucía',
      sourceUrl: expect.stringMatching(/^https:\/\/trends\.google\.com\/trending\?geo=ES&q=/),
      publishedAt: Date.parse('Sat, 12 Sep 2026 08:30:00 GMT') / 1000,
    });
    expect(candidates[0].sourceItemId).not.toBe(candidates[1].sourceItemId);
    expect(candidates[0].sourceUrl).toMatch(/^https:\/\//);
    expect(candidates[0].summary).toContain('inclusión social');
  });

  it('convierte 5,000+ y deja sin tráfico en cero, sin inventar señales', () => {
    const candidates = parseGoogleTrends(trendsXml);

    expect(candidates[1].sourceSignal).toBe(5000);
    expect(candidates[2].sourceSignal).toBe(0);
    expect(candidates[2].viralityScore).toBeLessThan(candidates[1].viralityScore);
  });

  it('mantiene IDs estables, fechas correctas, acentos y TREND_KEYWORDS', () => {
    vi.stubEnv('TREND_KEYWORDS', 'inclusión social,cooperativa');
    const first = parseGoogleTrends(trendsXml);
    const second = parseGoogleTrends(trendsXml);

    expect(first.map((candidate) => candidate.sourceItemId)).toEqual(second.map((candidate) => candidate.sourceItemId));
    expect(first[0].topic).toBe('inclusión social');
    expect(first[0].tags).toContain('inclusión social');
    expect(first[0].publishedAt).toBe(1789201800);
  });

  it('parsea Reddit, conserva la fecha de creación y descarta enlaces javascript', () => {
    const candidates = parseRedditTop(redditPayload);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      source: 'reddit',
      sourceItemId: expect.any(String),
      publishedAt: 1789201800,
      sourceUrl: 'https://reddit.test/a',
    });
    expect(candidates[1].sourceUrl).toBeNull();
    expect(candidates[1].evidence).toEqual([]);
  });

  it('reporta éxito parcial y fallo total por fuente sin lanzar', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => trendsXml })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);

    const partial = await collectCandidates({ maxPerSource: 10, signalFloor: 0 });
    expect(partial.sources).toEqual([
      { source: 'google-trends', ok: true, count: 3 },
      { source: 'reddit', ok: false, count: 0, error: 'HTTP_503' },
    ]);
    expect(partial.candidates.every((candidate) => candidate.source === 'google-trends')).toBe(true);

    fetchMock.mockReset().mockRejectedValue(new Error('red no disponible'));
    const total = await collectCandidates();
    expect(total.candidates).toEqual([]);
    expect(total.sources).toEqual([
      { source: 'google-trends', ok: false, count: 0, error: 'source_unavailable' },
      { source: 'reddit', ok: false, count: 0, error: 'source_unavailable' },
    ]);
  });

  it('aplica límites mecánicos de maxPerSource 1..30 y signalFloor 0..100', async () => {
    const manyTrends = trendsXml.replace('</channel>', `${Array.from({ length: 35 }, (_, i) => `<item><title>Tendencia ${i}</title><description>Dato</description><link>https://example.test/${i}</link><pubDate>Sat, 12 Sep 2026 08:30:00 GMT</pubDate><ht:approx_traffic>5</ht:approx_traffic></item>`).join('')}</channel>`);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => manyTrends, json: async () => ({ data: { children: [] } }) });
    vi.stubGlobal('fetch', fetchMock);

    const minimum = await collectCandidates({ maxPerSource: 0, signalFloor: -10 });
    expect(minimum.sources[0].count).toBe(1);
    expect(minimum.candidates.every((candidate) => candidate.viralityScore >= 0)).toBe(true);

    const maximum = await collectCandidates({ maxPerSource: 99, signalFloor: 0 });
    expect(maximum.sources[0].count).toBe(30);
    expect(maximum.candidates.length).toBeLessThanOrEqual(30);

    const filtered = await collectCandidates({ maxPerSource: 99, signalFloor: 999 });
    expect(filtered.sources[0].count).toBe(0);
    expect(filtered.candidates).toEqual([]);
  });
});
