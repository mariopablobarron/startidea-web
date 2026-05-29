/**
 * POST /api/generar-memoria
 *
 * Genera un borrador de memoria técnica usando OpenRouter (Claude Haiku).
 * Combina los datos de la convocatoria (de la BD) con los de la entidad
 * introducidos en el wizard del expediente.
 *
 * Body JSON: {
 *   slug?             convocatoria slug (vacío si es conv manual/externa)
 *   conv_nombre?      fallback si no hay slug de BD
 *   nombre_entidad    nombre de la org solicitante
 *   org_type          valor del select orgType
 *   descripcion_proyecto  texto libre del textarea
 *   beneficiarios_anuales?
 *   presupuesto_anual?
 *   logros?
 * }
 *
 * Response: { ok: true, memoria: string } | { ok: false, error: string }
 */
import type { APIRoute } from 'astro';
import { getConvocatoria } from '@/lib/expedientes-db';

export const prerender = false;

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-haiku-4-5';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ── Rate limit en memoria (se reinicia con cada deploy/restart) ────────────
const RL_MAP = new Map<string, { count: number; ts: number }>();
const RL_WINDOW_MS = 60_000;   // ventana de 1 minuto
const RL_MAX_REQ   = 4;        // 4 generaciones por IP por minuto (3 usuarios reales + 1 margen)

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const r   = RL_MAP.get(ip);
  if (!r || now - r.ts > RL_WINDOW_MS) {
    RL_MAP.set(ip, { count: 1, ts: now });
    return false;
  }
  r.count++;
  return r.count > RL_MAX_REQ;
}

// ── Tipos de organización ─────────────────────────────────────────────────
const ORG_TYPE_LABEL: Record<string, string> = {
  asociacion:        'Asociación sin ánimo de lucro',
  fundacion:         'Fundación',
  cooperativa:       'Cooperativa de iniciativa social',
  'entidad-religiosa': 'Entidad religiosa con actividad social',
  'entidad-local':   'Entidad local (ayuntamiento / diputación)',
  empresa:           'Empresa',
  otro:              'Otra entidad',
};

