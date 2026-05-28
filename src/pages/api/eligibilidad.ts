/**
 * POST /api/eligibilidad
 *
 * Detecta qué líneas BOJA 2026 puede solicitar una entidad
 * a partir de su CIF y/o una descripción libre de su actividad.
 *
 * Body JSON: { cif?: string, descripcion?: string }
 * Response : { ok, aplica, tipo_entidad, lineas, mensaje, aviso?, entityFromCIF? }
 */
import type { APIRoute } from 'astro';
import { logEligibilidad } from '../../lib/expedientes-db';

export const prerender = false;

// En producción (Node standalone) las vars privadas viven en process.env.
// import.meta.env las lee en build-time, process.env las lee en runtime.
const OR_KEY = (
  (import.meta as { env?: Record<string, string> }).env?.OPENROUTER_API_KEY ??
  process.env.OPENROUTER_API_KEY ??
  ''
);
const MODEL = 'anthropic/claude-haiku-4-5';

// ─── LÍNEAS BOJA 2026 ─────────────────────────────────────────────────────
const LINEAS = [
  { id: 'L1',  titulo: 'Subvenciones individuales para personas mayores',
    beneficiario: 'persona',
    desc: 'Ayudas directas a personas mayores en situación de necesidad. (Solo personas físicas, no entidades.)' },
  { id: 'L2',  titulo: 'Subvenciones individuales para personas con discapacidad',
    beneficiario: 'persona',
    desc: 'Ayudas directas a personas con discapacidad reconocida. (Solo personas físicas, no entidades.)' },
  { id: 'L7',  titulo: 'Solidaridad y Garantía Alimentaria de Andalucía',
    beneficiario: 'privada',
    desc: 'Programas de entidades privadas en el marco de la Solidaridad y Garantía Alimentaria. Mod.1: comedores, distribución de alimentos. Mod.2: Escuelas de verano para menores en zonas desfavorecidas (plazo especial: 2 junio).' },
  { id: 'L10', titulo: 'Mantenimiento de entidades privadas de acción social',
    beneficiario: 'privada',
    desc: 'Financiación estructural (gastos corrientes, personal, sede) para entidades privadas sin ánimo de lucro de acción social en Andalucía.' },
  { id: 'L11', titulo: 'Programas de acción social para entidades privadas',
    beneficiario: 'privada',
    desc: 'Apoyo a programas concretos de acción social promovidos por entidades privadas. Amplio espectro: inclusión, pobreza, discapacidad, menores, mayores, mujer, inmigrantes.' },
  { id: 'L16', titulo: 'Atención integral a mujeres jóvenes del Sistema de Protección de Menores',
    beneficiario: 'privada',
    desc: 'Programas de entidades privadas para la atención integral a mujeres jóvenes procedentes del Sistema de Protección de Menores (ex-tuteladas).' },
  { id: 'L4',  titulo: 'Programas dirigidos a la Comunidad Gitana',
    beneficiario: 'local',
    desc: 'Subvenciones para ayuntamientos, mancomunidades y diputaciones provinciales con programas dirigidos a la Comunidad Gitana.' },
  { id: 'L6',  titulo: 'Atención a personas inmigrantes y emigrantes temporeras',
    beneficiario: 'local',
    desc: 'Subvenciones a entidades locales para la atención a personas inmigrantes, emigrantes temporeras andaluzas y sus familias.' },
  { id: 'L9',  titulo: 'Promoción de la participación ciudadana',
    beneficiario: 'local',
    desc: 'Subvenciones a entidades locales andaluzas para el fomento y desarrollo de la participación ciudadana activa.' },
  { id: 'L3',  titulo: 'Investigación e innovación en Servicios Sociales',
    beneficiario: 'institucional',
    desc: 'Proyectos de investigación e innovación en el ámbito de los Servicios Sociales. Beneficiarios típicos: universidades, institutos públicos de investigación.' },
  { id: 'L5',  titulo: 'Programas y mantenimiento en el ámbito de la discapacidad',
    beneficiario: 'institucional',
    desc: 'Subvenciones institucionales para entidades representativas del sector de la discapacidad (federaciones, confederaciones, plataformas). Verificar bases 2021.' },
  { id: 'L8',  titulo: 'Derechos, igualdad de trato y no discriminación LGTBI',
    beneficiario: 'institucional',
    desc: 'Subvenciones para garantizar los derechos, igualdad de trato y no discriminación de personas LGTBI. Comprobar beneficiarios exactos en la orden.' },
  { id: 'L12', titulo: 'Promoción y formación del voluntariado y centros de recursos',
    beneficiario: 'institucional',
    desc: 'Programas para la promoción del voluntariado y gestión de centros de recursos para el voluntariado y las asociaciones. Beneficiarios típicos: entidades de segundo nivel.' },
  { id: 'L13', titulo: 'Formación de personas mayores en universidades públicas andaluzas',
    beneficiario: 'institucional',
    desc: 'Programas de actividades complementarias a la formación de personas mayores en universidades públicas andaluzas y fomento de prácticas intergeneracionales.' },
  { id: 'L14', titulo: 'Programas y mantenimiento en el ámbito de las personas mayores',
    beneficiario: 'institucional',
    desc: 'Subvenciones institucionales para entidades con programas en el ámbito de las personas mayores (federaciones, plataformas, confederaciones representativas).' },
] as const;

