/**
 * memorias-engine.ts — Generador de memorias y justificaciones.
 * Plan de negocio: startidea.es/laboratorio/productos/generador-memorias-justificaciones
 *
 * Hito 1: plantillas de los tres documentos y carga guiada.
 *   1. La organización rellena la carga guiada (datos, actividades, cifras, testimonios).
 *   2. El sistema propone un GUION (índice + mensajes clave + datos destacados) para aprobar.
 *   3. Tras el pago, redacta el DOCUMENTO completo con la voz de la organización;
 *      cada cifra sale de lo cargado (no se inventan datos) y queda en revisión
 *      humana antes de entregarse.
 *
 * Todo lo que decide el modelo es texto; los precios, los tipos y las
 * secciones son de este código. Funciones puras separadas para poder probarlas.
 */

import { pickModel } from './model-router';
import { getEnv } from './env';
import { BRAND_CONSTITUTION } from './brand-constitution';

export type MemoriaTipo = 'justificacion' | 'informe_impacto' | 'memoria_anual';

export interface MemoriaTipoDef {
  key: MemoriaTipo;
  nombre: string;
  descripcion: string;
  precioEur: number;
  /** Secciones fijas del documento, en orden. */
  secciones: string[];
  /** Extensión objetivo en palabras. */
  palabras: [number, number];
}

export const MEMORIA_TIPOS: Record<MemoriaTipo, MemoriaTipoDef> = {
  justificacion: {
    key: 'justificacion',
    nombre: 'Justificación técnica de subvención',
    descripcion: 'Memoria justificativa de una subvención concedida, estructurada según lo que pide la administración.',
    precioEur: 150,
    secciones: [
      'Datos de la entidad y de la subvención',
      'Resumen de la ejecución',
      'Actividades realizadas',
      'Objetivos previstos y grado de cumplimiento',
      'Personas beneficiarias',
      'Indicadores y resultados',
      'Desviaciones y medidas adoptadas',
      'Valoración global',
    ],
    palabras: [1200, 2200],
  },
  informe_impacto: {
    key: 'informe_impacto',
    nombre: 'Informe de impacto para financiador',
    descripcion: 'Informe para fundaciones, empresas patrocinadoras o donantes: qué se hizo con su apoyo y qué cambió.',
    precioEur: 250,
    secciones: [
      'Carta de presentación',
      'El reto y el contexto',
      'Qué se hizo',
      'Resultados e impacto',
      'Historias y testimonios',
      'Uso de los fondos',
      'Aprendizajes y próximos pasos',
      'Agradecimiento',
    ],
    palabras: [1500, 2800],
  },
  memoria_anual: {
    key: 'memoria_anual',
    nombre: 'Memoria anual completa',
    descripcion: 'Memoria de actividades del año: misión, programas, cifras, equipo, transparencia y agradecimientos.',
    precioEur: 400,
    secciones: [
      'Presentación',
      'Misión, visión y valores',
      'El año en cifras',
      'Programas y actividades',
      'Personas beneficiarias e impacto',
      'Equipo, voluntariado y base social',
      'Alianzas y financiadores',
      'Transparencia económica',
      'Retos para el próximo año',
      'Agradecimientos',
    ],
    palabras: [2500, 4500],
  },
};

export function isMemoriaTipo(v: unknown): v is MemoriaTipo {
  return v === 'justificacion' || v === 'informe_impacto' || v === 'memoria_anual';
}

// ─── Carga guiada ───────────────────────────────────────────────────────────

