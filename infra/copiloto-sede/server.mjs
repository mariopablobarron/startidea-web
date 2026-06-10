// Servicio copiloto-sede — API de guía visual de sedes electrónicas.
//
// POST /guia-visual  (Bearer COPILOTO_SEDE_TOKEN)
//   body: { sedeKey?, sedeUrl, convTitulo?, tramiteHint? }
//   resp: { ok, sede, pasos: [{ titulo, imagen: "data:image/jpeg;base64,..." }] }
// GET  /health → { ok: true }
//
// Seguridad: navegación de páginas PÚBLICAS y screenshots. NO inicia sesión,
// NO rellena, NO firma, NO presenta, NO resuelve CAPTCHAs. No exponer público:
// detrás de la red interna de Docker/Traefik y protegido por token.

import http from 'node:http';
import { chromium } from 'playwright';
import { capturarGuia as junta } from './drivers/junta-andalucia.mjs';
import { capturarGuia as generic } from './drivers/generic.mjs';

const PORT = Number(process.env.PORT) || 8080;
const TOKEN = process.env.COPILOTO_SEDE_TOKEN || '';

const DRIVERS = {
  'junta-andalucia': junta,
};

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });

  if (req.method !== 'POST' || req.url !== '/guia-visual') {
    return send(res, 404, { ok: false, error: 'not_found' });
  }

  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    return send(res, 401, { ok: false, error: 'unauthorized' });
  }

  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 100_000) req.destroy();
  });
  req.on('end', async () => {
    let opts;
    try {
      opts = JSON.parse(body || '{}');
    } catch {
      return send(res, 400, { ok: false, error: 'bad_json' });
    }
    if (!opts.sedeUrl && !DRIVERS[opts.sedeKey]) {
      return send(res, 400, { ok: false, error: 'sedeUrl_o_sedeKey_requerido' });
    }

    const driver = DRIVERS[opts.sedeKey] || generic;
    let browser;
    try {
      browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
      const ctx = await browser.newContext({
        locale: 'es-ES',
        viewport: { width: 1280, height: 900 },
        userAgent: UA,
      });
      const page = await ctx.newPage();
      const { pasos } = await driver(page, opts);
      const out = pasos.map((p) => ({
        titulo: p.titulo,
        imagen: `data:image/jpeg;base64,${p.buffer.toString('base64')}`,
      }));
      send(res, 200, { ok: true, sede: opts.sedeKey || 'generic', pasos: out });
    } catch (err) {
      console.error('[copiloto-sede] error:', err);
      send(res, 500, { ok: false, error: String((err && err.message) || err) });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  });
});

server.listen(PORT, () => console.log(`[copiloto-sede] escuchando en :${PORT}`));
