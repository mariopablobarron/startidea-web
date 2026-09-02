#!/usr/bin/env node
/**
 * IndexNow — notifica a los buscadores compatibles (Bing, Seznam, Naver, Yandex)
 * las URLs del sitemap de startidea.es. Relevante para GEO: ChatGPT busca sobre
 * el índice de Bing, y Bing consume IndexNow — cuanto antes indexe una URL nueva
 * o actualizada, antes puede aparecer en sus respuestas.
 *
 * La clave vive en public/<key>.txt (requisito del protocolo: el buscador
 * verifica la propiedad del dominio pidiendo esa URL). No es un secreto.
 *
 * Uso:
 *   node scripts/indexnow-ping.mjs                  # todas las URLs del sitemap
 *   node scripts/indexnow-ping.mjs --urls a,b,c     # solo esas URLs
 *   node scripts/indexnow-ping.mjs --dry            # muestra sin enviar
 *
 * Pensado para correr semanal por cron (tras el monitor GEO) y a mano tras
 * publicar contenido nuevo. IndexNow deduplica en su lado: repetir no penaliza.
 */
const HOST = 'startidea.es';
const KEY = 'd5b9f04f45f9c80335eaf44db84d0c8a';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

async function sitemapUrls() {
  const urls = new Set();
  // sitemap estático (índice → hijos) + el de catálogo SSR
  const roots = [`https://${HOST}/sitemap-index.xml`, `https://${HOST}/sitemap-catalogo.xml`];
  const children = [];
  for (const r of roots) {
    const xml = await (await fetch(r)).text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = m[1].trim();
      if (u.endsWith('.xml')) children.push(u);
      else urls.add(u);
    }
  }
  for (const c of children) {
    const xml = await (await fetch(c)).text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (!m[1].endsWith('.xml')) urls.add(m[1].trim());
    }
  }
  return [...urls];
}

async function main() {
  const only = arg('urls');
  const urlList = typeof only === 'string'
    ? only.split(',').map((s) => s.trim()).filter(Boolean)
    : await sitemapUrls();

  if (!urlList.length) { console.error('✗ Sin URLs que enviar.'); process.exit(1); }
  console.log(`IndexNow → ${urlList.length} URL(s) de ${HOST}`);
  if (arg('dry')) { urlList.slice(0, 10).forEach((u) => console.log('  ' + u)); return; }

  // El protocolo admite hasta 10.000 URLs por POST.
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
  });
  // 200 = procesado; 202 = aceptado (clave pendiente de verificar). Ambos OK.
  console.log(`HTTP ${res.status} ${res.status === 200 || res.status === 202 ? '✓' : '✗ ' + (await res.text()).slice(0, 200)}`);
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
