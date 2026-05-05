/**
 * Agente A — Analista SEO semanal.
 *
 * Lee las oportunidades detectadas por SeoOpportunityService y le pide al LLM
 * que las priorice y traduzca a un plan accionable de la semana.
 *
 * Output:
 *   - Markdown con el plan: top 5 acciones priorizadas, qué cambia esta semana,
 *     KPIs a mover, y notificación a Telegram.
 *   - JSON estructurado con las acciones (para usar luego en /admin/seo).
 *
 * Si no hay datos GSC/GA4 todavía (porque el OAuth no está conectado o
 * el sync nunca corrió), genera un plan de bootstrap basado en el contenido
 * actual de la web y best practices.
 */

import { getDb } from '@/lib/seo/db';
import { chat, notifyTelegram, escapeHtml, startRun, finishRun, failRun, type ChatResult } from './shared';

const SITE = 'https://startidea.es';

interface OpportunityRow {
  id: number;
  kind: string;
  priority: number;
  url: string | null;
  keyword: string | null;
  metric_summary: string;
  recommendation: string;
  detected_at: number;
}

export interface AnalystResult {
  runId: number;
  outputMd: string;
  outputJson: AnalystPlan;
  costUsd: number;
}

export interface AnalystPlan {
  generatedAt: string;
  context: 'with_data' | 'bootstrap';
  topActions: Array<{
    priority: number;
    title: string;
    why: string;
    how: string;
    expectedImpact: string;
    relatedUrl?: string;
    relatedKeyword?: string;
  }>;
  weeklyFocus: string;
  kpisToWatch: string[];
}

function loadTopOpportunities(limit = 30): OpportunityRow[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, kind, priority, url, keyword, metric_summary, recommendation, detected_at
      FROM seo_opportunities
     WHERE resolved_at IS NULL
       AND detected_at > strftime('%s','now') - 30 * 86400
     ORDER BY priority ASC, detected_at DESC
     LIMIT ?
  `);
  return stmt.all(limit) as OpportunityRow[];
}

function summarizeOpportunities(rows: OpportunityRow[]): string {
  return rows
    .map((r, i) => {
      let metrics = '';
      try {
        const m = JSON.parse(r.metric_summary);
        metrics = Object.entries(m)
          .slice(0, 5)
          .map(([k, v]) => `${k}=${typeof v === 'number' ? Number(v).toFixed(2) : v}`)
          .join(' · ');
      } catch {
        metrics = r.metric_summary.slice(0, 100);
      }
      const target = r.url ? `URL ${r.url}` : r.keyword ? `KW "${r.keyword}"` : '—';
      return `${i + 1}. [P${r.priority}] ${r.kind} — ${target}\n   ${metrics}\n   → ${r.recommendation}`;
    })
    .join('\n');
}

const SYSTEM_PROMPT = `Eres un consultor SEO senior especializado en agencias del tercer sector.
Hablas en español neutro (ni "nosotras" ni "nosotros" — usa "Startidea" o reformula).
Eres directo, práctico, sin jerga vacía. Priorizas acciones de alto impacto/bajo esfuerzo.
Tu output debe ser accionable esta semana, no un análisis abstracto.
Conoces Astro, Next.js, content collections, structured data y Google Search Console.

Cuando recomiendes acciones técnicas:
- Sé concreto sobre el archivo, función o cambio (ej. "modificar src/content/notas/agencias-pequeñas.md añadiendo H2 'Cómo elegir agencia'")
- Estima esfuerzo en horas
- Predice el impacto en clicks/impresiones cuando puedas

Si NO hay datos de Search Console (modo bootstrap), recomienda acciones de fundación SEO técnico y editorial sin inventarte métricas.`;

const USER_PROMPT_WITH_DATA = (oppsSummary: string, totalOpps: number) => `Estas son las top ${totalOpps} oportunidades SEO activas para startidea.es (extraídas hoy del analyzer):

${oppsSummary}

Devuelve EXACTAMENTE este JSON (sin markdown wrapper, sin explicación previa, solo el JSON):

{
  "topActions": [
    { "priority": 1, "title": "...", "why": "...", "how": "...", "expectedImpact": "...", "relatedUrl": "...", "relatedKeyword": "..." },
    ... (5 acciones máximo)
  ],
  "weeklyFocus": "Una frase con el foco de la semana",
  "kpisToWatch": ["KPI 1", "KPI 2", "KPI 3"]
}`;

const USER_PROMPT_BOOTSTRAP = `Aún no hay datos de Google Search Console en la BD (el OAuth no está conectado todavía o el sync no ha corrido).

Sitio: startidea.es — agencia de innovación social en Granada (Mario Pablo Sánchez Barrón, fundada feb 2011). 3 audiencias: tercer sector, instituciones, empresas con propósito. Stack Astro 5 + SSR Node, ya tiene sitemap, JSON-LD Organization+WebSite, OG dinámicas, PWA, fonts self-hosted, /api/health, /changelog, /asistente, /prensa.

Hay 3 notas publicadas hasta ahora.

Devuelve EXACTAMENTE este JSON (sin markdown wrapper, sin explicación previa, solo el JSON) con un plan de fundación SEO de esta semana:

{
  "topActions": [
    { "priority": 1, "title": "...", "why": "...", "how": "...", "expectedImpact": "..." },
    ... (5 acciones máximo, sin inventar métricas que no tienes)
  ],
  "weeklyFocus": "Una frase con el foco de la semana",
  "kpisToWatch": ["KPI 1", "KPI 2", "KPI 3"]
}`;

function safeParseJson(text: string): unknown {
  // Quita posibles ```json wrappers y texto antes/después
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No se encontró JSON en la respuesta del LLM');
  return JSON.parse(m[0]);
}

