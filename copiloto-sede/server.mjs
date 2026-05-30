/**
 * Copiloto Fase 2 — servidor de tramitación asistida en sede electrónica.
 *
 * Vive en un container SEPARADO con Playwright. El startidea-web principal le
 * pasa un expediente "docs_listos" y este servicio:
 *   1. Detecta la sede (ya viene resuelta desde sedes-map.ts del main).
 *   2. Lanza el driver de esa sede: navega, rellena el formulario y sube los
 *      adjuntos HASTA la pantalla de firma.
 *   3. Devuelve una "sesión de firma" (handoff) para que el CLIENTE firme con
 *      su certificado/Cl@ve. NUNCA firmamos por él (modelo asistido, legal).
 *   4. (Opcional, V3) Si hay apoderamiento, Startidea firma como representante.
 *
 * Auth: header `x-copiloto-secret` = COPILOTO_SEDE_SECRET (compartido con el main).
 * Solo accesible en red interna Docker — NO exponer a internet sin más.
 */
import http from 'node:http';
import { runDriver, listSedes } from './drivers/index.mjs';

const PORT = Number(process.env.PORT || 8090);
const SECRET = process.env.COPILOTO_SEDE_SECRET || '';

function json(res, status, body) {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(s) });
  res.end(s);
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Healthcheck (sin auth)
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'copiloto-sede', sedes: listSedes() });
    }

    // Auth para el resto
    if (!SECRET || req.headers['x-copiloto-secret'] !== SECRET) {
      return json(res, 401, { ok: false, error: 'unauthorized' });
    }

    // POST /tramitar  { expedienteId, sede, formData, files: [{name,url}], mode }
    if (req.method === 'POST' && url.pathname === '/tramitar') {
      const body = await readJson(req);
      if (!body.expedienteId || !body.sede) {
        return json(res, 400, { ok: false, error: 'expedienteId y sede requeridos' });
      }
      // mode: 'asistido' (default, para en la firma) | 'apoderado' (V3, firma Startidea)
      const result = await runDriver({
        sede: body.sede,
        expedienteId: body.expedienteId,
        formData: body.formData || {},
        files: body.files || [],
        mode: body.mode || 'asistido',
      });
      return json(res, result.ok ? 200 : 502, result);
    }

    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (err) {
    console.error('[copiloto-sede] error:', err);
    return json(res, 500, { ok: false, error: String(err?.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`[copiloto-sede] escuchando en :${PORT} · sedes: ${listSedes().join(', ')}`);
});
