#!/usr/bin/env node
/**
 * Importa un lote de fichas curadas al catálogo de /subvenciones/catalogo/
 * vía POST /api/admin/convocatorias (upsert por slug).
 *
 * Uso:
 *   ADMIN_TOKEN=xxx node scripts/import-convocatorias-curadas.mjs data/convocatorias-curadas-2026-08.json [--base https://startidea.es] [--activar]
 *
 * Por defecto las fichas entran con activa=0 (invisibles) para revisión en
 * /admin/convocatorias; --activar respeta el campo `activa` del JSON.
 * El endpoint espera los campos-lista (financia_resumen, gastos_ok, gastos_no,
 * requisitos) como texto multilínea; aquí se convierten desde arrays.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'https://startidea.es';
const activar = args.includes('--activar');
const rawToken = process.env.ADMIN_TOKEN;

if (!file || !rawToken) {
  console.error('Uso: ADMIN_TOKEN=xxx node scripts/import-convocatorias-curadas.mjs <fichero.json> [--base URL] [--activar]');
  process.exit(1);
}

// El endpoint compara x-admin-token contra sha256(ADMIN_TOKEN) — ver
// isValidAdminHeader en src/lib/admin-session.ts. Se acepta el token en claro
// (se hashea aquí) o ya hasheado (64 hex).
const token = /^[0-9a-f]{64}$/i.test(rawToken)
  ? rawToken
  : createHash('sha256').update(rawToken).digest('hex');

const fichas = JSON.parse(readFileSync(file, 'utf8'));
const joinLines = (v) => (Array.isArray(v) ? v.join('\n') : (v ?? ''));

let ok = 0, ko = 0;
for (const f of fichas) {
  const body = {
    ...f,
    financia_resumen: joinLines(f.financia_resumen),
    gastos_ok: joinLines(f.gastos_ok),
    gastos_no: joinLines(f.gastos_no),
    requisitos: joinLines(f.requisitos),
    importe_min: f.importe_min != null ? String(f.importe_min) : '',
    importe_max: f.importe_max != null ? String(f.importe_max) : '',
    activa: activar ? String(f.activa ?? 1) : '0',
    destacada: String(f.destacada ?? 0),
  };
  try {
    const res = await fetch(`${base}/api/admin/convocatorias`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok && data.ok) { ok += 1; console.log(`OK   ${f.slug}`); }
    else { ko += 1; console.error(`FALLO ${f.slug}: ${res.status} ${JSON.stringify(data)}`); }
  } catch (err) {
    ko += 1; console.error(`FALLO ${f.slug}: ${err.message}`);
  }
}
console.log(`\n${ok} importadas, ${ko} fallidas. ${activar ? '' : 'Todas con activa=0 — revisar y activar en /admin/convocatorias.'}`);
process.exit(ko > 0 ? 1 : 0);
