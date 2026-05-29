import type { APIRoute } from 'astro';
import { sendTelegram } from '@/lib/telegram';
import { getCollection } from 'astro:content';

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

// ─── Carga de la knowledge base (Content Collection, cache por proceso) ─
let knowledgeCache: string | null = null;
async function loadKnowledge(): Promise<string> {
  if (knowledgeCache !== null) return knowledgeCache;
  try {
    const entries = await getCollection('knowledge');
    entries.sort((a, b) => a.id.localeCompare(b.id));
    const combined = entries
      .map((e) => `\n\n---\n# Fuente: ${e.id}\n\n${e.body}`)
      .join('');
    knowledgeCache = combined;
    return combined;
  } catch (err) {
    console.error('[chat] no se pudo leer knowledge base', err);
    knowledgeCache = '';
    return '';
  }
}

async function buildSystemPrompt(): Promise<string> {
  const kb = await loadKnowledge();
  return `Eres el asistente conversacional de Startidea (startidea.es). Responde en español neutro, en 2-4 frases máximo, breve y útil. Usa SOLO la información de la knowledge base que sigue. Si te preguntan algo que no está en ella, di que necesitas pasar al equipo humano y deriva a /contacto o hola@startidea.es. Nunca inventes precios, casos ni datos.\n\nRecuerda: NUNCA uses 'nosotras' ni 'nosotros'. Habla siempre de Startidea en tercera persona ('Startidea recomienda…', 'el equipo te dice honestamente…') o reformula. Mantén respuestas breves.\n\n=== KNOWLEDGE BASE ===\n${kb}\n=== FIN KNOWLEDGE BASE ===`;
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

  const systemPrompt = await buildSystemPrompt();
  const messages = [
    { role: 'system' as const, content: systemPrompt },
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
  void sendTelegram(`💬 Chat web · ${meta || ip}\n\n→ ${lastUser.slice(0, 240)}`, { parseMode: null });

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