export interface MemoriaCarga {
  tipo: MemoriaTipo;
  org_nombre: string;
  org_tipo: string;
  email: string;
  representante: string;
  /** Año o periodo ("2025", "enero-junio 2026"). */
  periodo: string;
  /** Financiador o administración (informe/justificación). */
  financiador: string;
  /** Convocatoria o programa financiado (justificación). */
  convocatoria: string;
  /** Importe concedido o aportado, texto libre. */
  importe: string;
  /** Qué hace la organización, en sus palabras. */
  que_hace: string;
  /** Actividades realizadas (texto libre, una por línea). */
  actividades: string;
  /** Cifras y datos: "120 familias atendidas", etc. (una por línea). */
  cifras: string;
  /** Testimonios (uno por línea). */
  testimonios: string;
  /** Objetivos previstos, si los hay. */
  objetivos: string;
  /** Dificultades, desviaciones. */
  dificultades: string;
  /** Tono deseado. */
  tono: string;
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function parseCarga(body: Record<string, unknown>): { ok: true; carga: MemoriaCarga } | { ok: false; error: string } {
  if (!isMemoriaTipo(body.tipo)) return { ok: false, error: 'Elige el tipo de documento.' };
  const org_nombre = text(body.org_nombre, 200);
  const email = text(body.email, 200).toLowerCase();
  const representante = text(body.representante, 150);
  const periodo = text(body.periodo, 60);
  const que_hace = text(body.que_hace, 1500);
  const actividades = text(body.actividades, 6000);
  const cifras = text(body.cifras, 3000);
  if (!org_nombre) return { ok: false, error: 'El nombre de la organización es obligatorio.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'El email no es válido.' };
  if (!representante) return { ok: false, error: 'Indica quién firma el documento.' };
  if (!periodo) return { ok: false, error: 'Indica el periodo (por ejemplo, 2025).' };
  if (que_hace.length < 40) return { ok: false, error: 'Cuenta qué hace la organización (al menos dos frases).' };
  if (actividades.length < 60) return { ok: false, error: 'Describe las actividades realizadas (al menos unas líneas).' };
  if (cifras.length < 10) return { ok: false, error: 'Añade al menos una cifra o dato del periodo.' };
  const tipo = body.tipo;
  const financiador = text(body.financiador, 200);
  if ((tipo === 'justificacion' || tipo === 'informe_impacto') && !financiador) {
    return { ok: false, error: tipo === 'justificacion' ? 'Indica la administración que concedió la subvención.' : 'Indica el financiador al que va dirigido el informe.' };
  }
  return {
    ok: true,
    carga: {
      tipo,
      org_nombre,
      org_tipo: text(body.org_tipo, 40) || 'asociacion',
      email,
      representante,
      periodo,
      financiador,
      convocatoria: text(body.convocatoria, 300),
      importe: text(body.importe, 80),
      que_hace,
      actividades,
      cifras,
      testimonios: text(body.testimonios, 3000),
      objetivos: text(body.objetivos, 2000),
      dificultades: text(body.dificultades, 2000),
      tono: text(body.tono, 200) || 'cercano, claro y honesto',
    },
  };
}

/** Cifras cargadas como lista limpia: cada línea con al menos un número. */
export function cifrasLista(cifras: string): string[] {
  return cifras
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter((l) => l.length > 2 && /\d/.test(l));
}

// ─── Guion ──────────────────────────────────────────────────────────────────

export interface Guion {
  titulo: string;
  mensajes_clave: string[];
  secciones: Array<{ titulo: string; contenido: string }>;
  datos_destacados: string[];
  preguntas: string[];
}

export function buildGuionPrompt(c: MemoriaCarga): { system: string; user: string } {
  const def = MEMORIA_TIPOS[c.tipo];
  const system = [
    'Eres redactor de memorias e informes del tercer sector en España, con quince años de experiencia.',
    'Preparas el GUION de un documento antes de redactarlo: índice, mensajes clave, datos destacados y preguntas',
    'a la organización. No inventas cifras, nombres ni hechos: solo usas lo cargado. Español neutro, frases cortas.',
    'Respondes SOLO con un objeto JSON.',
  ].join(' ');
  const user = [
    `TIPO DE DOCUMENTO: ${def.nombre}`,
    `Secciones obligatorias, en este orden: ${def.secciones.join(' · ')}`,
    '',
    `ORGANIZACIÓN: ${c.org_nombre} (${c.org_tipo}) · firma: ${c.representante}`,
    `Periodo: ${c.periodo}`,
    c.financiador ? `Financiador / administración: ${c.financiador}` : '',
    c.convocatoria ? `Convocatoria o programa: ${c.convocatoria}` : '',
    c.importe ? `Importe: ${c.importe}` : '',
    `Tono: ${c.tono}`,
    '',
    `QUÉ HACE: ${c.que_hace}`,
    `ACTIVIDADES:\n${c.actividades}`,
    `CIFRAS Y DATOS:\n${c.cifras}`,
    c.objetivos ? `OBJETIVOS PREVISTOS:\n${c.objetivos}` : '',
    c.testimonios ? `TESTIMONIOS:\n${c.testimonios}` : '',
    c.dificultades ? `DIFICULTADES O DESVIACIONES:\n${c.dificultades}` : '',
    '',
    'Devuelve exactamente este JSON:',
    '{"titulo":"…","mensajes_clave":["3 a 5 frases"],"secciones":[{"titulo":"nombre de la sección","contenido":"2-3 líneas: qué irá y con qué datos"}],"datos_destacados":["cifras literales de lo cargado"],"preguntas":["qué falta para redactar bien; vacío si nada"]}',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

export function parseGuion(textIn: string, def: MemoriaTipoDef): Guion | null {
  const m = textIn.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(m[0]);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const lista = (k: string, max: number, len: number) =>
    Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim().slice(0, len)).slice(0, max) : [];
  const secRaw = Array.isArray(r.secciones) ? (r.secciones as unknown[]) : [];
  const secciones = secRaw
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const o = s as Record<string, unknown>;
      const titulo = typeof o.titulo === 'string' ? o.titulo.trim().slice(0, 120) : '';
      const contenido = typeof o.contenido === 'string' ? o.contenido.trim().slice(0, 600) : '';
      return titulo ? { titulo, contenido } : null;
    })
    .filter((s): s is { titulo: string; contenido: string } => s !== null)
    .slice(0, 14);
  // Las secciones obligatorias mandan: si el modelo se saltó alguna, se añade vacía.
  const faltan = def.secciones.filter((s) => !secciones.some((x) => x.titulo.toLowerCase().includes(s.toLowerCase().slice(0, 12))));
  for (const s of faltan) secciones.push({ titulo: s, contenido: '' });
  const titulo = typeof r.titulo === 'string' && r.titulo.trim() ? r.titulo.trim().slice(0, 160) : def.nombre;
  const mensajes = lista('mensajes_clave', 6, 240);
  if (mensajes.length === 0 && secciones.length === 0) return null;
  return {
    titulo,
    mensajes_clave: mensajes,
    secciones,
    datos_destacados: lista('datos_destacados', 12, 160),
    preguntas: lista('preguntas', 8, 200),
  };
}

// ─── Documento ──────────────────────────────────────────────────────────────

export function buildDocumentoPrompt(c: MemoriaCarga, guion: Guion): { system: string; user: string } {
  const def = MEMORIA_TIPOS[c.tipo];
  const system = [
    'Eres redactor de memorias e informes del tercer sector en España. Redactas el documento completo en Markdown,',
    `entre ${def.palabras[0]} y ${def.palabras[1]} palabras, con la voz de la organización (tono: ${c.tono}).`,
    'REGLAS DURAS: cada cifra que escribas debe estar en los datos cargados, literal; si necesitas un dato que no está,',
    'escribe [COMPLETAR: qué dato]. No inventes nombres, fechas, importes ni resultados. Español neutro, frases cortas,',
    'sin jerga vacía ni superlativos. Usa "## " para cada sección del guion, en el mismo orden. Empieza con "# " y el título.',
    BRAND_CONSTITUTION,
  ].join('\n');
  const user = [
    `TIPO: ${def.nombre}`,
    `TÍTULO: ${guion.titulo}`,
    `ORGANIZACIÓN: ${c.org_nombre} (${c.org_tipo}) · firma: ${c.representante} · periodo ${c.periodo}`,
    c.financiador ? `Financiador / administración: ${c.financiador}` : '',
    c.convocatoria ? `Convocatoria o programa: ${c.convocatoria}` : '',
    c.importe ? `Importe: ${c.importe}` : '',
    '',
    `MENSAJES CLAVE:\n- ${guion.mensajes_clave.join('\n- ')}`,
    `SECCIONES (en este orden):\n${guion.secciones.map((s, i) => `${i + 1}. ${s.titulo}: ${s.contenido}`).join('\n')}`,
    `DATOS DESTACADOS (usa solo estos y los de CIFRAS):\n- ${guion.datos_destacados.join('\n- ')}`,
    '',
    `QUÉ HACE: ${c.que_hace}`,
    `ACTIVIDADES:\n${c.actividades}`,
    `CIFRAS Y DATOS:\n${c.cifras}`,
    c.objetivos ? `OBJETIVOS PREVISTOS:\n${c.objetivos}` : '',
    c.testimonios ? `TESTIMONIOS (cítalos entre comillas, sin retocar):\n${c.testimonios}` : '',
    c.dificultades ? `DIFICULTADES O DESVIACIONES:\n${c.dificultades}` : '',
    '',
    'Redacta ahora el documento completo en Markdown.',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

/** Comprueba que las cifras del documento estén en lo cargado (verificación de datos). */
export function cifrasNoRespaldadas(documento: string, carga: MemoriaCarga): string[] {
  const fuente = `${carga.cifras}\n${carga.actividades}\n${carga.importe}\n${carga.objetivos}\n${carga.que_hace}\n${carga.periodo}\n${carga.testimonios}\n${carga.dificultades}`;
  const norm = (s: string) => s.replace(/[.\s]/g, '');
  const fuenteNums = new Set((fuente.match(/\d[\d.,]*/g) ?? []).map(norm));
  const out = new Set<string>();
  for (const n of documento.match(/\d[\d.,]*/g) ?? []) {
    const k = norm(n);
    if (k.length < 2) continue; // números de sección, enumeraciones
    if (!fuenteNums.has(k)) out.add(n);
  }
  return Array.from(out).slice(0, 30);
}

/** Markdown mínimo → HTML (títulos, negritas, listas, párrafos). */
export function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*[-*]\s+(.+)$/);
    if (li) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(esc(li[1]))}</li>`);
      continue;
    }
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(esc(h[2]))}</h${lvl}>`);
      continue;
    }
    out.push(`<p>${inline(esc(line))}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
  function inline(s: string): string {
    return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[COMPLETAR:([^\]]*)\]/g, '<mark>[COMPLETAR:$1]</mark>');
  }
}

// ─── LLM ────────────────────────────────────────────────────────────────────

export type LlmCall = (system: string, user: string, opts: { tarea: 'clasificacion' | 'redaccion'; maxTokens: number }) => Promise<string>;

async function llamarOpenRouter(system: string, user: string, opts: { tarea: 'clasificacion' | 'redaccion'; maxTokens: number }): Promise<string> {
  const key = getEnv('OPENROUTER_API_KEY');
  if (!key) throw new Error('no_openrouter_key');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://startidea.es',
        'X-Title': 'Startidea Generador de memorias',
      },
      body: JSON.stringify({
        model: pickModel(opts.tarea),
        max_tokens: opts.maxTokens,
        temperature: opts.tarea === 'redaccion' ? 0.5 : 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`openrouter_${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

export async function generarGuion(c: MemoriaCarga, llm: LlmCall = llamarOpenRouter): Promise<Guion> {
  const { system, user } = buildGuionPrompt(c);
  const textOut = await llm(system, user, { tarea: 'clasificacion', maxTokens: 1800 });
  const guion = parseGuion(textOut, MEMORIA_TIPOS[c.tipo]);
  if (!guion) throw new Error('guion_invalido');
  return guion;
}

export async function generarDocumento(c: MemoriaCarga, guion: Guion, llm: LlmCall = llamarOpenRouter): Promise<{ documento: string; avisos: string[] }> {
  const { system, user } = buildDocumentoPrompt(c, guion);
  const documento = (await llm(system, user, { tarea: 'redaccion', maxTokens: 7000 })).trim();
  if (documento.length < 400) throw new Error('documento_corto');
  return { documento, avisos: cifrasNoRespaldadas(documento, c) };
}
