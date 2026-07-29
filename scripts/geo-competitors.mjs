#!/usr/bin/env node
/**
 * Inteligencia competitiva GEO de Startidea.
 *
 * El monitor GEO (scripts/geo-monitor.mjs) mide SI las IA con búsqueda citan a
 * Startidea. Este script responde la pregunta siguiente: en las queries "dinero"
 * donde la IA NO te cita, ¿A QUIÉN cita en tu lugar? Es decir, quién te gana la
 * posición en las respuestas de IA — la señal más accionable para GEO.
 *
 * Reutiliza las fuentes (`sources`) que el monitor ya captura en cada respuesta:
 * extrae los dominios citados, los clasifica en TUYOS / COMPETENCIA / NEUTROS
 * (institucional, social, prensa) y agrega un ranking de competidores por número
 * de queries dinero en las que aparecen. Sale un informe legible + JSON + MD.
 *
 * Uso:
 *   # Analiza el último volcado del monitor (rápido, sin coste de API):
 *   node scripts/geo-competitors.mjs
 *   # Consulta en vivo a las IA y luego analiza (necesita la key):
 *   OPENROUTER_API_KEY=sk-or-... node scripts/geo-competitors.mjs --live
 *
 * Opciones:
 *   --client <slug>   Cliente (def. startidea)
 *   --config <ruta>   Config del monitor (def. scripts/geo-clients.json)
 *   --data <dir>      Datos del monitor (def. data/geo-citability)
 *   --date <YYYY-MM-DD>  Volcado concreto (def. el más reciente)
 *   --live            Re-consulta a las IA ahora en vez de leer el volcado
 *   --models a,b      Sobrescribe modelos (solo con --live)
 *   --out <dir>       Salida de informes (def. data/geo-citability/<slug>)
 *
 * No imprime ni persiste la API key.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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
const DATA_DIR = resolve(ROOT, arg('data', 'data/geo-citability'));
const CLIENT = String(arg('client', 'startidea'));
const DATE = arg('date', null);
const LIVE = !!arg('live', false);
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODELS_OVERRIDE = String(arg('models', '') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Categorías con intención COMPETITIVA (donde tiene sentido preguntarse "¿quién
// me gana?"). Las de marca son control positivo, no competitivas.
const MONEY_CATS = new Set(['monopolio', 'generica']);

// Dominios NEUTROS: fuentes que la IA cita pero que NO son agencias/consultoras
// rivales a las que Startidea deba "ganar". Institucional, enciclopédico, redes
// sociales y prensa generalista. (Heurística — revisable.)
const NEUTRAL = [
  // Institucional / legal
  'boe.es', 'gob.es', 'juntadeandalucia.es', 'andalucia.org', 'europa.eu',
  'la-moncloa.es', 'sepe.es', 'seg-social.es', 'agenciatributaria.es', 'hacienda.gob.es',
  'ine.es', 'mapa.gob.es', 'pap.hacienda.gob.es', 'infosubvenciones.es', 'idae.es',
  'red.es', 'acelerapyme.gob.es', 'cdti.es', 'enisa.es',
  // Enciclopédico / datos
  'wikipedia.org', 'wikidata.org', 'wikimedia.org',
  // Redes / big tech
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'youtube.com', 'tiktok.com', 'reddit.com', 'quora.com', 'google.com', 'bing.com',
  'microsoft.com', 'apple.com', 'amazon.es', 'amazon.com', 'medium.com',
  // Prensa generalista
  'elpais.com', 'elmundo.es', 'abc.es', 'lavanguardia.com', '20minutos.es',
  'eldiario.es', 'europapress.es', 'elconfidencial.com', 'larazon.es', 'publico.es',
  'infolibre.es', 'elespanol.com', 'rtve.es', 'cadenaser.com', 'cope.es',
  'huffingtonpost.es', 'elplural.com', 'ideal.es', 'granadahoy.com',
];

// Directorios/marketplaces de agencias: NO son un rival directo, pero SÍ una
// oportunidad (estar listado ahí es señal que la IA recoge). Se marcan aparte.
// Aquí van ETIQUETAS de marca (no dominios): se casan por label completo para
// no confundir "malt" con "maltcomunicacion".
const DIRECTORIES = [
  'sortlist', 'clutch', 'malt', 'cronoshare', 'paginasamarillas',
  'guiaempresas', 'empresite', 'goodfirms', 'designrush', 'topagencias',
];

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}
// Casa un dominio COMPLETO (boe.es, x.com): exacto o subdominio. Respeta límites
// de label — "consultorax.com" NO casa con "x.com".
function isDomain(host, d) {
  return host === d || host.endsWith('.' + d);
}
// Casa una MARCA por label completo: "sortlist.es"/"clutch.co" casan con "sortlist"/"clutch".
function isBrand(host, brand) {
  return host.split('.').includes(brand);
}

// ── Fuente de datos: volcado del monitor o consulta en vivo ──────────────────

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

async function askLive(model, q) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://startidea.es',
      'X-Title': 'Startidea GEO competitors',
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: q }], temperature: 0 }),
  });
  if (!res.ok) throw new Error(`${model} → HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return { content, sources: extractSources(data, content) };
}

function loadClient() {
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const client = (cfg.clients ?? []).find((c) => c.slug === CLIENT);
  if (!client) throw new Error(`Cliente "${CLIENT}" no está en ${CONFIG_PATH}`);
  const models = MODELS_OVERRIDE.length ? MODELS_OVERRIDE : (cfg.models ?? ['perplexity/sonar']);
  return { client, models };
}

function latestDump(slug) {
  const dir = join(DATA_DIR, slug);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  if (!files.length) return null;
  const file = DATE ? `${DATE}.json` : files[files.length - 1];
  const path = join(dir, file);
  if (!existsSync(path)) return null;
  return { path, date: file.replace('.json', ''), entries: JSON.parse(readFileSync(path, 'utf8')) };
}

async function liveDump(client, models) {
  const entries = [];
  const p = (n) => String(n).padStart(2, '0');
  const d = new Date();
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const needleRe = new RegExp(client.needle, 'i');
  for (const model of models) {
    for (const q of client.prompts) {
      process.stdout.write(`· live · ${model} · [${q.cat}] ${q.id} … `);
      try {
        const r = await askLive(model, q.q);
        const cited = needleRe.test(r.content) ||
          r.sources.some((u) => (client.domains ?? []).some((dm) => u.toLowerCase().includes(dm.toLowerCase())));
        console.log(cited ? 'te citan' : '—');
        entries.push({ date, model, ...q, content: r.content, sources: r.sources, cited });
      } catch (e) {
        console.log(`ERROR (${e.message})`);
      }
      await new Promise((s) => setTimeout(s, 600));
    }
  }
  return { path: '(live)', date, entries };
}

// ── Análisis competitivo ─────────────────────────────────────────────────────

function classifyHost(host, ownDomains) {
  if (ownDomains.some((d) => isDomain(host, d))) return 'own';
  if (DIRECTORIES.some((b) => isBrand(host, b))) return 'directorio';
  if (NEUTRAL.some((d) => isDomain(host, d))) return 'neutral';
  return 'competidor';
}

function analyze(client, dump) {
  const own = client.domains ?? [];
  const money = dump.entries.filter((e) => MONEY_CATS.has(e.cat));

  // Agregado por competidor (y por directorio) en queries dinero.
  const comp = new Map();   // host → { queries:Set, kind }
  const perQuery = [];      // { id, cat, q, startideaCitada, competidores:[], directorios:[], neutros:[] }

  for (const e of money) {
    const hosts = [...new Set((e.sources || []).map(hostOf).filter(Boolean))];
    const buckets = { competidor: [], directorio: [], neutral: [], own: [] };
    for (const h of hosts) buckets[classifyHost(h, own)].push(h);
    const startideaCitada = e.cited || buckets.own.length > 0;

    for (const kind of ['competidor', 'directorio']) {
      for (const h of buckets[kind]) {
        if (!comp.has(h)) comp.set(h, { host: h, kind, queries: new Set() });
        comp.get(h).queries.add(e.id);
      }
    }
    perQuery.push({
      id: e.id, cat: e.cat, q: e.q, startideaCitada,
      competidores: buckets.competidor, directorios: buckets.directorio, neutros: buckets.neutral,
    });
  }

  const ranking = [...comp.values()]
    .map((c) => ({ host: c.host, kind: c.kind, nQueries: c.queries.size, queries: [...c.queries] }))
    .sort((a, b) => b.nQueries - a.nQueries || a.host.localeCompare(b.host));

  const citadaEn = perQuery.filter((p) => p.startideaCitada).length;

  return { money, perQuery, ranking, citadaEn, nMoney: money.length };
}

// ── Salida ───────────────────────────────────────────────────────────────────

function toMarkdown(client, dump, a) {
  const L = [];
  L.push(`# Inteligencia GEO — quién gana a ${client.name} en las IA`);
  L.push('');
  L.push(`Fuente: ${dump.path === '(live)' ? 'consulta en vivo' : dump.path} · fecha ${dump.date}`);
  L.push('');
  L.push(`**${client.name} citada en ${a.citadaEn}/${a.nMoney} queries dinero.**`);
  L.push('');
  L.push('## Quién te gana la cita (ranking por nº de queries dinero)');
  L.push('');
  L.push('| Dominio | Tipo | Queries |');
  L.push('|---|---|---|');
  const comps = a.ranking.filter((r) => r.kind === 'competidor');
  const dirs = a.ranking.filter((r) => r.kind === 'directorio');
  for (const r of comps.slice(0, 20)) L.push(`| ${r.host} | competidor | ${r.nQueries} |`);
  if (!comps.length) L.push('| (ninguno detectado) | | |');
  if (dirs.length) {
    L.push('');
    L.push('## Directorios donde deberías estar listado');
    L.push('');
    L.push('| Directorio | Queries |');
    L.push('|---|---|');
    for (const r of dirs.slice(0, 15)) L.push(`| ${r.host} | ${r.nQueries} |`);
  }
  L.push('');
  L.push('## Detalle por query dinero');
  L.push('');
  for (const p of a.perQuery) {
    L.push(`### ${p.startideaCitada ? '✅' : '❌'} [${p.cat}] ${p.q}`);
    L.push(`- **${client.name}:** ${p.startideaCitada ? 'citada' : 'NO citada'}`);
    L.push(`- Competidores citados: ${p.competidores.length ? p.competidores.join(', ') : '—'}`);
    if (p.directorios.length) L.push(`- Directorios: ${p.directorios.join(', ')}`);
    L.push('');
  }
  L.push('---');
  L.push('_Clasificación heurística (institucional/prensa/social = neutro). Revisa los "competidores" antes de actuar: alguno puede ser un medio o portal, no una agencia rival._');
  return L.join('\n');
}

function printConsole(client, dump, a) {
  console.log(`\n===== GEO competitivo · ${client.name} · ${dump.date} =====`);
  console.log(`${client.name} citada en ${a.citadaEn}/${a.nMoney} queries dinero.\n`);
  const comps = a.ranking.filter((r) => r.kind === 'competidor').slice(0, 12);
  console.log('QUIÉN TE GANA (competidores por nº de queries dinero):');
  if (!comps.length) console.log('  (ninguno detectado)');
  for (const r of comps) console.log(`  ${String(r.nQueries).padStart(2)}×  ${r.host}`);
  const dirs = a.ranking.filter((r) => r.kind === 'directorio').slice(0, 8);
  if (dirs.length) {
    console.log('\nDIRECTORIOS donde deberías aparecer:');
    for (const r of dirs) console.log(`  ${String(r.nQueries).padStart(2)}×  ${r.host}`);
  }
  console.log('\nPOR QUERY:');
  for (const p of a.perQuery) {
    console.log(`  ${p.startideaCitada ? '✅' : '❌'} [${p.cat}] ${p.q}`);
    if (p.competidores.length) console.log(`       ↳ ${p.competidores.join(', ')}`);
  }
}

async function main() {
  const { client, models } = loadClient();

  let dump;
  if (LIVE) {
    if (!API_KEY) { console.error('✗ Falta OPENROUTER_API_KEY para --live.'); process.exit(1); }
    dump = await liveDump(client, models);
  } else {
    dump = latestDump(client.slug);
    if (!dump) {
      console.error(`✗ No hay volcado del monitor en ${join(DATA_DIR, client.slug)}.`);
      console.error('  Corre primero el monitor (geo-monitor.mjs) o usa --live.');
      process.exit(1);
    }
  }

  const a = analyze(client, dump);
  printConsole(client, dump, a);

  const outDir = resolve(ROOT, arg('out', join('data/geo-citability', client.slug)));
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, `competidores-${dump.date}.json`);
  const mdPath = join(outDir, `competidores-${dump.date}.md`);
  writeFileSync(jsonPath, JSON.stringify({ client: client.slug, date: dump.date, ...a, ranking: a.ranking, perQuery: a.perQuery }, null, 2));
  writeFileSync(mdPath, toMarkdown(client, dump, a));
  console.log(`\n  Informe: ${mdPath}`);
  console.log(`  Datos:   ${jsonPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