// ─── CIF → tipo de entidad ────────────────────────────────────────────────
const CIF_MAP: Record<string, { tipo: string; beneficiario: string; elegible: boolean }> = {
  G: { tipo: 'Asociación, fundación u otro tipo de entidad sin ánimo de lucro',   beneficiario: 'privada',       elegible: true  },
  F: { tipo: 'Cooperativa',                                                         beneficiario: 'privada',       elegible: true  },
  P: { tipo: 'Corporación local (ayuntamiento, diputación, mancomunidad)',          beneficiario: 'local',         elegible: true  },
  Q: { tipo: 'Organismo público',                                                   beneficiario: 'institucional', elegible: true  },
  R: { tipo: 'Congregación o comunidad religiosa inscrita',                         beneficiario: 'privada',       elegible: true  },
  V: { tipo: 'Otra entidad sin personalidad jurídica (comunidad de bienes, etc.)', beneficiario: 'privada',       elegible: false },
  S: { tipo: 'Órgano de la Administración del Estado',                             beneficiario: 'institucional', elegible: true  },
  A: { tipo: 'Sociedad Anónima',                                                   beneficiario: 'empresa',       elegible: false },
  B: { tipo: 'Sociedad de Responsabilidad Limitada',                               beneficiario: 'empresa',       elegible: false },
  J: { tipo: 'Sociedad Civil',                                                     beneficiario: 'empresa',       elegible: false },
  K: { tipo: 'Ciudadano/a con NIF (menor de 14 años)',                             beneficiario: 'persona',       elegible: true  },
  L: { tipo: 'Ciudadano/a con NIF (residente en extranjero)',                      beneficiario: 'persona',       elegible: false },
};

function detectEntityFromCIF(cif: string) {
  const letra = cif.trim().toUpperCase()[0];
  return CIF_MAP[letra] ?? null;
}

// ─── API route ────────────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json() as { cif?: string; descripcion?: string };
    const cif = (body.cif ?? '').trim();
    const descripcion = (body.descripcion ?? '').trim();

    if (!cif && !descripcion) {
      return json400('Proporciona al menos el CIF o una descripción de la entidad.');
    }

    const entityFromCIF = cif ? detectEntityFromCIF(cif) : null;

    // ── Construir prompt ──────────────────────────────────────────────────
    const lineasText = LINEAS.map(
      (l) => `- ${l.id}: ${l.titulo} [beneficiario: ${l.beneficiario}] — ${l.desc}`
    ).join('\n');

    const cifContext = entityFromCIF
      ? `CIF analizado: primera letra "${cif[0].toUpperCase()}" indica ${entityFromCIF.tipo} (categoría: ${entityFromCIF.beneficiario}). ${entityFromCIF.elegible ? 'Este tipo de entidad suele ser elegible.' : 'Las empresas mercantiles generalmente NO son beneficiarias de estas líneas.'}`
      : '';

    const userPrompt = [
      cifContext,
      descripcion ? `Descripción de la entidad/actividad: "${descripcion}"` : '',
      '',
      'LÍNEAS DE SUBVENCIÓN BOJA 2026 — Consejería de Inclusión Social, Junta de Andalucía:',
      lineasText,
      '',
      'TAREA:',
      '1. Determina qué líneas pueden solicitar según tipo de entidad y actividad descrita.',
      '2. Devuelve SOLO las líneas con encaje real (máximo 4). Si hay dudas sobre beneficiarios, indícalo en el aviso.',
      '3. Para cada línea, explica en UNA frase breve y directa por qué aplica a esta entidad.',
      '4. Si la entidad es empresa mercantil sin fin social, indica que probablemente no aplica.',
      '5. Sé honesto: no prometas encaje si hay incertidumbre real.',
      '',
      'FORMATO DE RESPUESTA (JSON estricto, sin texto fuera del bloque):',
      '{"aplica":true|false,"tipo_entidad":"descripción corta del tipo detectado","lineas":[{"id":"L10","titulo":"...","razon":"...","encaje":"alto"|"medio"}],"mensaje":"Mensaje cálido y directo para la entidad (max 2 frases)","aviso":"Algo importante a verificar (solo si hay incertidumbre real, omitir si no hace falta)"}',
    ].filter(Boolean).join('\n');

    // ── Llamar a OpenRouter ───────────────────────────────────────────────
    if (!OR_KEY) throw new Error('OPENROUTER_API_KEY no configurado');

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OR_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://startidea.es',
        'X-Title': 'Startidea Eligibilidad BOJA',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Eres un experto asesor de subvenciones públicas de la Junta de Andalucía. Analizas entidades del tercer sector y determinas su elegibilidad para convocatorias específicas. Responde SIEMPRE con JSON válido y sin texto adicional fuera del bloque JSON.',
          },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 700,
        temperature: 0.1,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('OpenRouter error:', errText);
      throw new Error('OpenRouter API error');
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson.choices?.[0]?.message?.content ?? '';

    // Extraer JSON del contenido
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');

    const result = JSON.parse(jsonMatch[0]);

    // Logging anónimo — sin CIF ni descripción, solo tipo detectado + líneas aplicables
    try {
      logEligibilidad({
        tipo_entidad: result.tipo_entidad ?? (entityFromCIF?.tipo ?? ''),
        beneficiario: entityFromCIF?.beneficiario ?? '',
        lineas: Array.isArray(result.lineas)
          ? result.lineas.map((l: { id: string }) => l.id).filter(Boolean)
          : [],
        aplica: Boolean(result.aplica),
      });
    } catch { /* fire-and-forget — nunca romper la respuesta al usuario */ }

    return new Response(
      JSON.stringify({ ok: true, entityFromCIF, ...result }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (err) {
    console.error('eligibilidad API error:', err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'No se ha podido analizar la elegibilidad. Inténtalo de nuevo o escríbenos a hola@startidea.es.',
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
};

function json400(msg: string) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}
