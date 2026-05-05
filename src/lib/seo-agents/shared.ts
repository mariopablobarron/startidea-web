/**
 * Helpers compartidos por los agentes SEO IA (analista + redactor).
 *
 * - Llamada a OpenRouter con el modelo configurado
 * - Persistencia de output en seo_agent_outputs
 * - Notificación a Telegram (opcional)
 * - Cálculo orientativo de coste
 */

import { getDb } from '@/lib/seo/db';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SITE_BASE_URL = process.env.PUBLIC_SITE_URL || 'https://startidea.es';

// Coste por 1M tokens (orientativo, ajustable según modelo)
const COST_PER_1M_INPUT_USD: Record<string, number> = {
  'anthropic/claude-haiku-4.5': 1.0,
  'anthropic/claude-sonnet-4.5': 3.0,
};
const COST_PER_1M_OUTPUT_USD: Record<string, number> = {
  'anthropic/claude-haiku-4.5': 5.0,
  'anthropic/claude-sonnet-4.5': 15.0,
};

export type AgentKind = 'analyst' | 'writer';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function chat(messages: ChatMessage[], opts?: { maxTokens?: number; temperature?: number }): Promise<ChatResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY no configurada — el agente no puede llamar al LLM');
  }
  const r = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': SITE_BASE_URL,
      'X-Title': 'Startidea SEO Agent',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: opts?.maxTokens ?? 2000,
      temperature: opts?.temperature ?? 0.3,
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`OpenRouter ${r.status}: ${body.slice(0, 300)}`);
  }
  const j = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = j.choices?.[0]?.message?.content ?? '';
  const inputTokens = j.usage?.prompt_tokens ?? 0;
  const outputTokens = j.usage?.completion_tokens ?? 0;
  const inCost = (inputTokens / 1_000_000) * (COST_PER_1M_INPUT_USD[OPENROUTER_MODEL] ?? 1);
  const outCost = (outputTokens / 1_000_000) * (COST_PER_1M_OUTPUT_USD[OPENROUTER_MODEL] ?? 5);
  return { text, inputTokens, outputTokens, costUsd: inCost + outCost };
}

export async function notifyTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[seo-agents] Telegram no configurado, skip notificación');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text.slice(0, 4000), // Telegram caps en 4096
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error('[seo-agents] Telegram fail', (err as Error).message);
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

export interface RunRecord {
  id: number;
  started_at: number;
}

export function startRun(kind: AgentKind, inputSummary: string): RunRecord {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO seo_agent_outputs (kind, status, input_summary)
    VALUES (?, 'running', ?)
  `);
  const r = stmt.run(kind, inputSummary);
  return { id: Number(r.lastInsertRowid), started_at: Math.floor(Date.now() / 1000) };
}

export function finishRun(
  id: number,
  outcome: { outputMd: string; outputJson?: unknown; tokensUsed?: number; costUsd?: number },
): void {
  const db = getDb();
  db.prepare(`
    UPDATE seo_agent_outputs
       SET status = 'success',
           finished_at = strftime('%s','now'),
           output_md = ?,
           output_json = ?,
           tokens_used = ?,
           cost_usd = ?
     WHERE id = ?
  `).run(
    outcome.outputMd,
    outcome.outputJson ? JSON.stringify(outcome.outputJson) : null,
    outcome.tokensUsed ?? null,
    outcome.costUsd ?? null,
    id,
  );
}

export function failRun(id: number, message: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE seo_agent_outputs
       SET status = 'failed', finished_at = strftime('%s','now'), error_message = ?
     WHERE id = ?
  `).run(message.slice(0, 1000), id);
}

export interface AgentOutputRow {
  id: number;
  kind: AgentKind;
  started_at: number;
  finished_at: number | null;
  status: 'running' | 'success' | 'failed';
  input_summary: string | null;
  output_md: string | null;
  output_json: string | null;
  tokens_used: number | null;
  cost_usd: number | null;
  error_message: string | null;
}

export function listOutputs(kind?: AgentKind, limit = 20): AgentOutputRow[] {
  const db = getDb();
  const sql = kind
    ? `SELECT * FROM seo_agent_outputs WHERE kind = ? ORDER BY started_at DESC LIMIT ?`
    : `SELECT * FROM seo_agent_outputs ORDER BY started_at DESC LIMIT ?`;
  const stmt = db.prepare(sql);
  return (kind ? stmt.all(kind, limit) : stmt.all(limit)) as AgentOutputRow[];
}

export function getOutput(id: number): AgentOutputRow | null {
  const db = getDb();
  const r = getDb().prepare(`SELECT * FROM seo_agent_outputs WHERE id = ?`).get(id);
  return (r as AgentOutputRow) ?? null;
}
