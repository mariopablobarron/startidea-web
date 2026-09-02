#!/usr/bin/env node
/**
 * Test de citabilidad GEO de Startidea.
 *
 * Pregunta a modelos de IA CON búsqueda web (Perplexity Sonar vía OpenRouter)
 * la batería de geo-citability-prompts.json y detecta si Startidea aparece en
 * la respuesta o en las fuentes citadas. Guarda el detalle del día y añade
 * filas a un histórico CSV para medir la evolución en el tiempo.
 *
 * Uso:
 *   OPENROUTER_API_KEY=sk-or-... node scripts/geo-citability-test.mjs
 *
 * Opcional:
 *   --prompts <ruta>   (por defecto scripts/geo-citability-prompts.json)
 *   --out <dir>        (por defecto data/geo-citability)
 *   --dry              (imprime lo que consultaría sin llamar a la API)
 *
 * No imprime ni persiste la API key. Pensado para correr semanal (p. ej. el
 * viernes, junto al balance SEO/GEO).
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

const PROMPTS_PATH = resolve(ROOT, arg('prompts', 'scripts/geo-citability-prompts.json'));
const OUT_DIR = resolve(ROOT, arg('out', 'data/geo-citability'));
const DRY = !!arg('dry', false);
const API_KEY = process.env.OPENROUTER_API_KEY;

const NEEDLE = /startidea/i;         // mención en el texto
const DOMAIN = 'startidea.es';       // mención en las fuentes

function today() {
  // Fecha local YYYY-MM-DD sin dependencias.
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function extractSources(data, content) {
  const urls = new Set();
  // 1) Campo citations a nivel de respuesta (Perplexity vía OpenRouter).
  for (const u of data?.citations ?? []) if (typeof u === 'string') urls.add(u);
  // 2) Anotaciones url_citation en el mensaje.
  const anns = data?.choices?.[0]?.message?.annotations ?? [];
  for (const a of anns) {
    const u = a?.url_citation?.url ?? a?.url;
    if (typeof u === 'string') urls.add(u);
  }
  // 3) Fallback: URLs sueltas en el propio texto.
  for (const m of String(content).matchAll(/https?:\/\/[^\s)\]}"']+/g)) urls.add(m[0]);
  return [...urls];
}

async function ask(model, q) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://startidea.es',
      'X-Title': 'Startidea GEO citability test',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: q }],
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`${model} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  const sources = extractSources(data, content);
  const textHit = NEEDLE.test(content);
  const domainHit = sources.some((u) => u.toLowerCase().includes(DOMAIN));
  return { content, sources, textHit, domainHit, cited: textHit || domainHit };
}

async function main() {
  const cfg = JSON.parse(readFileSync(PROMPTS_PATH, 'utf8'));
  const prompts = cfg.prompts ?? [];
  const models = cfg.models ?? ['perplexity/sonar'];
  const date = today();

  if (DRY) {
    console.log(`[dry] ${prompts.length} prompts × ${models.length} modelos = ${prompts.length * models.length} consultas`);
    for (const m of models) for (const p of prompts) console.log(`  ${m}  ·  [${p.cat}] ${p.q}`);
    return;
  }
  if (!API_KEY) {
    console.error('✗ Falta OPENROUTER_API_KEY en el entorno.');
    console.error('  Córrelo así:  OPENROUTER_API_KEY=sk-or-... node scripts/geo-citability-test.mjs');
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const rows = [];
  const detail = [];

  for (const model of models) {
    for (const p of prompts) {
      process.stdout.write(`· ${model} · [${p.cat}] ${p.id} … `);
      try {
        const r = await ask(model, p.q);
        const mark = r.domainHit ? 'CITA+DOMINIO' : r.textHit ? 'mención' : '—';
        console.log(mark);
        rows.push({ date, model, id: p.id, cat: p.cat, cited: r.cited, textHit: r.textHit, domainHit: r.domainHit, nSources: r.sources.length });
        detail.push({ date, model, ...p, ...r });
      } catch (e) {
        console.log(`ERROR (${e.message})`);
        rows.push({ date, model, id: p.id, cat: p.cat, cited: false, textHit: false, domainHit: false, error: String(e.message) });
      }
      await new Promise((s) => setTimeout(s, 600)); // rate-limit suave
    }
  }

  // Persistencia: detalle del día + histórico CSV acumulativo.
  writeFileSync(join(OUT_DIR, `${date}.json`), JSON.stringify(detail, null, 2));
  const csvPath = join(OUT_DIR, 'history.csv');
  if (!existsSync(csvPath)) appendFileSync(csvPath, 'date,model,id,cat,cited,textHit,domainHit,nSources\n');
  for (const r of rows) {
    appendFileSync(csvPath, `${r.date},${r.model},${r.id},${r.cat},${r.cited ? 1 : 0},${r.textHit ? 1 : 0},${r.domainHit ? 1 : 0},${r.nSources ?? 0}\n`);
  }

  // Resumen legible por categoría.
  console.log(`\n===== Resumen ${date} =====`);
  for (const cat of ['monopolio', 'marca', 'generica']) {
    const sub = rows.filter((r) => r.cat === cat && !r.error);
    if (!sub.length) continue;
    const cited = sub.filter((r) => r.cited).length;
    const dom = sub.filter((r) => r.domainHit).length;
    console.log(`  ${cat.padEnd(10)}  citada ${cited}/${sub.length}  ·  con enlace a startidea.es ${dom}/${sub.length}`);
  }
  console.log(`\n  Detalle:  ${join('data/geo-citability', `${date}.json`)}`);
  console.log(`  Histórico: data/geo-citability/history.csv`);
}

main().catch((e) => { console.error(e); process.exit(1); });
