import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RadarAiPack, RadarCandidateInput, RadarStatus } from '../src/lib/radar/types';

const pack: RadarAiPack = {
  resumen_operativo: 'Resumen',
  titulo_propuesta: 'Título',
  eje_mensaje: 'Eje',
  idea_implementable: 'Idea',
  texto_para_publicar: 'Texto',
  call_to_action: 'CTA',
  hashtags: ['#social'],
  riesgos: [],
  formatos_recomendados: ['post'],
  tono: 'directo',
};

function input(overrides: Partial<RadarCandidateInput> = {}): RadarCandidateInput {
  return {
    source: 'reddit',
    sourceItemId: 'post-1',
    sourceUrl: 'https://reddit.test/post-1',
    title: 'Cooperativas y ciudadanía',
    summary: 'Una señal comunitaria',
    tags: ['cooperativa'],
    evidence: ['https://reddit.test/post-1'],
    sourceSignal: 80,
    viralityScore: 70,
    relevanceScore: 60,
    topic: 'cooperativa',
    publishedAt: 1789201800,
    ...overrides,
  };
}

async function freshDb() {
  vi.resetModules();
  const root = mkdtempSync(join(tmpdir(), 'startidea-radar-'));
  process.env.EXPEDIENTES_DIR = root;
  const db = await import('../src/lib/radar/db');
  return { db, root };
}

afterEach(() => {
  delete process.env.EXPEDIENTES_DIR;
  vi.useRealTimers();
});

describe('radar db', () => {
  it('upsert deduplica, guarda publishedAt y conserva revisión y pack ante nueva ingesta', async () => {
    const { db, root } = await freshDb();
    try {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-12T10:00:00Z'));
      expect(db.upsertCandidates([input()])).toBe(1);
      expect(db.upsertCandidates([input(), input()])).toBe(0);
      expect(db.getCandidate('reddit:post-1')).toMatchObject({ id: 'reddit:post-1', publishedAt: 1789201800, status: 'detectada' });

      expect(db.updateCandidateStatus('reddit:post-1', 'validada')).toBe(true);
      expect(db.claimCandidateGeneration('reddit:post-1')).toBe(true);
      expect(db.setCandidateAiPack('reddit:post-1', 'articulo', pack)).toBe(true);
      const reviewed = db.getCandidate('reddit:post-1');
      expect(reviewed).toMatchObject({ status: 'lista', aiLastFocus: 'articulo', aiPack: pack });

      vi.setSystemTime(new Date('2026-09-12T11:00:00Z'));
      expect(db.upsertCandidates([input({ title: 'Título actualizado', sourceSignal: 20 })])).toBe(0);
      expect(db.getCandidate('reddit:post-1')).toMatchObject({
        title: 'Título actualizado',
        status: 'lista',
        aiPack: pack,
        reviewedAt: reviewed?.reviewedAt,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reemplaza señales menores y expone previousSignal y previousSeenAt', async () => {
    const { db, root } = await freshDb();
    try {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-12T10:00:00Z'));
      db.upsertCandidates([input({ sourceSignal: 80, viralityScore: 80, relevanceScore: 70 })]);
      const first = db.getCandidate('reddit:post-1')!;
      vi.setSystemTime(new Date('2026-09-12T11:00:00Z'));
      db.upsertCandidates([input({ sourceSignal: 20, viralityScore: 30, relevanceScore: 10 })]);
      expect(db.getCandidate('reddit:post-1')).toMatchObject({
        sourceSignal: 20,
        viralityScore: 30,
        relevanceScore: 10,
        previousSignal: 80,
        previousSeenAt: first.lastSeenAt,
        lastSeenAt: 1789210800,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('expone getCandidate y stats con totales, estados y fuentes', async () => {
    const { db, root } = await freshDb();
    try {
      db.upsertCandidates([input(), input({ source: 'google-trends', sourceItemId: 'trend-1', sourceUrl: null, title: 'Vivienda social' })]);
      expect(db.getCandidate('reddit:missing')).toBeNull();
      expect(db.statsRadar()).toMatchObject({ total: 2, detectada: 2, bySource: { total: 2, reddit: 1, 'google-trends': 1 } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('claimCandidateGeneration es atómico y solo reclama validada', async () => {
    const { db, root } = await freshDb();
    try {
      db.upsertCandidates([input()]);
      expect(db.claimCandidateGeneration('reddit:post-1')).toBe(false);
      expect(db.updateCandidateStatus('reddit:post-1', 'validada')).toBe(true);
      expect(db.claimCandidateGeneration('reddit:post-1')).toBe(true);
      expect(db.claimCandidateGeneration('reddit:post-1')).toBe(false);
      expect(db.getCandidate('reddit:post-1')?.status).toBe('generando');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('updateCandidateStatus admite CAS y falla si expectedStatus no coincide', async () => {
    const { db, root } = await freshDb();
    try {
      db.upsertCandidates([input()]);
      expect(db.updateCandidateStatus('reddit:post-1', 'validada', 'lista')).toBe(false);
      expect(db.getCandidate('reddit:post-1')?.status).toBe('detectada');
      expect(db.updateCandidateStatus('reddit:post-1', 'validada', 'detectada')).toBe(true);
      expect(db.updateCandidateStatus('reddit:post-1', 'descartada' as RadarStatus, 'detectada')).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('setCandidateAiPack solo escribe durante generando', async () => {
    const { db, root } = await freshDb();
    try {
      db.upsertCandidates([input()]);
      expect(db.setCandidateAiPack('reddit:post-1', 'meme', pack)).toBe(false);
      expect(db.updateCandidateStatus('reddit:post-1', 'validada')).toBe(true);
      expect(db.setCandidateAiPack('reddit:post-1', 'meme', pack)).toBe(false);
      expect(db.claimCandidateGeneration('reddit:post-1')).toBe(true);
      expect(db.setCandidateAiPack('reddit:post-1', 'meme', pack)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
