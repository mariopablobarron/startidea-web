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
import { fetchSubsidyDetail } from '@/lib/subsidies-api';
import { isValidAdminHeader } from '@/lib/admin-session';
import { detectSede, sedeContextoPrompt } from '@/lib/sedes-map';

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

  // Obtener datos de la convocatoria
  let convContext = '';
  if (exp.convocatoria_slug) {
    try {
      const conv = await fetchSubsidyDetail(exp.convocatoria_slug);
      if (conv) {
        convContext = [
          `CONVOCATORIA: ${conv.title}`,
          conv.organization ? `ORGANISMO: ${conv.organization}` : '',
          conv.deadline ? `PLAZO: ${conv.deadline}` : '',
          conv.amount_eur ? `DOTACIÓN MÁXIMA: ${conv.amount_eur.toLocaleString('es-ES')} €` : '',
          conv.description ? `\nDESCRIPCIÓN BASES:\n${conv.description}` : '',
          conv.bases_text ? `\nCONTENIDO BASES:\n${conv.bases_text.slice(0, 3000)}` : '',
          conv.startidea_summary ? `\nRESUMEN EDITORIAL:\n${conv.startidea_summary}` : '',
        ].filter(Boolean).join('\n');
      }
    } catch (err) {
      console.warn('[generar-expediente] No se pudieron obtener datos de convocatoria:', err);
    }
  }

  if (!convContext && exp.convocatoria_title) {
    convContext = `CONVOCATORIA: ${exp.convocatoria_title}`;
    if (exp.convocatoria_url) convContext += `\nURL: ${exp.convocatoria_url}`;
  }

  if (!convContext) {
    convContext = 'CONVOCATORIA: Sin especificar (el solicitante no ha identificado la convocatoria exacta)';
  }

  // Detectar sede electrónica para mejorar la guía de presentación
  let convOrganismo: string | null = null;
  try {
    if (exp.convocatoria_slug) {
      const conv = await fetchSubsidyDetail(exp.convocatoria_slug);
      convOrganismo = conv?.organization ?? null;
    }
  } catch { /* no bloqueante */ }

  const sedeDetectada = detectSede({
    convocatoriaUrl: exp.convocatoria_url,
    organismo: convOrganismo,
    convocatoriaTitle: exp.convocatoria_title,
  });

  if (sedeDetectada) {
    convContext += sedeContextoPrompt(sedeDetectada);
  }

  // Construir el prompt
  const sistemaPrompt = `Eres un experto redactor de solicitudes de subvenciones públicas en España, con 15 años de experiencia en tercer sector, PYME, innovación social y propiedad industrial. Tu especialidad es adaptar proyectos reales a las exigencias formales de cada convocatoria.

Normas de redacción:
- Usa lenguaje formal, claro y directo, sin jerga vacía
- Adapta el tono y vocabulario al tipo de convocatoria y entidad solicitante
- No inventes datos que no estén en el expediente
- Si falta información clave, márcala con [COMPLETAR: qué se necesita aquí]
- Formatea cada sección en Markdown limpio y bien estructurado
- Usa cifras y hechos concretos siempre que sea posible`;

  const userPrompt = `${convContext}

---

DATOS DEL SOLICITANTE:
- Entidad: ${exp.org_nombre} (CIF: ${exp.org_cif})
- Tipo de organización: ${exp.org_tipo}
- Representante: ${exp.representante}
- Provincia: ${exp.provincia}
- Experiencia previa con subvenciones: ${exp.experiencia || 'No indicada'}
- Importe solicitado: ${exp.importe_solicitado || 'Por determinar'}

DESCRIPCIÓN DEL PROYECTO:
${exp.descripcion_proyecto}

${exp.comentarios ? `OBSERVACIONES ADICIONALES DEL SOLICITANTE:\n${exp.comentarios}` : ''}

---

Genera los siguientes 4 documentos separados por los marcadores exactos indicados:

===MEMORIA_TECNICA===
Redacta una memoria técnica completa (600-900 palabras) estructurada así:
1. **Presentación de la entidad solicitante** — quién es, trayectoria, legitimidad
2. **Descripción del proyecto** — en qué consiste, qué problema resuelve
3. **Objetivos específicos y medibles**
4. **Beneficiarios directos e indirectos**
5. **Metodología y plan de trabajo**
6. **Cronograma estimado** (fases o hitos)
7. **Impacto esperado y sostenibilidad**
Adapta el lenguaje y énfasis a los requisitos de la convocatoria indicada.

===PRESUPUESTO===
Redacta un presupuesto estructurado por partidas adaptado a la convocatoria:
- Usa las categorías de gasto que suele exigir este tipo de convocatoria
- Incluye conceptos realistas para el tipo de proyecto descrito
- Muestra subtotales por partida y total general
- Marca con [COMPLETAR: cantidad estimada] donde no haya datos suficientes
- Añade una nota sobre el porcentaje de cofinanciación si aplica

===CHECKLIST===
Lista exhaustiva de documentos que esta convocatoria suele requerir:
Para cada documento indica:
- ✅ [APORTADO] si el solicitante ya lo ha enviado (basado en sus adjuntos)
- 📋 [PENDIENTE] si hay que obtenerlo/prepararlo
- ❓ [VERIFICAR] si no está claro si hace falta en esta convocatoria concreta
Incluye: documentos de la entidad (CIF, estatutos, acta nombramiento representante), certificados de estar al corriente (AEAT, SS), documentos del proyecto (memoria, presupuesto, CV equipo), documentos específicos de la convocatoria.

===GUIA_PRESENTACION===
Guía paso a paso para que el solicitante presente la solicitud sin ayuda:
1. Dónde acceder (URL exacta de la sede electrónica si la conoces)
2. Qué certificado digital necesita y cómo instalarlo
3. Cómo localizar el trámite en la sede
4. Orden de cumplimentación del formulario
5. Cómo adjuntar los documentos
6. Cómo usar Autofirma para firmar y presentar
7. Qué hacer después de presentar (justificante, plazos de resolución)
Sé muy concreto y usa lenguaje que entienda alguien sin experiencia técnica.`;

  // Llamar a OpenRouter
  const openrouterKey = getEnv('OPENROUTER_API_KEY');
  if (!openrouterKey) {
    updateStatus(id, 'recibido');
    return new Response(JSON.stringify({ ok: false, error: 'no_openrouter_key' }), { status: 500 });
  }

  let rawOutput = '';
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://startidea.es',
        'X-Title': 'Startidea Copiloto',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: sistemaPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[generar-expediente] OpenRouter error:', res.status, errText);
      updateStatus(id, 'recibido');
      return new Response(JSON.stringify({ ok: false, error: 'openrouter_error', detail: errText }), { status: 502 });
    }

    const json = await res.json();
    rawOutput = json.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    console.error('[generar-expediente] Fetch error:', err);
    updateStatus(id, 'recibido');
    return new Response(JSON.stringify({ ok: false, error: 'network_error' }), { status: 502 });
  }

  // Parsear los 4 bloques
  function extractBlock(raw: string, marker: string): string {
    const start = raw.indexOf(`===${marker}===`);
    if (start === -1) return '';
    const afterMarker = raw.indexOf('\n', start) + 1;
    const markers = ['===MEMORIA_TECNICA===', '===PRESUPUESTO===', '===CHECKLIST===', '===GUIA_PRESENTACION==='];
    let end = raw.length;
    for (const m of markers) {
      const pos = raw.indexOf(m, afterMarker);
      if (pos !== -1 && pos < end) end = pos;
    }
    return raw.slice(afterMarker, end).trim();
  }

  const memoria = extractBlock(rawOutput, 'MEMORIA_TECNICA') || rawOutput; // fallback: todo el output
  const presupuesto = extractBlock(rawOutput, 'PRESUPUESTO');
  const checklist = extractBlock(rawOutput, 'CHECKLIST');
  const guia = extractBlock(rawOutput, 'GUIA_PRESENTACION');

  // Guardar en BD
  saveAiOutput(id, { memoria, presupuesto, checklist, guia });

  // Notificar a Mario por Telegram
  const tgToken = getEnv('TELEGRAM_BOT_TOKEN');
  const tgChat = getEnv('TELEGRAM_CHAT_ID');
  if (tgToken && tgChat) {
    const tgText = `✅ <b>Documentos generados</b>\n\n` +
      `<b>Expediente:</b> <code>${id}</code>\n` +
      `<b>Entidad:</b> ${exp.org_nombre}\n` +
      `<b>Convocatoria:</b> ${exp.convocatoria_title || 'Sin identificar'}\n\n` +
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
