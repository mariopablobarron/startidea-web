#!/usr/bin/env node
/**
 * scripts/refresh-subsidies-snapshot.mjs
 *
 * Regenera y mantiene el snapshot local LAST_KNOWN_GOOD_DATA en src/data/subsidies-snapshot.json.
 *
 * POLÍTICA DE GOBERNANZA:
 * - SNAPSHOT_OWNER: Mario Pablo Sánchez Barrón / Startidea Engineering
 * - SNAPSHOT_SOURCE: https://hub.startidea.tech/api/public/subsidies
 * - MAX_ACCEPTABLE_AGE: 7 días
 * - REFRESH_MECHANISM: node scripts/refresh-subsidies-snapshot.mjs
 * - FAILURE_BEHAVIOR: Ante errores de red, HTTP 503 o respuestas vacías, preserva íntegro
 *   el último snapshot válido (LAST_KNOWN_GOOD_DATA) sin corromper el fichero.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.resolve(__dirname, '../src/data/subsidies-snapshot.json');

const HUB_BASE_URL = process.env.HUB_URL || 'https://hub.startidea.tech';
const TIMEOUT_MS = 10000;

const QUERIES = {
  andalucia: `${HUB_BASE_URL}/api/public/subsidies?ccaa=andalucia&status=abierto&pageSize=50&sort=recent`,
  granada: `${HUB_BASE_URL}/api/public/subsidies?province=granada&status=abierto&pageSize=50&sort=recent`,
  estatal: `${HUB_BASE_URL}/api/public/subsidies?scope=nacional&status=abierto&pageSize=50&sort=recent`,
};

const isDryRun = process.argv.includes('--dry-run');

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Startidea-Snapshot-Refresher/1.0',
      },
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function run() {
  console.log('=== Startidea Subsidies Snapshot Refresher ===');
  console.log(`Target file: ${SNAPSHOT_PATH}`);
  if (isDryRun) console.log('[DRY RUN MODE: No changes will be written]');

  let existingData = {};
  if (fs.existsSync(SNAPSHOT_PATH)) {
    try {
      existingData = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
      console.log(`Loaded existing snapshot generated at: ${existingData.generatedAt || 'unknown'}`);
    } catch (e) {
      console.warn('Existing snapshot is not valid JSON; fallback to empty base.');
    }
  }

  const updatedData = {
    generatedAt: new Date().toISOString(),
    andalucia: existingData.andalucia || { items: [], total: 0 },
    granada: existingData.granada || { items: [], total: 0 },
    estatal: existingData.estatal || { items: [], total: 0 },
  };

  let anyUpdated = false;
  let anyError = false;

  for (const [key, url] of Object.entries(QUERIES)) {
    process.stdout.write(`Fetching ${key} (${url})... `);
    try {
      const res = await fetchWithTimeout(url, TIMEOUT_MS);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('Response returned empty or invalid items array');
      }

      updatedData[key] = {
        total: data.total ?? data.items.length,
        items: data.items,
      };
      anyUpdated = true;
      console.log(`OK (${data.items.length} items, total: ${data.total ?? data.items.length})`);
    } catch (err) {
      anyError = true;
      console.log(`FAILED (${err.message}). Retaining previous LAST_KNOWN_GOOD_DATA.`);
    }
  }

  if (!anyUpdated && anyError) {
    console.error('All queries failed to return valid data. Snapshot file left untouched.');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('Dry run complete. No file written.');
    return;
  }

  const tmpPath = `${SNAPSHOT_PATH}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(updatedData, null, 2), 'utf8');
  fs.renameSync(tmpPath, SNAPSHOT_PATH);
  console.log(`Snapshot successfully refreshed at ${updatedData.generatedAt}`);
}

run().catch((err) => {
  console.error('Fatal error during snapshot refresh:', err);
  process.exit(1);
});
