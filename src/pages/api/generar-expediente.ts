/**
 * POST /api/generar-expediente
 *
 * Agente IA que genera la documentación de una solicitud de subvención.
 * Solo accesible por Mario (ADMIN_TOKEN header).
 *
 * Body JSON: { id: string }
 *
 * Flujo:
 *  1. Lee el expediente de SQLite
 *  2. Obtiene los datos de la convocatoria del HUB (bases, descripción)
 *  3. Llama a OpenRouter (Claude Haiku) con el contexto completo
 *  4. Parsea los 4 documentos generados
 *  5. Guarda en SQLite (ai_memoria, ai_presupuesto, ai_checklist, ai_guia)
 *  6. Actualiza status → docs_listos
 *  7. Notifica a Mario por Telegram
 */

import type { APIRoute } from 'astro';
import { getExpediente, saveAiOutput, updateStatus } from '@/lib/expedientes-db';
import { isValidAdminHeader } from '@/lib/admin-session';
import { buildConvContext, runAiGeneration } from '@/lib/copiloto-engine';

export const prerender = false;

function getEnv(key: string): string {
  return process.env[key] ?? (import.meta as any).env?.[key] ?? '';
}

export const POST: APIRoute = async ({ request }) => {
  // Auth: el panel envía sha256(ADMIN_TOKEN) como cookie → header x-admin-token
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
  }

  const exp = getExpediente(id);
  if (!exp) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
  }

  // Marcar como "analizando"
  updateStatus(id, 'analizando_ia');

  // Construir contexto de convocatoria + ejecutar generación IA
  const { context: convContext } = await buildConvContext({
    convocatoria_slug: exp.convocatoria_slug,
    convocatoria_title: exp.convocatoria_title,
    convocatoria_url: exp.convocatoria_url,
  });

  const gen = await runAiGeneration(exp, convContext);

  if (!gen.ok) {
    updateStatus(id, 'recibido');
    return new Response(
      JSON.stringify({ ok: false, error: gen.error ?? 'generation_failed' }),
      { status: 502 },
    );
  }

  const { memoria, presupuesto, checklist, guia, elegibilidad, datosFaltantes } = gen;

  // Guardar en BD (incluye análisis de elegibilidad)
  saveAiOutput(id, {
    memoria, presupuesto, checklist, guia,
    elegibilidad: elegibilidad?.raw,
    datosFaltantes,
  });

  // Notificar a Mario por Telegram
  const tgToken = getEnv('TELEGRAM_BOT_TOKEN');
  const tgChat = getEnv('TELEGRAM_CHAT_ID');
  if (tgToken && tgChat) {
    const elegIcon = elegibilidad?.bloqueante ? '🔴 BLOQUEANTE' : elegibilidad ? `🟢 ${elegibilidad.score}/100` : '❓';
    const tgText = `✅ <b>Documentos generados</b>\n\n` +
      `<b>Expediente:</b> <code>${id}</code>\n` +
      `<b>Entidad:</b> ${exp.org_nombre}\n` +
      `<b>Convocatoria:</b> ${exp.convocatoria_title || 'Sin identificar'}\n` +
      `<b>Elegibilidad:</b> ${elegIcon}\n\n` +
      `Memoria: ${memoria ? '✅' : '❌'} | Presupuesto: ${presupuesto ? '✅' : '❌'} | Checklist: ${checklist ? '✅' : '❌'} | Guía: ${guia ? '✅' : '❌'}\n\n` +
      `Panel: https://startidea.es/admin/expedientes/${id}`;
    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text: tgText, parse_mode: 'HTML' }),
    }).catch(console.error);
  }

  return new Response(JSON.stringify({
    ok: true,
    id,
    sections: {
      memoria: memoria.length,
      presupuesto: presupuesto.length,
      checklist: checklist.length,
      guia: guia.length,
    },
  }), { status: 200 });
};
