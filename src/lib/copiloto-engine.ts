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

// ─── Extracción de baremo/criterios de valoración ─────────────────────────────

/**
 * Intenta extraer el baremo de puntuación de las bases.
 * Busca secciones con "criterios de valoración", "puntos", "puntuación máxima", etc.
 * Si las encuentra, devuelve un bloque formateado para incluir en el prompt.
 */
function extractBaremo(basesText: string): string {
  const lines = basesText.split('\n');
  const baremoLines: string[] = [];
  let inBaremo = false;

  const baremoHeaders = [
    'criterios de valoraci', 'criterios de selecci', 'baremo',
    'puntuaci', 'valoraci', 'criterios de concesi',
  ];
  const stopHeaders = [
    'documentaci', 'presentaci', 'plazo', 'justificaci',
    'obligaci', 'reintegro',
  ];

  for (const line of lines) {
    const lower = line.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!inBaremo && baremoHeaders.some((h) => lower.includes(h))) {
      inBaremo = true;
    }
    if (inBaremo) {
      if (stopHeaders.some((h) => lower.includes(h)) && baremoLines.length > 3) {
        break;
      }
      baremoLines.push(line);
      if (baremoLines.length >= 40) break; // max 40 líneas de baremo
    }
  }

  if (baremoLines.length < 2) return '';
  return `\nCRITERIOS DE VALORACIÓN (BAREMO):\n${baremoLines.join('\n')}`;
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
            ? `\nCONTENIDO BASES:\n${conv.bases_text.slice(0, 6000)}`
            : '',
          conv.bases_text
            ? extractBaremo(conv.bases_text)
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

// ─── Elegibilidad ────────────────────────────────────────────────────────────

export interface EligibilityCheck {
  emoji: '✅' | '❌' | '⚠️' | '❓';
  texto: string; // nombre del requisito y evaluación en una línea
}

export interface EligibilityResult {
  score: number;           // 0-100
  bloqueante: boolean;     // hay al menos un ❌ con peso decisivo
  checks: EligibilityCheck[];
  resumen: string;
  raw: string;             // bloque completo para guardar en BD
}

/**
 * Parsea el bloque ===ELEGIBILIDAD=== generado por el modelo.
 * Formato esperado:
 *   SCORE: 75
 *   BLOQUEANTE: NO
 *   REQ: ✅ Tipo de entidad — La conv admite fundaciones. El perfil es fundación.
 *   REQ: ❌ Empleados mínimos — La conv exige 5. No hay datos en el perfil.
 *   RESUMEN: ...
 */
export function parseEligibility(block: string): EligibilityResult {
  const scoreMatch = block.match(/^SCORE:\s*(\d+)/im);
  const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : 50;
  const bloqueante = /^BLOQUEANTE:\s*SI/im.test(block);

  const checks: EligibilityCheck[] = [];
  for (const m of block.matchAll(/^REQ:\s*(.+)$/gm)) {
    const line = m[1].trim();
    let emoji: EligibilityCheck['emoji'] = '❓';
    if (line.startsWith('✅')) emoji = '✅';
    else if (line.startsWith('❌')) emoji = '❌';
    else if (line.startsWith('⚠️')) emoji = '⚠️';
    checks.push({ emoji, texto: line });
  }

  const resumenMatch = block.match(/^RESUMEN:\s*(.+)$/im);
  const resumen = resumenMatch ? resumenMatch[1].trim() : '';

  return { score, bloqueante, checks, resumen, raw: block };
}

// ─── Generación IA ───────────────────────────────────────────────────────────

export interface GenerationResult {
  ok: boolean;
  memoria: string;
  presupuesto: string;
  checklist: string;
  guia: string;
  elegibilidad: EligibilityResult | null;
  datosFaltantes: string;   // preguntas que la IA no puede responder sin más datos del perfil
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
    return { ok: false, memoria: '', presupuesto: '', checklist: '', guia: '', elegibilidad: null, datosFaltantes: '', error: 'no_openrouter_key' };
  }

  const sistemaPrompt = `Eres un experto en subvenciones públicas en España con 15 años de experiencia en tercer sector, PYME, innovación social y propiedad industrial. Tienes dos roles en cada solicitud:

ROL 1 — ANALISTA DE ELEGIBILIDAD:
Antes de redactar nada, verificas si la organización solicitante cumple los requisitos de la convocatoria.
- Extraes los requisitos de los beneficiarios de las bases (tipo de entidad, antigüedad, territorio, sector, empleados, volumen económico, etc.)
- Evalúas cada requisito contra los datos del perfil de la organización
- Marcas con ✅ (cumple), ❌ (no cumple), ⚠️ (probable/condicionado), ❓ (no hay datos suficientes)
- Identificas qué datos faltan en el perfil para confirmar elegibilidad
- Das un score de elegibilidad de 0 a 100 y determinas si hay algún requisito bloqueante (❌ claro)

ROL 2 — REDACTOR DE SOLICITUDES:
Solo si la organización es elegible (o probablemente elegible), redactas los documentos.
- Adapta el tono, vocabulario y estructura al tipo de convocatoria y entidad
- No inventes datos — si falta info clave, márcala con [COMPLETAR: descripción]
- Formatea en Markdown limpio y bien estructurado
- Usa cifras y hechos concretos
- Si hay CRITERIOS DE VALORACIÓN (BAREMO), optimiza la memoria para puntuar máximo en cada criterio
- Ordena la memoria priorizando los criterios de mayor peso

INSTRUCCIÓN CRÍTICA DE FORMATO: Responde SOLO con los bloques marcados, sin texto introductorio ni explicaciones fuera de ellos.`;

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

