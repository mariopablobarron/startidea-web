/**
 * copiloto-engine.ts
 *
 * Lógica compartida de generación de documentos del Copiloto de Subvenciones.
 * Usada por:
 *   - /api/generar-expediente    (generación manual desde panel admin)
 *   - /api/auto-copiloto/trigger (generación automática en cron diario)
 */

import type { Expediente } from './expedientes-db';
import { getConvocatoria } from './expedientes-db';
import { fetchSubsidyDetail } from './subsidies-api';
import { detectSede, sedeContextoPrompt } from './sedes-map';
import { getEnv } from '@/lib/env';


// ─── Extracción de baremo/criterios de valoración ─────────────────────────────

/**
 * Mini "Corrective RAG" sobre el texto bruto de las bases.
 *
 * En vez de volcar 6000 caracteres a ciegas (donde la sección de requisitos
 * puede quedar fuera y el modelo acaba inventando), localizamos las secciones
 * que de verdad importan para el análisis: REQUISITOS de beneficiarios y
 * BAREMO de valoración. Luego graduamos: si NO aparecen, el llamante inyecta
 * un aviso para que el modelo NO alucine requisitos.
 */

/** Extrae el cuerpo de una sección que empieza en uno de `startHeaders` y
 *  termina al llegar a uno de `stopHeaders` (o al límite de líneas). */
function extractSection(
  basesText: string,
  startHeaders: string[],
  stopHeaders: string[],
  maxLines = 40,
): string {
  const lines = basesText.split('\n');
  const out: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const lower = line.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!inSection && startHeaders.some((h) => lower.includes(h))) {
      inSection = true;
    }
    if (inSection) {
      if (stopHeaders.some((h) => lower.includes(h)) && out.length > 3) break;
      out.push(line);
      if (out.length >= maxLines) break;
    }
  }

  return out.length >= 2 ? out.join('\n') : '';
}

/** Sección de baremo / criterios de valoración (lo que más importa para la memoria). */
function extractBaremo(basesText: string): string {
  const body = extractSection(
    basesText,
    ['criterios de valoraci', 'criterios de selecci', 'baremo', 'puntuaci', 'criterios de concesi'],
    ['documentaci', 'presentaci', 'plazo', 'justificaci', 'obligaci', 'reintegro'],
  );
  return body ? `\nCRITERIOS DE VALORACIÓN (BAREMO):\n${body}` : '';
}

