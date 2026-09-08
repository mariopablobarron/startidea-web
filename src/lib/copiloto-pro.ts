/**
 * copiloto-pro.ts — Copiloto de subvenciones Pro (plan de pago del Copiloto Autónomo).
 * Plan de negocio: startidea.es/laboratorio/productos/copiloto-subvenciones-pro
 *
 * Hito 1: planes + "encaje real". El Copiloto gratuito filtra por territorio,
 * importe, finalidades y palabras clave (filtros duros). El Pro cruza cada
 * convocatoria candidata con el perfil completo de la organización usando un
 * modelo de lenguaje y devuelve una puntuación explicada: por qué encaja, qué
 * requisito clave hay que mirar y si merece la pena presentarse.
 *
 * Lo que decide el modelo es categórico (veredicto + motivos); la puntuación
 * final la calcula este código (patrón deterministic-picker, como
 * parseEligibility en copiloto-engine.ts).
 */

import type { AutoCopilotoProfile } from './auto-copiloto-db';
import { pickModel } from './model-router';
import { getEnv } from './env';

export type CopilotoPlan = 'free' | 'pro' | 'pro_memoria';

export interface CopilotoPlanDef {
  key: CopilotoPlan;
  nombre: string;
  precioEur: number;
  /** Convocatorias máximas por ciclo diario. */
  maxPorCiclo: number;
  /** Encaje real con modelo de lenguaje (puntuación explicada). */
  encajeReal: boolean;
  /** Las palabras clave son pista, no filtro duro. */
  keywordsSuaves: boolean;
  /** Variable de entorno con el price ID de Stripe. */
  priceEnv: string | null;
  features: string[];
}

export const COPILOTO_PLANS: Record<CopilotoPlan, CopilotoPlanDef> = {
  free: {
    key: 'free',
    nombre: 'Copiloto Autónomo',
    precioEur: 0,
    maxPorCiclo: 2,
    encajeReal: false,
    keywordsSuaves: false,
    priceEnv: null,
    features: ['Alertas de convocatorias que encajan por filtros', 'Documentación preliminar generada con IA'],
  },
  pro: {
    key: 'pro',
    nombre: 'Copiloto Pro',
    precioEur: 19,
    maxPorCiclo: 5,
    encajeReal: true,
    keywordsSuaves: true,
    priceEnv: 'STRIPE_PRICE_COPILOTO_PRO',
    features: ['Encaje real con puntuación y motivo', 'Hasta 5 convocatorias por día', 'Checklist de elegibilidad', 'Recordatorios de plazo'],
  },
  pro_memoria: {
    key: 'pro_memoria',
    nombre: 'Copiloto Pro Memoria',
    precioEur: 39,
    maxPorCiclo: 5,
    encajeReal: true,
    keywordsSuaves: true,
    priceEnv: 'STRIPE_PRICE_COPILOTO_PRO_MEMORIA',
    features: ['Todo lo de Pro', 'Borrador de memoria adaptado al baremo por convocatoria'],
  },
};

export function isCopilotoPlan(v: unknown): v is CopilotoPlan {
  return v === 'free' || v === 'pro' || v === 'pro_memoria';
}

/** Plan efectivo del perfil: de pago solo si sigue vigente. */
export function planEfectivo(profile: Pick<AutoCopilotoProfile, 'plan' | 'plan_until'>, now = Date.now()): CopilotoPlan {
  const plan = isCopilotoPlan(profile.plan) ? profile.plan : 'free';
  if (plan === 'free') return 'free';
  if (profile.plan_until && profile.plan_until * 1000 < now) return 'free';
  return plan;
}

export function esPro(profile: Pick<AutoCopilotoProfile, 'plan' | 'plan_until'>, now = Date.now()): boolean {
  return planEfectivo(profile, now) !== 'free';
}

// ─── Encaje real ────────────────────────────────────────────────────────────

export type EncajeVeredicto = 'encaja' | 'parcial' | 'no_encaja';

export interface EncajeResult {
  /** 0-100, calculado aquí a partir del veredicto y los motivos. */
  score: number;
  veredicto: EncajeVeredicto;
  /** Una o dos frases para la persona: por qué sí o por qué no. */
  motivo: string;
  /** Requisitos que conviene comprobar antes de decidir. */
  requisitosClave: string[];
  /** true si viene del modelo; false si es el cálculo heurístico de respaldo. */
  llm: boolean;
}

export interface ConvocatoriaResumen {
  slug: string;
  title: string;
  organization: string;
  ccaa: string | null;
  geo_level: string | null;
  finalidades: string[];
  amount_eur: number | null;
  deadline: string | null;
  description?: string | null;
}

const UMBRAL_ENCAJE = 60;

export function umbralEncaje(): number {
  const raw = Number(getEnv('COPILOTO_PRO_UMBRAL'));
  return Number.isFinite(raw) && raw > 0 && raw <= 100 ? raw : UMBRAL_ENCAJE;
}

/** Score reproducible a partir de lo categórico que emite el modelo. */
export function scoreDesdeVeredicto(veredicto: EncajeVeredicto, motivos: number, avisos: number): number {
  const base = veredicto === 'encaja' ? 80 : veredicto === 'parcial' ? 55 : 20;
  const bonus = Math.min(15, Math.max(0, motivos) * 5);
  const malus = Math.min(25, Math.max(0, avisos) * 8);
  return Math.max(0, Math.min(100, base + bonus - malus));
}

/**
 * Parsea la respuesta JSON del modelo. Tolerante a prosa alrededor. Devuelve
 * null si no hay nada utilizable (el llamante cae al cálculo heurístico).
 */
