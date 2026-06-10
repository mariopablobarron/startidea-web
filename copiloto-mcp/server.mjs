#!/usr/bin/env node
/**
 * Servidor MCP del Copiloto de Subvenciones (Startidea).
 *
 * Expone la tramitación como HERRAMIENTAS para un agente IA / cliente MCP.
 * Es un wrapper delgado sobre los endpoints admin de startidea-web (que ya
 * resuelven sede + opción de firma + llamada al container copiloto-sede).
 *
 * El MCP NO toca certificados ni sedes directamente: orquesta. La firma/
 * automatización vive en el container copiloto-sede.
 *
 * Transporte: stdio (lo lanza el cliente MCP). Auth contra startidea-web vía
 * x-admin-token = sha256(ADMIN_TOKEN).
 *
 * Env:
 *   STARTIDEA_API_URL  (default https://startidea.es)
 *   ADMIN_TOKEN        (el mismo del container startidea-web; se hashea aquí)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createHash } from 'node:crypto';

const API = (process.env.STARTIDEA_API_URL || 'https://startidea.es').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function adminHeader() {
  // El endpoint valida sha256(ADMIN_TOKEN) en el header x-admin-token.
  return createHash('sha256').update(ADMIN_TOKEN).digest('hex');
}

async function callApi(path, { method = 'POST', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-admin-token': adminHeader(),
      'origin': API,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(130000),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { httpStatus: res.status, ...data };
}

const server = new McpServer({ name: 'copiloto-subvenciones', version: '0.1.0' });

server.tool(
  'tramitar_expediente',
  'Lanza la tramitación de un expediente de subvención en su sede electrónica. Detecta la sede, elige la opción de firma (certificado de la entidad o apoderado) y orquesta el agente. Devuelve el resultado (handoff de firma o presentación + CSV).',
  {
    id: z.string().describe('ID del expediente (p.ej. A7B5F162)'),
    modo: z.enum(['asistido', 'autonomo']).optional()
      .describe("'asistido' (default): deja todo listo hasta la firma del cliente. 'autonomo': el agente firma con la opción configurada (entidad/apoderado)."),
  },
  async ({ id, modo }) => {
    if (!ADMIN_TOKEN) {
      return { isError: true, content: [{ type: 'text', text: 'Falta ADMIN_TOKEN en el entorno del MCP.' }] };
    }
    const r = await callApi('/api/admin/tramitar-sede', { body: { id, modo: modo ?? 'asistido' } });
    return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
  },
);

server.tool(
  'salud_copiloto',
  'Comprueba que el sitio startidea-web responde (chequeo de salud del Copiloto).',
  {},
  async () => {
    // Comprueba que startidea-web responde (proxy de salud).
    try {
      const res = await fetch(`${API}/subvenciones`, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      return { content: [{ type: 'text', text: `startidea-web: HTTP ${res.status} (${API})` }] };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `No responde ${API}: ${e.message}` }] };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[copiloto-mcp] servidor MCP listo (stdio) →', API);
