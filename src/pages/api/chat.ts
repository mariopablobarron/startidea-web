import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

export const prerender = false;

const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const MAX_OUTPUT_TOKENS = parseInt(process.env.OPENROUTER_MAX_TOKENS || '600', 10);
const SITE_URL = 'https://startidea.es';

// ─── Rate limit por IP (en memoria del proceso) ─────────────────────────
type Ip = string;
const ipBuckets = new Map<Ip, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipBuckets.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  ipBuckets.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

// ─── Carga de la knowledge base (una vez por proceso) ───────────────────
let knowledgeCache: string | null = null;
function loadKnowledge(): string {
  if (knowledgeCache !== null) return knowledgeCache;
  const dir = path.resolve(process.cwd(), 'src/content/knowledge');
  let combined = '';
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
    for (const f of files) {
      const body = fs.readFileSync(path.join(dir, f), 'utf-8');
      combined += `\n\n---\n# Fuente: ${f}\n\n${body}`;
    }
  } catch (err) {
    console.error('[chat] no se pudo leer knowledge base', err);
    combined = '';
  }
  knowledgeCache = combined;
  return combined;
}

function buildSystemPrompt(): string {
  const kb = loadKnowledge();
  return `Eres el asistente conversacional de Startidea. Responde en español neutro, en 2-4 frases máximo. Reglas y conocimiento:\n${kb}\n\nRecuerda: nunca uses 'nosotras' ni 'nosotros'. Habla en tercera persona ('Startidea recomienda…') o reformula. Mantén respuestas breves.`;
}

// ─── Validación de input ────────────────────────────────────────────────
function clean(s: unknown, max = 4000): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

type Msg = { role: 'user' | 'assistant'; content: string };

function sanitizeHistory(raw: unknown): Msg[] {
  if (!Array.isArray(raw)) return [];
  const out: Msg[] = [];
  for (const m of raw.slice(-12)) {
    if (typeof m !== 'object' || m === null) continue;
    const role = (m as any).role;
    const content = clean((m as any).content, 4000);
    if ((role === 'user' || role === 'assistant') && content) {
      out.push({ role, content });
    }
  }
  return out;
}

// ─── Notificación a Telegram cuando hay leads/intentos relevantes ───────
async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
  } catch (err) {
    console.error('[chat] telegram notify failed', err);
  }
}

// ─── Endpoint POST ──────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'no_api_key', message: 'El chat IA no está configurado todavía. Escribe a hola@startidea.es y te respondemos en horas.' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const ip = clientAddress || 'unknown';
  if (rateLimited(ip)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'rate', message: 'Has enviado muchos mensajes seguidos. Espera un momento.' }),
      { status: 429, headers: { 'content-type': 'application/json' } },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'json' }), { status: 400 });
  }

  const history = sanitizeHistory(body?.messages);
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return new Response(JSON.stringify({ ok: false, error: 'empty' }), { status: 400 });
  }

  const lastUser = history[history.length - 1].content;
  const meta = clean(body?.meta, 200);

  const messages = [
    { role: 'system' as const, content: buildSystemPrompt() },
    ...history,
  ];

  // Llamada a OpenRouter con streaming SSE — proxy directo al cliente
  let upstream: Response;
  try {
    upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': SITE_URL,
        'X-Title': 'Startidea Chat',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.4,
      }),
    });
  } catch (err) {
    console.error('[chat] upstream fetch failed', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'network', message: 'Sin conexión con el modelo. Intenta de nuevo.' }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    console.error('[chat] upstream error', upstream.status, errText.slice(0, 500));
    return new Response(
      JSON.stringify({ ok: false, error: 'upstream', status: upstream.status, message: 'El modelo no respondió. Intenta de nuevo en un minuto.' }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }

  // Notificación silenciosa a Telegram para que veas conversaciones que llegan
  notifyTelegram(`💬 Chat web · ${meta || ip}\n\n→ ${lastUser.slice(0, 240)}`);

  // Reenvío del SSE tal cual al cliente
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
};