function renderMarkdown(plan: AnalystPlan): string {
  const lines: string[] = [];
  lines.push(`# Plan SEO semanal — ${plan.generatedAt}`);
  lines.push('');
  lines.push(`**Modo:** ${plan.context === 'with_data' ? 'Con datos GSC' : 'Bootstrap (sin GSC todavía)'}`);
  lines.push('');
  lines.push(`**Foco de la semana:** ${plan.weeklyFocus}`);
  lines.push('');
  lines.push('## Top acciones priorizadas');
  for (const a of plan.topActions) {
    lines.push('');
    lines.push(`### P${a.priority} — ${a.title}`);
    lines.push(`**Por qué:** ${a.why}`);
    lines.push(`**Cómo:** ${a.how}`);
    lines.push(`**Impacto esperado:** ${a.expectedImpact}`);
    if (a.relatedUrl) lines.push(`**URL:** ${a.relatedUrl}`);
    if (a.relatedKeyword) lines.push(`**Keyword:** ${a.relatedKeyword}`);
  }
  lines.push('');
  lines.push('## KPIs a vigilar');
  for (const k of plan.kpisToWatch) lines.push(`- ${k}`);
  return lines.join('\n');
}

function renderTelegram(plan: AnalystPlan, runId: number): string {
  const top = plan.topActions
    .slice(0, 3)
    .map((a, i) => `${i + 1}. <b>P${a.priority}</b>: ${escapeHtml(a.title)}`)
    .join('\n');
  return [
    `📈 <b>Plan SEO semanal — startidea.es</b>`,
    '',
    `<b>Foco:</b> ${escapeHtml(plan.weeklyFocus)}`,
    '',
    `<b>Top 3:</b>`,
    top,
    '',
    `Ver plan completo: ${SITE}/admin/seo/agente/${runId}`,
  ].join('\n');
}

export async function runAnalyst(opts?: { notifyTelegram?: boolean }): Promise<AnalystResult> {
  const opps = loadTopOpportunities(30);
  const context = opps.length === 0 ? 'bootstrap' : 'with_data';
  const inputSummary =
    context === 'with_data'
      ? `${opps.length} oportunidades activas (top: ${opps.slice(0, 3).map((o) => o.kind).join(', ')})`
      : 'Bootstrap mode (sin datos GSC todavía)';

  const run = startRun('analyst', inputSummary);

  try {
    const userPrompt =
      context === 'with_data'
        ? USER_PROMPT_WITH_DATA(summarizeOpportunities(opps), opps.length)
        : USER_PROMPT_BOOTSTRAP;

    const result: ChatResult = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 2500, temperature: 0.2 },
    );

    const parsed = safeParseJson(result.text) as Omit<AnalystPlan, 'generatedAt' | 'context'>;
    const plan: AnalystPlan = {
      generatedAt: new Date().toISOString().slice(0, 10),
      context,
      topActions: parsed.topActions ?? [],
      weeklyFocus: parsed.weeklyFocus ?? '',
      kpisToWatch: parsed.kpisToWatch ?? [],
    };

    const outputMd = renderMarkdown(plan);
    finishRun(run.id, {
      outputMd,
      outputJson: plan,
      tokensUsed: result.inputTokens + result.outputTokens,
      costUsd: result.costUsd,
    });

    if (opts?.notifyTelegram !== false) {
      await notifyTelegram(renderTelegram(plan, run.id));
    }

    return { runId: run.id, outputMd, outputJson: plan, costUsd: result.costUsd };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    failRun(run.id, msg);
    throw err;
  }
}