Genera los siguientes bloques separados por los marcadores EXACTOS. No añadas texto fuera de los marcadores.

===ELEGIBILIDAD===
Analiza si la organización cumple los requisitos de la convocatoria.
Formato estricto (una línea por campo):
SCORE: [0-100]
BLOQUEANTE: [SI/NO]
REQ: [✅/❌/⚠️/❓] [Nombre del requisito] — [Evaluación en 1 frase, qué dice la conv y qué tiene el perfil]
(repite REQ: para cada requisito que identifiques en las bases — tipos de entidad admitidos, antigüedad mínima, territorio, sectores CNAE, empleados mínimos, volumen económico, inscripciones registrales, certificados requeridos, etc.)
RESUMEN: [1-2 frases de conclusión sobre la elegibilidad]

===DATOS_FALTANTES===
Lista de preguntas concretas que no puedes responder sobre elegibilidad porque el perfil no tiene esos datos. Solo preguntas necesarias para confirmar elegibilidad — no sobre el proyecto. Si no falta nada relevante, escribe: Ninguno.
Formato: una pregunta por línea, empezando con "- "

===MEMORIA_TECNICA===
[SOLO si BLOQUEANTE: NO en el bloque anterior — si BLOQUEANTE: SI, escribe aquí "[NO PROCEDE: ver análisis de elegibilidad]"]
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
        max_tokens: 7000,
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
      return { ok: false, memoria: '', presupuesto: '', checklist: '', guia: '', elegibilidad: null, datosFaltantes: '', error: `openrouter_${res.status}` };
    }

    const json = await res.json();
    rawOutput = json.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    console.error('[copiloto-engine] Fetch error:', err);
    return { ok: false, memoria: '', presupuesto: '', checklist: '', guia: '', elegibilidad: null, datosFaltantes: '', error: 'network_error' };
  }

  // Parsear todos los bloques (ahora son 6)
  const ALL_MARKERS = [
    '===ELEGIBILIDAD===',
    '===DATOS_FALTANTES===',
    '===MEMORIA_TECNICA===',
    '===PRESUPUESTO===',
    '===CHECKLIST===',
    '===GUIA_PRESENTACION===',
  ];

  function extractBlock(raw: string, marker: string): string {
    const start = raw.indexOf(`===${marker}===`);
    if (start === -1) return '';
    const afterMarker = raw.indexOf('\n', start) + 1;
    let end = raw.length;
    for (const m of ALL_MARKERS) {
      if (m === `===${marker}===`) continue;
      const pos = raw.indexOf(m, afterMarker);
      if (pos !== -1 && pos < end) end = pos;
    }
    return raw.slice(afterMarker, end).trim();
  }

  const elegibilidadRaw = extractBlock(rawOutput, 'ELEGIBILIDAD');
  const datosFaltantes = extractBlock(rawOutput, 'DATOS_FALTANTES');
  const memoriaRaw = extractBlock(rawOutput, 'MEMORIA_TECNICA') || rawOutput;
  const presupuesto = extractBlock(rawOutput, 'PRESUPUESTO');
  const checklist = extractBlock(rawOutput, 'CHECKLIST');
  const guia = extractBlock(rawOutput, 'GUIA_PRESENTACION');

  // Parsear la elegibilidad
  const elegibilidad = elegibilidadRaw ? parseEligibility(elegibilidadRaw) : null;

  // Si el modelo marcó NO PROCEDE en la memoria, los documentos están vacíos intencionalmente
  const memoria = memoriaRaw.includes('[NO PROCEDE') ? '' : memoriaRaw;

  console.log(`[copiloto-engine] Elegibilidad: score=${elegibilidad?.score ?? '?'} bloqueante=${elegibilidad?.bloqueante ?? '?'}`);

  return { ok: true, memoria, presupuesto, checklist, guia, elegibilidad, datosFaltantes };
}
