/**
 * GET /api/admin/health
 *
 * Healthcheck async para el panel SOS. Devuelve estado en vivo de:
 *  - HUB voice (hub.startidea.tech/api/public/voice/chat) — ¿responde?
 *  - OpenRouter Claude — ¿la key del .env funciona?
 *  - BD expedientes — ¿abre + tamaño en MB?
 *  - Último cron BDNS — cuándo corrió la última vez (si existe scraper_runs)
 *  - Último expediente — actividad del usuario
 *
 * Se llama desde el navegador (AdminBar / widget SOS) con la cookie admin.
 * Timeout 4s por probe — si algo cuelga, lo reporta como down.
 *
 * Diseño: probes paralelos via Promise.all. Cada probe nunca lanza — siempre
 * devuelve { ok, latency_ms } o { ok: false, error }. La respuesta se cachea
 * 10s en cliente para no martillar OpenRouter.
 */

import type { APIRoute } from 'astro';
import { statSync } from 'node:fs';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { recentScraperRuns, getExpedientesRecientes } from '@/lib/expedientes-db';
import { getEnv } from '@/lib/env';

export const prerender = false;

type ProbeResult = {
  ok: boolean;
  latency_ms: number | null;
  detail?: string;
};

const TIMEOUT_MS = 4000;

async function probeUrl(url: string, init?: RequestInit): Promise<ProbeResult> {
  const t0 = Date.now();
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const latency = Date.now() - t0;
    return {
      ok: res.ok,
      latency_ms: latency,
      detail: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      latency_ms: Date.now() - t0,
      detail: e instanceof Error ? e.message.slice(0, 80) : 'fetch error',
    };
  } finally {
    clearTimeout(id);
  }
}

async function probeHubVoiceChat(): Promise<ProbeResult> {
  // Endpoint público, no requiere auth. Mensaje mínimo para no consumir tokens.
  return probeUrl('https://hub.startidea.tech/api/public/voice/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://startidea.es' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '.' }] }),
  });
}

async function probeOpenRouter(): Promise<ProbeResult> {
  const key = getEnv('OPENROUTER_API_KEY');
  if (!key) return { ok: false, latency_ms: null, detail: 'no_api_key' };
  // /api/v1/models es ligero (no consume créditos) y solo verifica auth.
  return probeUrl('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
  });
}

function probeDbSize(): { ok: boolean; size_mb: number | null; detail?: string } {
  try {
    const path = process.env.EXPEDIENTES_DB_PATH ?? '/data/expedientes/expedientes.db';
    const st = statSync(path);
    return { ok: true, size_mb: Math.round((st.size / 1024 / 1024) * 100) / 100 };
  } catch (e) {
    return {
      ok: false,
      size_mb: null,
      detail: e instanceof Error ? e.message.slice(0, 80) : 'fs error',
    };
  }
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminLoggedIn(cookies)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Probes en paralelo. Cada uno tiene su propio timeout y nunca lanza.
  const [hubVoice, openrouter] = await Promise.all([
    probeHubVoiceChat(),
    probeOpenRouter(),
  ]);

  const dbSize = probeDbSize();

  // Estado de scrapers — última ejecución de cada scraper conocido
  let lastBdnsRun: { at: number; ok: boolean; new_count: number } | null = null;
  try {
    const recent = recentScraperRuns(20);
    const lastBdns = recent.find((r) => r.scraper === 'bdns');
    if (lastBdns) {
      lastBdnsRun = {
        at: lastBdns.started_at,
        ok: lastBdns.ok === 1,
        new_count: lastBdns.total_new,
      };
    }
  } catch { /* tabla aún no migrada */ }

  // Último expediente — actividad reciente del usuario
  let lastExpedienteAt: number | null = null;
  try {
    const recent = getExpedientesRecientes(1);
    if (recent.length > 0) lastExpedienteAt = recent[0].created_at;
  } catch { /* BD vacía */ }

  return new Response(
    JSON.stringify({
      ok: true,
      checked_at: Math.floor(Date.now() / 1000),
      probes: {
        hub_voice:  hubVoice,
        openrouter: openrouter,
        db:         dbSize,
      },
      activity: {
        last_bdns_run:      lastBdnsRun,
        last_expediente_at: lastExpedienteAt,
      },
    }),
    {
      headers: {
        'content-type':  'application/json',
        'cache-control': 'private, max-age=10',
      },
    },
  );
};