/** Sección de requisitos / beneficiarios (lo que más importa para la elegibilidad). */
function extractRequisitos(basesText: string): string {
  const body = extractSection(
    basesText,
    [
      'beneficiari', 'requisitos', 'podran ser', 'podran solicitar',
      'destinatari', 'quien puede', 'entidades solicitantes',
    ],
    ['documentaci', 'presentaci', 'plazo', 'criterios de valoraci', 'baremo', 'obligaci', 'gastos'],
  );
  return body ? `\nREQUISITOS DE LOS BENEFICIARIOS:\n${body}` : '';
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
    // 1. Intentar primero desde el catálogo local (SQLite propio)
    try {
      const localConv = getConvocatoria(opts.convocatoria_slug);
      if (localConv) {
        organismo = localConv.organo || null;
        context = [
          `CONVOCATORIA: ${localConv.tituloFull || localConv.titulo}`,
          localConv.organo           ? `ORGANISMO: ${localConv.organo}` : '',
          localConv.deadline         ? `PLAZO: ${localConv.deadline}` : '',
          localConv.importeRange     ? `DOTACIÓN: ${localConv.importeRange}` : '',
          localConv.tipoEntidades    ? `BENEFICIARIOS: ${localConv.tipoEntidades}` : '',
          localConv.financiaResumen?.length
            ? `\nQUÉ FINANCIA:\n${localConv.financiaResumen.map(b => `- ${b}`).join('\n')}`
            : '',
          localConv.gastosOk?.length
            ? `\nGASTOS ELEGIBLES:\n${localConv.gastosOk.map(g => `- ${g}`).join('\n')}`
            : '',
          localConv.gastosNo?.length
            ? `\nGASTOS NO ELEGIBLES:\n${localConv.gastosNo.map(g => `- ${g}`).join('\n')}`
            : '',
          localConv.requisitos?.length
            ? `\nREQUISITOS:\n${localConv.requisitos.map(r => `- ${r}`).join('\n')}`
            : '',
          localConv.importe          ? `\nDETALLE IMPORTE:\n${localConv.importe}` : '',
          localConv.nota             ? `\nNOTAS:\n${localConv.nota}` : '',
        ].filter(Boolean).join('\n');
      }
    } catch (err) {
      console.warn('[copiloto-engine] No se encontró en catálogo local:', err);
    }

    // 2. Si no hay contexto, intentar desde el HUB externo (BDNS)
    if (!context) {
      try {
        const conv = await fetchSubsidyDetail(opts.convocatoria_slug);
        if (conv) {
          organismo = conv.organization ?? null;

          // Mini Corrective RAG: extraemos las secciones clave de las bases y
          // graduamos su presencia en vez de volcar 6000 caracteres a ciegas.
          const bases = conv.bases_text ?? '';
          const requisitosBlock = bases ? extractRequisitos(bases) : '';
          const baremoBlock = bases ? extractBaremo(bases) : '';
          // "Corrección": si no localizamos requisitos NI baremo en el texto,
          // avisamos al modelo para que NO invente (que se apoye en SIN_DATOS
          // y [COMPLETAR] en lugar de alucinar requisitos).
          const basesInsuficientes = !!bases && !requisitosBlock && !baremoBlock;

          context = [
            `CONVOCATORIA: ${conv.title}`,
            conv.organization ? `ORGANISMO: ${conv.organization}` : '',
            conv.deadline ? `PLAZO: ${conv.deadline}` : '',
            conv.amount_eur
              ? `DOTACIÓN MÁXIMA: ${conv.amount_eur.toLocaleString('es-ES')} €`
              : '',
            conv.description ? `\nDESCRIPCIÓN BASES:\n${conv.description}` : '',
            requisitosBlock, // sección dirigida → elegibilidad
            baremoBlock,     // sección dirigida → memoria
            bases ? `\nCONTENIDO BASES (extracto):\n${bases.slice(0, 5000)}` : '',
            basesInsuficientes
              ? '\n⚠️ AVISO AL ANALISTA: no se han localizado secciones explícitas de requisitos de beneficiarios ni de baremo en el texto de las bases disponible. NO infieras requisitos que no estén escritos literalmente: para cualquier requisito sin base textual usa estado SIN_DATOS, y en la memoria marca [COMPLETAR: revisar bases oficiales].'
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
  estado: 'cumple' | 'no_cumple' | 'parcial' | 'sin_datos';
  peso: 'bloqueante' | 'normal';
  texto: string; // "<emoji> Nombre del requisito — evaluación" (formato que espera la UI)
}

export interface EligibilityResult {
  score: number;           // 0-100
  bloqueante: boolean;     // hay al menos un ❌ con peso decisivo
  checks: EligibilityCheck[];
  resumen: string;
  raw: string;             // bloque completo para guardar en BD
}

const ESTADO_EMOJI: Record<EligibilityCheck['estado'], EligibilityCheck['emoji']> = {
  cumple: '✅',
  no_cumple: '❌',
  parcial: '⚠️',
  sin_datos: '❓',
};

/**
 * Parsea una línea REQ en un check estructurado.
 * Formato deterministic-picker (el modelo solo decide categorías):
 *   REQ: CUMPLE | NORMAL | Tipo de entidad — La conv admite fundaciones; el perfil es fundación.
 *   REQ: NO_CUMPLE | BLOQUEANTE | Antigüedad mínima — La conv exige 2 años; el perfil no acredita.
 * Acepta también el formato legacy (línea que empieza con emoji) por compatibilidad.
 */
function parseReqLine(line: string): EligibilityCheck | null {
  const parts = line.split('|');
  if (parts.length >= 3) {
    const e = parts[0].trim().toUpperCase();
    const p = parts[1].trim().toUpperCase();
    const rest = parts.slice(2).join('|').trim();
    const estado: EligibilityCheck['estado'] = e.startsWith('CUMPLE')
      ? 'cumple'
      : e.startsWith('NO')
        ? 'no_cumple'
        : e.startsWith('PARC')
          ? 'parcial'
          : 'sin_datos';
    const peso: EligibilityCheck['peso'] = p.startsWith('BLOQ') ? 'bloqueante' : 'normal';
    const emoji = ESTADO_EMOJI[estado];
    return { estado, peso, emoji, texto: `${emoji} ${rest}` };
  }
  // Fallback legacy: línea que empieza con emoji.
  let estado: EligibilityCheck['estado'] | null = null;
  if (line.startsWith('✅')) estado = 'cumple';
  else if (line.startsWith('❌')) estado = 'no_cumple';
  else if (line.startsWith('⚠️') || line.startsWith('⚠')) estado = 'parcial';
  else if (line.startsWith('❓')) estado = 'sin_datos';
  if (!estado) return null;
  return { estado, peso: 'normal', emoji: ESTADO_EMOJI[estado], texto: line };
}

/**
 * Parsea el bloque ===ELEGIBILIDAD=== generado por el modelo.
 *
 * Patrón "deterministic-picker": el modelo SOLO emite el veredicto categórico
 * de cada requisito (estado + peso); el SCORE y el BLOQUEANTE los calcula este
 * código de forma reproducible y auditable (no nos fiamos de un número que el
 * LLM se inventa). Formato esperado por requisito:
 *   REQ: [CUMPLE|NO_CUMPLE|PARCIAL|SIN_DATOS] | [BLOQUEANTE|NORMAL] | Nombre — evaluación
 *   RESUMEN: ...
 */
export function parseEligibility(block: string): EligibilityResult {
  const checks: EligibilityCheck[] = [];
  for (const m of block.matchAll(/^REQ:\s*(.+)$/gim)) {
    const c = parseReqLine(m[1].trim());
    if (c) checks.push(c);
  }

  // Score = % de requisitos evaluables que se cumplen (parcial cuenta medio).
  // sin_datos no penaliza ni puntúa (no es evaluable todavía).
  const evaluables = checks.filter((c) => c.estado !== 'sin_datos').length;
  const cumple = checks.filter((c) => c.estado === 'cumple').length;
  const parcial = checks.filter((c) => c.estado === 'parcial').length;
  const score =
    evaluables === 0 ? 50 : Math.round((100 * (cumple + 0.5 * parcial)) / evaluables);

  // Bloqueante = algún requisito de peso BLOQUEANTE que NO se cumple.
  const bloqueante = checks.some((c) => c.peso === 'bloqueante' && c.estado === 'no_cumple');

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
 *
 * @param docsContext  Texto extraído de los documentos del cliente (opcional)
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
  docsContext?: string,
): Promise<GenerationResult> {
  const openrouterKey = getEnv('OPENROUTER_API_KEY');
  if (!openrouterKey) {
    return { ok: false, memoria: '', presupuesto: '', checklist: '', guia: '', elegibilidad: null, datosFaltantes: '', error: 'no_openrouter_key' };
  }

  const sistemaPrompt = `Eres un experto en subvenciones públicas en España con 15 años de experiencia gestionando solicitudes exitosas para entidades del tercer sector, PYME innovadoras y organizaciones de impacto social. Has tramitado más de 400 solicitudes y conoces a fondo qué diferencia una memoria que consigue la ayuda de una que no la consigue.

ROL 1 — ANALISTA DE ELEGIBILIDAD:
Antes de redactar nada, verificas si la organización solicitante cumple los requisitos de la convocatoria.
- Extraes los requisitos de los beneficiarios de las bases (tipo de entidad, antigüedad, territorio, sector CNAE, empleados, volumen económico, registro obligatorio, etc.)
- Evalúas cada requisito contra los datos del perfil de la organización
- Marcas con ✅ (cumple claramente), ❌ (no cumple o incumplimiento probable), ⚠️ (probable pero condicionado a datos adicionales), ❓ (no hay datos suficientes en el perfil)
- Identificas qué datos faltan en el perfil para confirmar elegibilidad con certeza
- Das un score de elegibilidad de 0 a 100 y determinas si hay algún requisito bloqueante (❌ claro que inhabilita la solicitud)

ROL 2 — REDACTOR DE SOLICITUDES GANADORAS:
Solo si la organización es elegible (o probablemente elegible), redactas los documentos aplicando esta metodología probada:

PRINCIPIOS DE MEMORIA GANADORA:
1. ESPEJO DE CONVOCATORIA: usa literalmente el vocabulario de las bases. Si las bases dicen "innovación social inclusiva", usa esas palabras exactas. Los evaluadores buscan ese lenguaje.
2. BAREMO INVERTIDO: ordena la memoria según el peso de los criterios del baremo, del mayor al menor. Lo que más puntúa va primero y con más extensión y detalle.
3. CUANTIFICA TODO: nunca "muchos beneficiarios" → siempre "847 personas atendidas en 2023 según memoria de actividades". Nunca "amplia experiencia" → "14 años de trayectoria, 23 proyectos financiados". Los números dan credibilidad y facilitan la puntuación al evaluador.
4. INDICADORES SMART: cada objetivo lleva un indicador medible (qué, cuánto, cuándo). Ej: "Objetivo 1: Atender a 120 jóvenes en riesgo de exclusión antes del 31/12/2026, medido por ficha de inscripción y acta de participación."
5. CAPACIDAD TÉCNICA DEMOSTRADA: dedica al menos un párrafo a demostrar que la entidad PUEDE ejecutar el proyecto: equipo técnico, infraestructura, experiencia en proyectos similares, resultados anteriores verificables.
6. SOSTENIBILIDAD: explica cómo el proyecto continúa después de la subvención (autofinanciación, financiación diversificada, consolidación en la estructura). Los evaluadores descuentan proyectos que dependen al 100% de la subvención.
7. TRANSVERSALIDAD: si el baremo lo valora, incluye referencias explícitas a igualdad de género, sostenibilidad ambiental, digitalización o accesibilidad. Si no hay baremo, añade una frase de cierre sobre estos ejes.
8. COHERENCIA INTERNA: el presupuesto, la memoria, los objetivos y el cronograma deben contar exactamente la misma historia. Una memoria que pide 50.000€ para 3 personas en 6 meses debe cuadrar con el presupuesto y el cronograma.

ERRORES COMUNES A EVITAR (que causan rechazo o minusvaloración):
- Objetivos genéricos sin indicadores: "mejorar la calidad de vida" sin medidor
- Presupuesto desproporcionado: 80% en personal sin justificar o 90% en un concepto
- Ignorar los criterios del baremo en la estructura de la memoria
- No mencionar la trayectoria cuando es criterio valorable
- Gastos del período anterior al inicio subvencionable
- No indicar el % de cofinanciación cuando la conv lo exige
- Certificados caducados en el momento de la presentación

FORMATO:
- Formatea en Markdown limpio y bien estructurado
- No inventes datos — si falta información clave, márcala exactamente así: [COMPLETAR: descripción de qué falta]
- Usa cifras y hechos concretos; cuando no los tengas, marca [COMPLETAR: dato concreto necesario]

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
${docsContext ?? ''}

---

Genera los siguientes bloques separados por los marcadores EXACTOS. No añadas texto fuera de los marcadores.

===ELEGIBILIDAD===
Analiza si la organización cumple los requisitos de la convocatoria.
NO calcules ninguna puntuación ni veredicto global: tú SOLO emites el veredicto de cada requisito; nuestro sistema calcula el score y si hay bloqueo.
Formato estricto, UNA línea por requisito, con los dos campos separados por " | ":
REQ: [ESTADO] | [PESO] | [Nombre del requisito] — [Evaluación en 1 frase: qué exige la conv y qué tiene el perfil]
Donde:
- ESTADO = CUMPLE | NO_CUMPLE | PARCIAL | SIN_DATOS
  · CUMPLE: el perfil cumple claramente
  · NO_CUMPLE: no cumple o incumplimiento probable
  · PARCIAL: probable pero condicionado a datos adicionales
  · SIN_DATOS: el perfil no aporta datos suficientes para decidir
- PESO = BLOQUEANTE | NORMAL
  · BLOQUEANTE: si NO se cumple, inhabilita la solicitud por sí solo (p. ej. tipo de entidad no admitido, territorio fuera de ámbito)
  · NORMAL: resta pero no inhabilita
Ejemplos:
REQ: CUMPLE | NORMAL | Antigüedad mínima — La conv exige 1 año; el perfil acredita 14 años.
REQ: NO_CUMPLE | BLOQUEANTE | Tipo de entidad — La conv es solo para fundaciones; el perfil es asociación.
Repite REQ: para cada requisito de las bases (tipo de entidad, antigüedad mínima, territorio, CNAE, empleados, volumen económico, registros obligatorios, certificados previos, incompatibilidades, etc.). Si las bases no especifican un requisito, no lo inventes.
RESUMEN: [1-2 frases de conclusión sobre la elegibilidad]

===DATOS_FALTANTES===
Lista de preguntas concretas que no puedes responder sobre elegibilidad porque el perfil no tiene esos datos. Solo preguntas necesarias para confirmar elegibilidad — no sobre el proyecto. Si no falta nada relevante, escribe: Ninguno.
Formato: una pregunta por línea, empezando con "- "

===MEMORIA_TECNICA===
[SOLO si NINGÚN requisito BLOQUEANTE quedó en NO_CUMPLE. Si hay al menos un requisito de peso BLOQUEANTE con estado NO_CUMPLE, escribe exactamente "[NO PROCEDE: ver análisis de elegibilidad]" y nada más]

ANTES DE ESCRIBIR: identifica de los CRITERIOS DE VALORACIÓN los 3 criterios de mayor puntuación. Estructura la memoria priorizando esos criterios primero y dedicándoles más extensión.

Redacta una memoria técnica completa (700-950 palabras) con esta estructura, adaptada al baremo:

## 1. Presentación de la entidad
Quién es (tipo, misión, territorio), cuándo se fundó, trayectoria acreditada con datos numéricos (proyectos, personas atendidas, años activos), legitimidad para ejecutar este tipo de proyecto. Si hay documentos aportados (estatutos, memoria anterior), usa esa información real.

## 2. Justificación de la necesidad y pertinencia
El problema o necesidad que aborda el proyecto. Por qué esta entidad está en posición única para resolverlo. Datos de contexto si los tienes.

## 3. Objetivos específicos y medibles
Mínimo 3 objetivos. Cada uno con indicador SMART: qué mide, valor objetivo, fecha de consecución, fuente de verificación.

## 4. Descripción detallada del proyecto y metodología
Qué se va a hacer, cómo, con qué recursos humanos y materiales. Enlaza explícitamente con los criterios del baremo si los hay.

## 5. Beneficiarios directos e indirectos
Perfiles concretos, número estimado, criterios de selección, cómo se llega a ellos.

## 6. Cronograma de ejecución
Tabla o lista por fases/hitos con fechas concretas. Coherente con el período subvencionable.

## 7. Impacto esperado, evaluación y sostenibilidad
Indicadores de impacto cuantificables. Plan de evaluación (cómo se medirá). Cómo continúa el proyecto después de la subvención.

## 8. Capacidad técnica y organizativa
Equipo responsable (perfiles, experiencia). Experiencia previa en proyectos similares con subvenciones. Infraestructura disponible.

Notas de redacción:
- Usa el vocabulario exacto de las bases y de los criterios del baremo
- Cada cifra debe ser verificable o marcada [COMPLETAR: dato concreto]
- Si los documentos aportados contienen información relevante, incorpórala

===PRESUPUESTO===
Redacta un presupuesto estructurado por partidas adaptado a esta convocatoria concreta.

Estructura:
| Partida | Concepto | Unidades | Coste unit. | Total |
|---------|----------|----------|-------------|-------|

Partidas habituales (incluye las que apliquen según la convocatoria):
- **Personal propio**: salarios brutos + SS empresa, por perfil y dedicación (%)
- **Contratación de servicios externos**: asesoría, formación externa, diseño
- **Gastos de materiales y suministros**: fungibles, material técnico
- **Gastos de difusión y comunicación**: si aplica al proyecto
- **Desplazamientos y dietas**: si el proyecto lo requiere
- **Gastos indirectos/estructura**: solo si la convocatoria los permite (indica %)

Reglas del presupuesto:
- Marca [COMPLETAR: importe estimado] donde no haya datos suficientes
- Indica el % de cofinanciación propia o de terceros si la conv lo exige
- Añade nota: "Gastos no elegibles según esta convocatoria: [lista los habituales si los conoces]"
- El total debe ser coherente con el importe solicitado indicado
- Si los documentos aportados incluyen un presupuesto previo, úsalo como base

===CHECKLIST===
Checklist completo y personalizado para esta convocatoria concreta.
Organiza por categorías:

**DOCUMENTOS DE LA ENTIDAD** (algunos con caducidad — indicarla):
Para cada doc indica: ✅ [APORTADO], 📋 [PENDIENTE: descripción breve] o ❓ [VERIFICAR si esta conv lo requiere]
- CIF vigente (la tarjeta, no el modelo censal)
- Estatutos registrados (con última modificación inscrita)
- Acta de nombramiento del representante legal VIGENTE (máx 4 años en muchos registros)
- NIF del representante
- Poderes de representación si actúa por apoderamiento

**CERTIFICADOS DE ESTAR AL CORRIENTE** (caducan — obtener en los 6 meses previos a presentación):
- Certificado AEAT de estar al corriente de obligaciones tributarias
- Certificado de la Seguridad Social de estar al corriente
- Certificado de no tener deudas con la Administración autonómica (si la conv lo pide)
- Declaración responsable de no estar incurso en prohibiciones del art. 13 LGS

**DOCUMENTOS DEL PROYECTO**:
- Memoria técnica (el documento que acabamos de generar)
- Presupuesto desglosado (el documento que acabamos de generar)
- Plan de trabajo / cronograma
- CV del equipo técnico responsable [PENDIENTE si no se ha aportado]

**DECLARACIONES OBLIGATORIAS**:
- Declaración de minimis (OBLIGATORIA si la ayuda < 300.000€ en 3 años — verificar acumulación)
- Declaración de otras ayudas solicitadas o concedidas para el mismo proyecto
- Declaración de veracidad de los datos aportados
- Compromiso de mantenimiento de condiciones (si aplica)

**DOCUMENTOS ESPECÍFICOS DE ESTA CONVOCATORIA** (según las bases):
[Lista cualquier documento adicional que se deduzca de las bases de la convocatoria]

⚠️ NOTAS CLAVE:
- Los certificados AEAT y SS deben ser del año en curso o máx 6 meses antes de presentar
- Algunos organismos exigen PDF/A — convierte los documentos si es necesario
- Asegúrate de que el representante que firma es el mismo que figura en el acta de nombramiento

===GUIA_PRESENTACION===
Guía paso a paso para que el solicitante presente la solicitud sin ayuda de nadie.
Usa lenguaje muy claro y concreto — como si explicas a alguien sin experiencia técnica:

**ANTES DE EMPEZAR**:
- Qué certificado digital necesitas (certificado FNMT de persona física o jurídica, DNIe, o Cl@ve firma)
- Cómo instalar Autofirma si no lo tienes (enlace oficial)
- Qué documentos debes tener preparados en PDF (según el checklist)
- Plazo límite exacto de presentación (con margen de seguridad recomendado: no dejar para el último día)

**ACCESO A LA SEDE ELECTRÓNICA**:
1. URL exacta donde encontrar el trámite (si la conoces, o cómo encontrarla)
2. Cómo identificarse en la sede
3. Cómo localizar esta convocatoria concreta

**CUMPLIMENTAR EL FORMULARIO**:
4. Campos del formulario y qué poner en cada uno (los más habituales)
5. Cómo adjuntar los documentos (orden, formato, tamaño máximo habitual)
6. Cómo revisar antes de firmar

**FIRMA Y PRESENTACIÓN**:
7. Cómo firmar con Autofirma paso a paso
8. Qué hacer si Autofirma da error (soluciones habituales)
9. Cómo confirmar que la presentación fue correcta (justificante de registro)

**DESPUÉS DE PRESENTAR**:
10. Qué es el número de registro y dónde guardarlo
11. Plazos habituales de resolución y notificación
12. Cómo consultar el estado de la solicitud
13. Qué hacer si te piden subsanación`;

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
