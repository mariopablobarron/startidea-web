import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RadarAiPack, RadarCandidateInput } from '../src/lib/radar/types';

const pack: RadarAiPack = {
  resumen_operativo: 'Resumen', titulo_propuesta: 'Título', eje_mensaje: 'Eje', idea_implementable: 'Idea',
  texto_para_publicar: 'Texto', call_to_action: 'CTA', hashtags: ['#social'], riesgos: [],
  formatos_recomendados: ['post'], tono: 'directo',
};

function candidate(): RadarCandidateInput {
  return {
    source: 'reddit', sourceItemId: 'route-1', sourceUrl: 'https://reddit.test/route-1',
    title: 'Cooperativas y ciudadanía', summary: 'Señal', tags: ['cooperativa'], evidence: [],
    sourceSignal: 50, viralityScore: 50, relevanceScore: 40, topic: 'cooperativa', publishedAt: 1789201800,
  };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://startidea.es/api/admin/radar/candidate', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}

function formRequest(path: string, body: string, headers: Record<string, string> = {}) {
  return new Request(`https://startidea.es${path}`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body,
  });
}

function authHeaders() {
  const token = process.env.ADMIN_TOKEN!;
  return { 'x-admin-token': createHash('sha256').update(token).digest('hex') };
}

function cookies(value?: string) {
  return { get: () => value ? { value } : undefined } as never;
}

async function freshRoute() {
  vi.resetModules();
  const root = mkdtempSync(join(tmpdir(), 'startidea-radar-route-'));
  vi.stubEnv('EXPEDIENTES_DIR', root);
  const db = await import('../src/lib/radar/db');
  const routes = {
    fetch: await import('../src/pages/api/admin/radar/fetch'),
    candidate: await import('../src/pages/api/admin/radar/candidate'),
    generate: await import('../src/pages/api/admin/radar/generate'),
  };
  return { db, routes, root };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

vi.mock('../src/lib/radar/generator', () => ({ generateRadarIdea: vi.fn(async () => pack) }));

describe('radar routes', () => {
  it('devuelve 401 sin autenticación y 403 para cookie válida cross-origin', async () => {
    vi.stubEnv('ADMIN_TOKEN', 'route-test-token');
    const { routes, root } = await freshRoute();
    try {
      const denied = await routes.candidate.POST({ request: request({ id: 'x', status: 'validada' }), cookies: cookies() } as never);
      expect(denied.status).toBe(401);
      const session = createHash('sha256').update(process.env.ADMIN_TOKEN!).digest('hex');
      const crossOrigin = await routes.candidate.POST({
        request: request({ id: 'x', status: 'validada' }, { origin: 'https://evil.example' }), cookies: cookies(session),
      } as never);
      expect(crossOrigin.status).toBe(403);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('rechaza id JSON nulo o numérico con 400 y devuelve 303 para POST form válido', async () => {
    vi.stubEnv('ADMIN_TOKEN', 'route-test-token');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const { routes, db, root } = await freshRoute();
    try {
      for (const id of [null, 12]) {
        const response = await routes.candidate.POST({ request: request({ id, status: 'validada' }, authHeaders()), cookies: cookies() } as never);
        expect(response.status).toBe(400);
      }
      db.upsertCandidates([candidate()]);
      const response = await routes.candidate.POST({
        request: formRequest('/api/admin/radar/candidate', 'id=reddit%3Aroute-1&status=validada', authHeaders()), cookies: cookies(),
      } as never);
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toContain('status-updated');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('devuelve 502 si caen todas las fuentes y 200 con partial si cae una', async () => {
    vi.stubEnv('ADMIN_TOKEN', 'route-test-token');
    const { routes, root } = await freshRoute();
    try {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
      const total = await routes.fetch.POST({ request: new Request('https://startidea.es/api/admin/radar/fetch', { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders() }, body: '{}' }), cookies: cookies() } as never);
      expect(total.status).toBe(502);

      const partialFetch = vi.fn().mockResolvedValueOnce({ ok: true, text: async () => '<rss><channel></channel></rss>' }).mockRejectedValueOnce(new Error('timeout'));
      vi.stubGlobal('fetch', partialFetch);
      const partial = await routes.fetch.POST({ request: new Request('https://startidea.es/api/admin/radar/fetch', { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders() }, body: '{}' }), cookies: cookies() } as never);
      expect(partial.status).toBe(200);
      expect(await partial.json()).toMatchObject({ ok: true, partial: true });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('genera: 503 sin configuración, 409 si no está validada y vuelve a validada ante fallo', async () => {
    vi.stubEnv('ADMIN_TOKEN', 'route-test-token');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const { routes, db, root } = await freshRoute();
    try {
      db.upsertCandidates([candidate()]);
      const noAi = await routes.generate.POST({ request: request({ id: 'reddit:route-1', focus: 'meme' }, authHeaders()), cookies: cookies() } as never);
      expect(noAi.status).toBe(503);
      vi.stubEnv('OPENROUTER_API_KEY', 'configured');
      const notValidated = await routes.generate.POST({ request: request({ id: 'reddit:route-1', focus: 'meme' }, authHeaders()), cookies: cookies() } as never);
      expect(notValidated.status).toBe(409);
      db.updateCandidateStatus('reddit:route-1', 'validada');
      const generator = await import('../src/lib/radar/generator');
      vi.mocked(generator.generateRadarIdea).mockRejectedValueOnce(new Error('provider failed'));
      const failed = await routes.generate.POST({ request: request({ id: 'reddit:route-1', focus: 'meme' }, authHeaders()), cookies: cookies() } as never);
      expect(failed.status).toBe(502);
      expect(db.getCandidate('reddit:route-1')?.status).toBe('validada');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('solo permite un claim concurrente y el segundo devuelve 409', async () => {
    vi.stubEnv('ADMIN_TOKEN', 'route-test-token');
    vi.stubEnv('OPENROUTER_API_KEY', 'configured');
    const { routes, db, root } = await freshRoute();
    try {
      db.upsertCandidates([candidate()]);
      db.updateCandidateStatus('reddit:route-1', 'validada');
      const generator = await import('../src/lib/radar/generator');
      let release!: () => void;
      const waiting = new Promise<RadarAiPack>((resolve) => { release = () => resolve(pack); });
      vi.mocked(generator.generateRadarIdea).mockReturnValueOnce(waiting);
      const first = routes.generate.POST({ request: request({ id: 'reddit:route-1', focus: 'contenido' }, authHeaders()), cookies: cookies() } as never);
      const second = await routes.generate.POST({ request: request({ id: 'reddit:route-1', focus: 'contenido' }, authHeaders()), cookies: cookies() } as never);
      expect(second.status).toBe(409);
      release();
      expect((await first).status).toBe(200);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
