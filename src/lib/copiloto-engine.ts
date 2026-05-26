/**
 * copiloto-engine.ts
 *
 * Lógica compartida de generación de documentos del Copiloto de Subvenciones.
 * Usada por:
 *   - /api/generar-expediente    (generación manual desde panel admin)
 *   - /api/auto-copiloto/trigger (generación automática en cron diario)
 */

import type { Expediente } from './expedientes-db';
import { fetchSubsidyDetail } from './subsidies-api';
import { detectSede, sedeContextoPrompt } from './sedes-map';

function getEnv(key: string): string {
  return process.env[key] ?? (import.meta as any).env?.[key] ?? '';
}

// ─── Contexto de la convocatoria ─────────────────────────────────────────────

/**
 * Construye el bloque de texto de contexto de una convocatoria
 * a partir de los datos del HUB + detección de sede electrónica.
 */
export async function buildConvContext(opts: {
  convocatoria_slug?: string | null;
  convocatoria_title?: string | null;
  convocatoria_url?: string | null;
}): Promise<{ context: string; organismo: string | null }> {
  let context = '';
  let organismo: string | null = null;

  if (opts.convocatoria_slug) {
    try {
      const conv = await fetchSubsidyDetail(opts.convocatoria_slug);
      if (conv) {
        organismo = conv.organization ?? null;
        context = [
          `CONVOCATORIA: ${conv.title}`,
          conv.organization ? `ORGANISMO: ${conv.organization}` : '',
          conv.deadline ? `PLAZO: ${conv.deadline}` : '',
          conv.amount_eur
            ? `DOTACIÓN MÁXIMA: ${conv.amount_eur.toLocaleString('es-ES')} €`
            : '',
          conv.description ? `\nDESCRIPCIÓN BASES:\n${conv.description}` : '',
          conv.bases_text
            ? `\nCONTENIDO BASES:\n${conv.bases_text.slice(0, 3000)}`
            : '',
          conv.startidea_summary
            ? `\nRESUMEN EDITORIAL:\n${conv.startidea_summary}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      }
    } catch (err) {
      console.warn('[copiloto-engine] No se pudieron obtener datos de convocatoria:', err);
    }
  }

  if (!context && opts.convocatoria_title) {
    context = `CONVOCATORIA: ${opts.convocatoria_title}`;
    if (opts.convocatoria_url) context += `\nURL: ${opts.convocatoria_url}`;
  }

  if (!context) {
    context = 'CONVOCATORIA: Sin especificar';
  }

  // Sede electrónica
  const sedeDetectada = detectSede({
    convocatoriaUrl: opts.convocatoria_url,
    organismo,
    convocatoriaTitle: opts.convocatoria_title,
  });
  if (sedeDetectada) {
    context += sedeContextoPrompt(sedeDetectada);
  }

  return { context, organismo };
}

// ─── Generación IA ───────────────────────────────────────────────────────────

export interface GenerationResult {
  ok: boolean;
  memoria: string;
  presupuesto: string;
  checklist: string;
  guia: string;
  error?: string;
}

/**
 * Llama a OpenRouter (Claude Haiku) con el contexto de convocatoria + datos del
 * expediente y devuelve los 4 bloques de documentos parseados.
 */
export async function runAiGeneration(
  exp: Pick<
    Expediente,
    | 'org_nombre'
    | 'org_cif'
    | 'org_tipo'
    | 'representante'
    | 'provincia'
    | 'experiencia'
    | 'importe_solicitado'
    | 'descripcion_proyecto'
    | 'comentarios'
  >,
  convContext: string,
): Promise<GenerationResult> {
  const openrouterKey = getEnv('OPENROUTER_API_KEY');
  if (!openrouterKey) {
    return { ok: false, memoria: '', presupuesto: '', checklist: '', guia: '', error: 'no_openrouter_key' };
  }

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
- Entidad: ${exp.org_nombre} (CIF: ${exp.org_cif || 'por comunicar'})
- Tipo de organización: ${exp.org_tipo}
- Representante: ${exp.representante}
- Provincia: ${exp.provincia || 'por comunicar'}
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
      console.error('[copiloto-engine] OpenRouter error:', res.status, errText);
      return { ok: false, memoria: '', presupuesto: '', checklist: '', guia: '', error: `openrouter_${res.status}` };
    }

    const json = await res.json();
    rawOutput = json.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    console.error('[copiloto-engine] Fetch error:', err);
    return { ok: false, memoria: '', presupuesto: '', checklist: '', guia: '', error: 'network_error' };
  }

  // Parsear los 4 bloques
  function extractBlock(raw: string, marker: string): string {
    const start = raw.indexOf(`===${marker}===`);
    if (start === -1) return '';
    const afterMarker = raw.indexOf('\n', start) + 1;
    const markers = [
      '===MEMORIA_TECNICA===',
      '===PRESUPUESTO===',
      '===CHECKLIST===',
      '===GUIA_PRESENTACION===',
    ];
    let end = raw.length;
    for (const m of markers) {
      const pos = raw.indexOf(m, afterMarker);
      if (pos !== -1 && pos < end) end = pos;
    }
    return raw.slice(afterMarker, end).trim();
  }

  const memoria = extractBlock(rawOutput, 'MEMORIA_TECNICA') || rawOutput;
  const presupuesto = extractBlock(rawOutput, 'PRESUPUESTO');
  const checklist = extractBlock(rawOutput, 'CHECKLIST');
  const guia = extractBlock(rawOutput, 'GUIA_PRESENTACION');

  return { ok: true, memoria, presupuesto, checklist, guia };
}
