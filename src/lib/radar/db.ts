/**
 * Base de datos del radar de tendencias.
 *
 * Reutiliza la BD de Startidea (`expedientes.db`) para evitar WAL adicional.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  RadarAiPack,
  RadarCandidate,
  RadarCandidateInput,
  RadarSource,
  RadarStatus,
  RadarStats,
} from './types';
import { safeUrl } from './fetchers';
import { toPack } from './generator';

function getDir(): string {
  return process.env.EXPEDIENTES_DIR ?? '/data/expedientes';
}

let _db: Database.Database | null = null;

function parseArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, 20) : [];
  } catch {
    return [];
  }
}

function serializePack(pack: RadarAiPack | null): string | null {
  if (!pack) return null;
  return JSON.stringify(pack);
}

function parsePack(raw: string | null): RadarAiPack | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return toPack(parsed);
  } catch {
    return null;
  }
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = getDir();
  mkdirSync(dir, { recursive: true });
  const db = new Database(join(dir, 'expedientes.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS trend_radar_candidates (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_item_id TEXT NOT NULL,
      source_url TEXT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      evidence_json TEXT NOT NULL DEFAULT '[]',
      source_signal INTEGER NOT NULL DEFAULT 0,
      virality_score INTEGER NOT NULL DEFAULT 0,
      relevance_score INTEGER NOT NULL DEFAULT 0,
      topic TEXT,
      status TEXT NOT NULL DEFAULT 'detectada',
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      ai_last_focus TEXT,
      ai_pack_json TEXT,
      ai_generated_at INTEGER,
      CONSTRAINT chk_status CHECK (
        status IN ('detectada','validada','descartada','generando','lista','publicada')
      ),
      CONSTRAINT chk_source CHECK (source IN ('google-trends','reddit'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_trend_radar_source_item ON trend_radar_candidates (source, source_item_id);
    CREATE INDEX IF NOT EXISTS ix_trend_radar_status ON trend_radar_candidates (status, updated_at);
    CREATE INDEX IF NOT EXISTS ix_trend_radar_created ON trend_radar_candidates (created_at);
  `);

  // Migraciones ligeras
  const columns = new Set((db.prepare('PRAGMA table_info(trend_radar_candidates)').all() as Array<{ name: string }>).map((c) => c.name));
  for (const [column, kind] of Object.entries({ topic: 'TEXT', review_notes: 'TEXT', published_at: 'INTEGER', previous_signal: 'INTEGER', previous_seen_at: 'INTEGER', generation_started_at: 'INTEGER' })) {
    if (!columns.has(column)) db.exec(`ALTER TABLE trend_radar_candidates ADD COLUMN ${column} ${kind}`);
  }

  _db = db;
  return db;
}

function mapRow(row: Record<string, unknown>): RadarCandidate {
  return {
    id: String(row.id),
    source: row.source as RadarSource,
    sourceItemId: String(row.source_item_id),
    sourceUrl: safeUrl(row.source_url),
    title: String(row.title),
    summary: String(row.summary),
    tags: parseArray(String(row.tags_json || '[]')),
    evidence: parseArray(String(row.evidence_json || '[]')),
    sourceSignal: Number(row.source_signal || 0),
    viralityScore: Number(row.virality_score || 0),
    relevanceScore: Number(row.relevance_score || 0),
    topic: row.topic as string | null,
    status: row.status as RadarStatus,
    createdAt: Number(row.created_at || now()),
    updatedAt: Number(row.updated_at || now()),
    lastSeenAt: Number(row.last_seen_at || now()),
    reviewedAt: row.reviewed_at ? Number(row.reviewed_at) : null,
    aiLastFocus: (row.ai_last_focus as RadarCandidate['aiLastFocus']) ?? null,
    aiPack: parsePack(row.ai_pack_json as string | null),
    aiGeneratedAt: row.ai_generated_at ? Number(row.ai_generated_at) : null,
    publishedAt: row.published_at == null ? null : Number(row.published_at),
    previousSignal: row.previous_signal == null ? null : Number(row.previous_signal),
    previousSeenAt: row.previous_seen_at == null ? null : Number(row.previous_seen_at),
    generationStartedAt: row.generation_started_at == null ? null : Number(row.generation_started_at),
  };
}

export function upsertCandidates(items: RadarCandidateInput[]): number {
  if (!items.length) return 0;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO trend_radar_candidates (
      id, source, source_item_id, source_url, title, summary, tags_json,
      evidence_json, source_signal, virality_score, relevance_score,
      topic, status, reviewed_at, created_at, updated_at, last_seen_at,
      ai_last_focus, ai_pack_json, ai_generated_at, published_at
    ) VALUES (
      @id, @source, @sourceItemId, @sourceUrl, @title, @summary, @tags,
      @evidence, @sourceSignal, @viralityScore, @relevanceScore,
      @topic, 'detectada', NULL, @createdAt, @updatedAt, @lastSeenAt,
      NULL, NULL, NULL, @publishedAt
    )
    ON CONFLICT(source, source_item_id) DO UPDATE SET
      source_url = excluded.source_url,
      title = excluded.title,
      summary = excluded.summary,
      tags_json = excluded.tags_json,
      evidence_json = excluded.evidence_json,
      previous_signal = trend_radar_candidates.source_signal,
      previous_seen_at = trend_radar_candidates.last_seen_at,
      source_signal = excluded.source_signal,
      virality_score = excluded.virality_score,
      relevance_score = excluded.relevance_score,
      published_at = COALESCE(excluded.published_at, trend_radar_candidates.published_at),
      topic = CASE
        WHEN trend_radar_candidates.topic IS NULL AND excluded.topic IS NOT NULL THEN excluded.topic
        ELSE trend_radar_candidates.topic
      END,
      updated_at = excluded.updated_at,
      last_seen_at = excluded.last_seen_at
  `);

  const upsertTx = db.transaction((rows) => {
    const nowTs = now();
    for (const r of rows as RadarCandidateInput[]) {
      stmt.run({
        id: `${r.source}:${r.sourceItemId}`,
        source: r.source,
        sourceItemId: r.sourceItemId,
        sourceUrl: r.sourceUrl,
        title: r.title,
        summary: r.summary,
        tags: JSON.stringify(r.tags),
        evidence: JSON.stringify(r.evidence),
        sourceSignal: r.sourceSignal,
        viralityScore: r.viralityScore,
        relevanceScore: r.relevanceScore,
        topic: r.topic,
        publishedAt: r.publishedAt,
        createdAt: nowTs,
        updatedAt: nowTs,
        lastSeenAt: nowTs,
      });
    }
  });

  const before = db.prepare(`SELECT COUNT(*) AS total FROM trend_radar_candidates`).get() as { total: number };
  upsertTx(items);
  const after = db.prepare(`SELECT COUNT(*) AS total FROM trend_radar_candidates`).get() as { total: number };
  return Math.max(0, after.total - before.total);
}

export function listCandidates(opts: {
  status?: RadarStatus;
  source?: RadarSource;
  q?: string;
  limit?: number;
} = {}): RadarCandidate[] {
  const db = getDb();
  const clauses = ['1=1'];
  const params: (string | number)[] = [];

  if (opts.status) {
    clauses.push('status = ?');
    params.push(opts.status);
  }
  if (opts.source) {
    clauses.push('source = ?');
    params.push(opts.source);
  }
  if (opts.q?.trim()) {
    const like = `%${opts.q.toLowerCase()}%`;
    clauses.push('(LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(topic) LIKE ? OR EXISTS (SELECT 1 FROM json_each(tags_json) WHERE LOWER(value) LIKE ?))');
    params.push(like, like, like, like);
  }

  const sql = `
    SELECT * FROM trend_radar_candidates
    WHERE ${clauses.join(' AND ')}
    ORDER BY
      CASE status
        WHEN 'detectada' THEN 50
        WHEN 'validada' THEN 60
        WHEN 'generando' THEN 30
        WHEN 'lista' THEN 40
        WHEN 'publicada' THEN 10
        ELSE 0
      END DESC,
      (virality_score * 0.6 + relevance_score * 0.4) / (1 + MAX(0, unixepoch() - last_seen_at) / 86400.0) DESC,
      updated_at DESC
    LIMIT ?
  `;
  params.push(opts.limit ?? 150);

  return (db.prepare(sql).all(...params) as unknown[]).map((r) => mapRow(r as Record<string, unknown>));
}

export function getCandidate(id: string): RadarCandidate | null {
  const row = getDb().prepare('SELECT * FROM trend_radar_candidates WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function updateCandidateStatus(id: string, status: RadarStatus, expectedStatus?: RadarStatus): boolean {
  const ts = now();
  const reviewedAt = ['validada', 'descartada', 'lista', 'publicada'].includes(status) ? ts : null;
  const res = getDb().prepare(`
    UPDATE trend_radar_candidates
    SET status = ?, updated_at = ?, reviewed_at = COALESCE(?, reviewed_at)
    WHERE id = ? AND (? IS NULL OR status = ?)
  `).run(status, ts, reviewedAt, id, expectedStatus ?? null, expectedStatus ?? null);
  return res.changes > 0;
}

export function setCandidateAiPack(id: string, focus: RadarCandidate['aiLastFocus'], pack: RadarAiPack): boolean {
  const ts = now();
  const res = getDb().prepare(`
    UPDATE trend_radar_candidates
    SET
      ai_last_focus = ?,
      ai_pack_json = ?,
      ai_generated_at = ?,
      status = CASE WHEN status IN ('detectada', 'validada', 'generando') THEN 'lista' ELSE status END,
      updated_at = ?
    WHERE id = ?
      AND status = 'generando'
  `).run(focus, serializePack(pack), ts, ts, id);
  return res.changes > 0;
}

export function claimCandidateGeneration(id: string): boolean {
  const ts = now();
  return getDb().prepare(`UPDATE trend_radar_candidates SET status = 'generando', generation_started_at = ?, updated_at = ? WHERE id = ? AND status = 'validada'`).run(ts, ts, id).changes > 0;
}

export function statsRadar(): RadarStats {
  const db = getDb();
  const total = Number((db.prepare('SELECT COUNT(*) AS n FROM trend_radar_candidates').get() as { n: number }).n);

  const statusRows = db.prepare(`
    SELECT status, COUNT(*) AS n
    FROM trend_radar_candidates
    GROUP BY status
  `).all() as Array<{ status: RadarStatus; n: number }>;

  const sourceRows = db.prepare(`
    SELECT source, COUNT(*) AS n
    FROM trend_radar_candidates
    GROUP BY source
  `).all() as Array<{ source: RadarSource; n: number }>;

  const out: RadarStats = {
    total,
    detectada: 0,
    validada: 0,
    descartada: 0,
    generando: 0,
    lista: 0,
    publicada: 0,
    bySource: {
      total,
      'google-trends': 0 as number,
      reddit: 0 as number,
    } as RadarStats['bySource'],
  };

  for (const row of statusRows) {
    if (row.status in out) {
      out[row.status] = Number(row.n);
    }
  }
  for (const s of sourceRows) {
    out.bySource[s.source] = Number(s.n);
  }
  return out;
}