// ── Endpoint ──────────────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request, clientAddress }) => {
  // En SSR con adapter Node, las vars de entorno runtime se leen de
  // process.env, NO de import.meta.env (que solo expone build-time).
  // Fallback a import.meta.env por compatibilidad con preview.
  const apiKey = process.env.OPENROUTER_API_KEY ?? import.meta.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[generar-memoria] OPENROUTER_API_KEY no configurada');
    return json({ ok: false, error: 'no_api_key' }, 500);
  }

  // Rate limit
  if (isRateLimited(clientAddress ?? 'unknown')) {
    return json({ ok: false, error: 'rate_limited', message: 'Demasiadas solicitudes. Espera un momento.' }, 429);
  }

  let body: Record<string, string>;
  try {
    body = (await request.json()) as Record<string, string>;
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const {
    slug                 = '',
    conv_nombre          = '',
    nombre_entidad       = '',
    org_type             = '',
    descripcion_proyecto = '',
    beneficiarios_anuales = '',
    presupuesto_anual    = '',
    logros               = '',
  } = body;

  if (!descripcion_proyecto.trim()) {
    return json({ ok: false, error: 'missing_descripcion' }, 400);
  }

  // ── Obtener datos de la convocatoria desde la BD ───────────────────────
  let convInfo = '';
  let convTitulo = conv_nombre || 'convocatoria de acción social';

  if (slug) {
    try {
      const conv = getConvocatoria(slug);
      if (conv) {
        convTitulo = conv.titulo;
        convInfo = [
          `Título completo: ${conv.tituloFull || conv.titulo}`,
          `Organismo convocante: ${conv.organo}`,
          `Plazo de presentación: ${conv.deadline}`,
          `Tipo de beneficiarios: ${conv.beneficiarioLabel || conv.tipoEntidades}`,
          `Qué financia: ${(conv.financiaResumen ?? []).join(' / ') || '—'}`,
          `Gastos elegibles: ${(conv.gastosOk ?? []).join(', ') || '—'}`,
          `Gastos NO elegibles: ${(conv.gastosNo ?? []).join(', ') || 'los no incluidos en bases reguladoras'}`,
          `Requisitos: ${(conv.requisitos ?? []).join(', ') || '—'}`,
          `Importe orientativo: ${conv.importeRange || '—'}`,
          conv.nota ? `Nota importante: ${conv.nota}` : '',
        ].filter(Boolean).join('\n');
      }
    } catch (e) {
      console.warn('[generar-memoria] No se pudo cargar convocatoria:', slug, e);
    }
  }

  if (!convInfo) {
    convInfo = conv_nombre
      ? `Título: ${conv_nombre}\n(Datos completos no disponibles — adaptar según las bases reguladoras publicadas.)`
      : 'Convocatoria de subvenciones de acción social (datos no disponibles, adaptar según las bases).';
  }

  // ── Prompt ────────────────────────────────────────────────────────────
  const systemPrompt = `Eres un experto en redacción de memorias técnicas para convocatorias de subvenciones públicas en España, con especialización en el tercer sector y la acción social en Andalucía. Llevas más de 15 años elaborando memorias para fundaciones, asociaciones y entidades locales, con alto porcentaje de éxito.

REGLAS DE ESCRITURA:
- Español formal, claro y directo. Frases cortas. Sin jerga vacía.
- Cuando no tengas datos concretos de la entidad, usa corchetes [COMPLETAR: descripción concisa de lo que falta] para marcar los huecos.
- Genera texto útil y adaptado, no relleno genérico. Cada sección debe sonar específica para esta convocatoria y esta entidad.
- Los objetivos deben ser SMART (específicos, medibles, alcanzables, relevantes, temporales).
- En el presupuesto, usa las partidas de gastos elegibles de la convocatoria.
- El borrador debe tener entre 1.500 y 2.500 palabras.`;

  const userPrompt = `Genera el borrador de memoria técnica con los siguientes datos:

══════════ CONVOCATORIA ══════════
${convInfo}

══════════ ENTIDAD SOLICITANTE ══════════
Nombre: ${nombre_entidad || '[Nombre de la entidad]'}
Tipo de entidad: ${ORG_TYPE_LABEL[org_type] || org_type || 'Entidad sin ánimo de lucro'}
Descripción y proyecto: ${descripcion_proyecto}${beneficiarios_anuales ? `\nPersonas atendidas al año: ${beneficiarios_anuales}` : ''}${presupuesto_anual ? `\nPresupuesto anual de la entidad: ${presupuesto_anual}` : ''}${logros ? `\nLogros e indicadores destacados:\n${logros}` : ''}

══════════ ESTRUCTURA DE LA MEMORIA ══════════
Redacta el documento completo con estas secciones numeradas:

1. PRESENTACIÓN DE LA ENTIDAD
   - Datos identificativos (nombre, CIF, domicilio social, forma jurídica)
   - Historia, misión, visión y valores
   - Ámbito geográfico de actuación
   - Estructura orgánica y recursos humanos (personal remunerado y voluntariado)
   - Trayectoria acreditada en el sector

2. DIAGNÓSTICO Y JUSTIFICACIÓN DE LA NECESIDAD SOCIAL
   - Identificación del problema o necesidad que aborda el proyecto
   - Datos estadísticos del contexto (Andalucía / España — usa datos reales o aproximados con nota "[verificar]")
   - Por qué esta entidad está en condiciones técnicas y organizativas para abordarlo

3. DESCRIPCIÓN DEL PROYECTO
   - Denominación del proyecto
   - Objetivo general
   - Objetivos específicos (3–5, medibles y verificables)
   - Metodología de intervención detallada
   - Actividades concretas (con responsable, temporalización orientativa y recursos necesarios)
   - Beneficiarios directos e indirectos (número y perfil)

4. CRONOGRAMA DE EJECUCIÓN
   Tabla con actividades en filas y meses en columnas (12 meses). Usa "X" para los meses de ejecución.

5. RECURSOS HUMANOS Y MATERIALES
   - Perfiles profesionales implicados, dedicación y funciones
   - Instalaciones y equipamiento disponible o necesario

6. PRESUPUESTO DESGLOSADO
   Tabla con:
   | Partida (usar gastos elegibles de la convocatoria) | Coste unitario | Unidades | Total |
   Incluir desglose de ingresos (subvención solicitada + cofinanciación si procede).

7. SISTEMA DE SEGUIMIENTO Y EVALUACIÓN
   - Indicadores de proceso (mínimo 3)
   - Indicadores de resultado (mínimo 3, con valores meta)
   - Sistema de recogida de datos y periodicidad
   - Informes previstos (intermedio y final)

8. SOSTENIBILIDAD E IMPACTO
   - Continuidad del proyecto más allá del período subvencionado
   - Otras fuentes de financiación previstas
   - Impacto esperado a medio plazo

⚠ ADVERTENCIAS ANTES DE PRESENTAR (sección final obligatoria)
Lista numerada de los aspectos que la entidad debe verificar, completar o aportar antes de la presentación:
- Documentación requerida según las bases
- Puntos [COMPLETAR] que deben rellenarse con datos reales
- Aspectos de elegibilidad a confirmar`;

  // ── Llamada a OpenRouter ───────────────────────────────────────────────
  try {
    const llmRes = await fetch(OPENROUTER_API, {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'HTTP-Referer':   'https://startidea.es',
        // HTTP headers solo aceptan ASCII (ByteString). El em dash (—, U+2014)
        // hacía que fetch() lanzara "Cannot convert argument to a ByteString".
        'X-Title':        'Startidea Copiloto Subvenciones',
      },
      body: JSON.stringify({
        model:       MODEL,
        max_tokens:  4096,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error('[generar-memoria] OpenRouter HTTP error:', llmRes.status, errText.slice(0, 300));
      return json({ ok: false, error: 'llm_http_error', status: llmRes.status }, 500);
    }

    const llmData = await llmRes.json() as {
      choices?: { message?: { content?: string } }[];
      error?:   { message?: string };
    };

    if (llmData.error?.message) {
      console.error('[generar-memoria] LLM error:', llmData.error.message);
      return json({ ok: false, error: 'llm_api_error', detail: llmData.error.message }, 500);
    }

    const memoria = llmData.choices?.[0]?.message?.content?.trim() ?? '';
    if (!memoria) {
      return json({ ok: false, error: 'empty_response' }, 500);
    }

    console.info(`[generar-memoria] OK slug=${slug || 'manual'} entity="${nombre_entidad.slice(0, 40)}" len=${memoria.length}`);
    return json({ ok: true, memoria, convocatoria: convTitulo });

  } catch (e) {
    console.error('[generar-memoria] Excepción:', e);
    return json({ ok: false, error: 'internal', detail: String(e) }, 500);
  }
};
