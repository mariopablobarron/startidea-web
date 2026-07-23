#!/usr/bin/env node
/**
 * Monitor GEO multi-cliente de Startidea.
 *
 * Para CADA cliente definido en scripts/geo-clients.json, pregunta a modelos de
 * IA CON búsqueda web (Perplexity Sonar vía OpenRouter) su batería de prompts y
 * detecta si el cliente aparece citado — en el texto (needle) o en las fuentes
 * (domains). Guarda el detalle del día y añade filas a un histórico CSV por
 * cliente para medir la evolución de la citabilidad GEO en el tiempo.
 *
 * Es la versión multi-cliente de geo-citability-test.mjs (que solo medía
 * Startidea): el diferencial de Startidea como agencia es ofrecer a cada cliente
 * un panel de "¿me citan las IA?" que casi ninguna agencia tiene.
 *
 * Uso:
 *   OPENROUTER_API_KEY=sk-or-... node scripts/geo-monitor.mjs
 *
 * Opciones:
 *   --clients startidea,otro   Solo esos clientes (por defecto: todos)
 *   --config <ruta>            Config (def. scripts/geo-clients.json)
 *   --out <dir>                Salida (def. data/geo-citability)
 *   --models a,b               Sobrescribe la lista de modelos del config
 *   --dry                      Imprime lo que consultaría, sin llamar a la API
 *
 * No imprime ni persiste la API key. Pensado para correr semanal (cron), como
 * el balance SEO. Salida por cliente en data/geo-citability/<slug>/.
 */
import { readFileSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const CONFIG_PATH = resolve(ROOT, arg('config', 'scripts/geo-clients.json'));
const OUT_DIR = resolve(ROOT, arg('out', 'data/geo-citability'));
const DRY = !!arg('dry', false);
const API_KEY = process.env.OPENROUTER_API_KEY;
const ONLY = String(arg('clients', '') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const MODELS_OVERRIDE = String(arg('models', '') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const CATS = ['monopolio', 'marca', 'generica'];

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Extrae las URLs que el modelo dice haber usado como fuentes.
function extractSources(data, content) {
  const urls = new Set();
  for (const u of data?.citations ?? []) if (typeof u === 'string') urls.add(u);
  const anns = data?.choices?.[0]?.message?.annotations ?? [];
  for (const a of anns) {
    const u = a?.url_citation?.url ?? a?.url;
    if (typeof u === 'string') urls.add(u);
  }
  for (const m of String(content).matchAll(/https?:\/\/[^\s)\]}"']+/g)) urls.add(m[0]);
  return [...urls];
}

// Pregunta a un modelo y evalúa la cita para un cliente concreto.
async function ask(model, q, needleRe, domains) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://startidea.es',
      'X-Title': 'Startidea GEO monitor',
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: q }], temperature: 0 }),
  });
  if (!res.ok) throw new Error(`${model} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  const sources = extractSources(data, content);
  const textHit = needleRe.test(content);
  const domainHit = sources.some((u) => domains.some((d) => u.toLowerCase().includes(d.toLowerCase())));
  return { content, sources, textHit, domainHit, cited: textHit || domainHit };
}

function loadClients() {
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const models = MODELS_OVERRIDE.length ? MODELS_OVERRIDE : (cfg.models ?? ['perplexity/sonar']);
  let clients = (cfg.clients ?? []).filter((c) => c.slug && Array.isArray(c.prompts));
  if (ONLY.length) clients = clients.filter((c) => ONLY.includes(c.slug));
  return { models, clients };
}

async function runClient(client, models, date) {
  const needleRe = new RegExp(client.needle, 'i');
  const domains = client.domains ?? [];
  const rows = [];
  const detail = [];

  for (const model of models) {
    for (const p of client.prompts) {
      process.stdout.write(`· ${client.slug} · ${model} · [${p.cat}] ${p.id} … `);
      try {
        const r = await ask(model, p.q, needleRe, domains);
        console.log(r.domainHit ? 'CITA+DOMINIO' : r.textHit ? 'mención' : '—');
        rows.push({ date, client: client.slug, model, id: p.id, cat: p.cat, cited: r.cited, textHit: r.textHit, domainHit: r.domainHit, nSources: r.sources.length });
        detail.push({ date, client: client.slug, model, ...p, content: r.content, sources: r.sources, textHit: r.textHit, domainHit: r.domainHit, cited: r.cited });
      } catch (e) {
        console.log(`ERROR (${e.message})`);
        rows.push({ date, client: client.slug, model, id: p.id, cat: p.cat, cited: false, textHit: false, domainHit: false, error: String(e.message) });
      }
      await new Promise((s) => setTimeout(s, 600)); // rate-limit suave
    }
  }

  // Persistencia por cliente.
  const dir = join(OUT_DIR, client.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${date}.json`), JSON.stringify(detail, null, 2));
  const csvPath = join(dir, 'history.csv');
  if (!existsSync(csvPath)) appendFileSync(csvPath, 'date,client,model,id,cat,cited,textHit,domainHit,nSources\n');
  for (const r of rows) {
    appendFileSync(csvPath, `${r.date},${r.client},${r.model},${r.id},${r.cat},${r.cited ? 1 : 0},${r.textHit ? 1 : 0},${r.domainHit ? 1 : 0},${r.nSources ?? 0}\n`);
  }
  return rows;
}

function pct(n, d) { return d ? Math.round((100 * n) / d) : 0; }

async function main() {
  const { models, clients } = loadClients();
  const date = today();

  if (!clients.length) {
    console.error(`✗ No hay clientes en ${CONFIG_PATH}` + (ONLY.length ? ` que coincidan con --clients ${ONLY.join(',')}` : ''));
    process.exit(1);
  }

  if (DRY) {
    const total = clients.reduce((a, c) => a + c.prompts.length, 0) * models.length;
    console.log(`[dry] ${clients.length} cliente(s) × ${models.length} modelo(s) = ${total} consultas`);
    for (const c of clients) {
      console.log(`  ${c.slug} (${c.name}) · needle=/${c.needle}/i · domains=${(c.domains ?? []).join(', ')}`);
      for (const m of models) for (const p of c.prompts) console.log(`    ${m}  ·  [${p.cat}] ${p.q}`);
    }
    return;
  }
  if (!API_KEY) {
    console.error('✗ Falta OPENROUTER_API_KEY en el entorno.');
    console.error('  Córrelo así:  OPENROUTER_API_KEY=sk-or-... node scripts/geo-monitor.mjs');
    process.exit(1);
  }

  const summary = [];
  for (const client of clients) {
    const rows = await runClient(client, models, date);
    const ok = rows.filter((r) => !r.error);
    const mono = ok.filter((r) => r.cat === 'monopolio');
    summary.push({
      slug: client.slug,
      name: client.name,
      citada: pct(ok.filter((r) => r.cited).length, ok.length),
      conEnlace: pct(ok.filter((r) => r.domainHit).length, ok.length),
      monopolio: pct(mono.filter((r) => r.cited).length, mono.length),
      n: ok.length,
    });
  }

  // Resumen cross-cliente.
  console.log(`\n===== Citabilidad GEO ${date} =====`);
  console.log('  cliente'.padEnd(22) + 'citada  con-enlace  monopolio  (n)');
  for (const s of summary) {
    console.log(
      `  ${s.name.padEnd(20)} ${String(s.citada + '%').padStart(5)}     ${String(s.conEnlace + '%').padStart(5)}      ${String(s.monopolio + '%').padStart(5)}   (${s.n})`,
    );
  }
  console.log(`\n  Detalle e histórico por cliente en: ${join('data/geo-citability', '<slug>')}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
