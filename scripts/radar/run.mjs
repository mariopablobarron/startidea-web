#!/usr/bin/env node
/**
 * Script de ejecución del radar.
 *
 * Ejecuta detección + guardado de tendencias.
 *
 * Uso:
 *   ADMIN_TOKEN=xxx node scripts/radar/run.mjs
 *   ADMIN_TOKEN=xxx node scripts/radar/run.mjs --base https://startidea.es --max 20 --floor 5
 */

import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const next = args[idx + 1];
  return next && !next.startsWith('--') ? next : fallback;
};

const BASE = getArg('base', 'http://127.0.0.1:4321').replace(/\/$/, '');
const maxPerSource = Number(getArg('max', '18')) || 18;
const signalFloor = Number(getArg('floor', '0')) || 0;

const rawToken = process.env.ADMIN_TOKEN;
if (!rawToken) {
  console.error('[radar/run] Falta ADMIN_TOKEN en entorno');
  process.exit(1);
}

// ADMIN_TOKEN is always the raw secret, even when it happens to be 64 hex chars.
const token = createHash('sha256').update(rawToken).digest('hex');

async function main() {
  const res = await fetch(`${BASE}/api/admin/radar/fetch`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify({
      maxPerSource,
      signalFloor,
    }),
  });

  const body = await res.text();
  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    // no-op
  }

  if (!res.ok || !(payload?.ok)) {
    console.error('[radar/run] Error:', res.status, body.slice(0, 300));
    process.exit(1);
  }

  console.log('[radar/run] OK:', payload);
  process.exit(0);
}

main().catch((err) => {
  console.error('[radar/run] Fallo:', err?.message || err);
  process.exit(1);
});