export function parseEncaje(text: string): EncajeResult | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(m[0]);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const v = String(r.veredicto ?? '').toLowerCase().replace(/\s+/g, '_');
  const veredicto: EncajeVeredicto = v.startsWith('encaja') ? 'encaja' : v.startsWith('parcial') ? 'parcial' : v.startsWith('no') ? 'no_encaja' : 'parcial';
  const motivo = typeof r.motivo === 'string' ? r.motivo.trim().slice(0, 400) : '';
  const lista = (k: string) =>
    Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim().slice(0, 160)).slice(0, 5) : [];
  const motivos = lista('motivos_a_favor');
  const avisos = lista('avisos');
  const requisitosClave = lista('requisitos_clave');
  if (!motivo && motivos.length === 0 && avisos.length === 0) return null;
  return {
    score: scoreDesdeVeredicto(veredicto, motivos.length, avisos.length),
    veredicto,
    motivo: motivo || [...motivos, ...avisos].slice(0, 2).join(' '),
    requisitosClave,
    llm: true,
  };
}

/** Respaldo sin modelo: traduce el score por filtros (0-100) a un encaje explicado. */
export function encajeHeuristico(scoreFiltros: number, conv: ConvocatoriaResumen, profile: AutoCopilotoProfile): EncajeResult {
  const veredicto: EncajeVeredicto = scoreFiltros >= 45 ? 'encaja' : scoreFiltros > 0 ? 'parcial' : 'no_encaja';
  const partes: string[] = [];
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (profile.ccaa && conv.ccaa && norm(conv.ccaa).includes(norm(profile.ccaa))) partes.push(`Convocatoria de ${conv.ccaa}, tu territorio.`);
  else if (conv.geo_level === 'nacional' || !conv.geo_level) partes.push('Convocatoria de ámbito nacional.');
  if (conv.amount_eur) partes.push(`Importe máximo ${conv.amount_eur.toLocaleString('es-ES')} €.`);
  return {
    score: Math.max(0, Math.min(100, scoreFiltros)),
    veredicto,
    motivo: partes.join(' ') || 'Pasa los filtros de tu perfil (territorio, importe y palabras clave).',
    requisitosClave: [],
    llm: false,
  };
}

export function buildEncajePrompt(profile: AutoCopilotoProfile, conv: ConvocatoriaResumen): { system: string; user: string } {
  const system = [
    'Eres técnico de captación de fondos del tercer sector en España. Evalúas si una organización concreta debería',
    'presentarse a una convocatoria de subvención. No inventas requisitos que no aparezcan en los datos; si falta',
    'información, lo dices en "requisitos_clave". Respondes SOLO con un objeto JSON.',
  ].join(' ');
  const user = [
    `ORGANIZACIÓN: ${profile.org_nombre} (${profile.org_tipo}${profile.ccaa ? `, ${profile.ccaa}` : ''})`,
    `Qué hace: ${profile.org_descripcion}`,
    profile.anos_activos > 0 ? `Años activa: ${profile.anos_activos}` : '',
    profile.beneficiarios_anuales > 0 ? `Beneficiarios al año: ${profile.beneficiarios_anuales}` : '',
    profile.presupuesto_anual ? `Presupuesto anual: ${profile.presupuesto_anual}` : '',
    profile.proyectos_anteriores ? `Proyectos financiados antes: ${profile.proyectos_anteriores.slice(0, 600)}` : '',
    profile.keywords ? `Palabras clave de su actividad: ${profile.keywords}` : '',
    '',
    `CONVOCATORIA: ${conv.title}`,
    `Organismo: ${conv.organization}`,
    `Ámbito: ${conv.geo_level ?? 'sin dato'}${conv.ccaa ? ` · ${conv.ccaa}` : ''}`,
    conv.finalidades.length ? `Finalidades: ${conv.finalidades.join(', ')}` : '',
    conv.amount_eur ? `Importe máximo: ${conv.amount_eur.toLocaleString('es-ES')} €` : '',
    conv.deadline ? `Plazo: ${conv.deadline}` : '',
    conv.description ? `Descripción: ${conv.description.slice(0, 1500)}` : '',
    '',
    'Devuelve exactamente este JSON:',
    '{"veredicto":"encaja|parcial|no_encaja","motivo":"1-2 frases para la persona responsable","motivos_a_favor":["..."],"avisos":["..."],"requisitos_clave":["qué comprobar antes de presentarse"]}',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

export type LlmCall = (system: string, user: string) => Promise<string>;

async function llamarOpenRouter(system: string, user: string): Promise<string> {
  const key = getEnv('OPENROUTER_API_KEY');
  if (!key) throw new Error('no_openrouter_key');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://startidea.es',
        'X-Title': 'Startidea Copiloto Pro',
      },
      body: JSON.stringify({
        model: pickModel('clasificacion'),
        max_tokens: 500,
        temperature: 0.2,
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

/**
 * Encaje real de una convocatoria para un perfil. Nunca lanza: si el modelo
 * falla o no devuelve JSON, cae al encaje heurístico con `llm: false`.
 */
export async function encajeReal(
  profile: AutoCopilotoProfile,
  conv: ConvocatoriaResumen,
  scoreFiltros: number,
  llm: LlmCall = llamarOpenRouter,
): Promise<EncajeResult> {
  try {
    const { system, user } = buildEncajePrompt(profile, conv);
    const text = await llm(system, user);
    const parsed = parseEncaje(text);
    if (parsed) return parsed;
  } catch (err) {
    console.warn('[copiloto-pro] encaje LLM falló, uso heurístico:', err instanceof Error ? err.message : err);
  }
  return encajeHeuristico(scoreFiltros, conv, profile);
}
