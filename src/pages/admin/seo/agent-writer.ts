/**
 * POST /admin/seo/agent-writer — dispara el agente redactor.
 *   body: { keyword?: string, audience?: 'Tercer sector'|'Instituciones'|'Empresas con propósito'|'Todas', notes?: string, saveToFile?: boolean }
 *
 * GET /admin/seo/agent-writer — lista las últimas ejecuciones.
 */
import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/seo/auth';
import { runWriter } from '@/lib/seo-agents/writer';
import { listOutputs } from '@/lib/seo-agents/shared';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;
  const rows = listOutputs('writer', 30).map((r) => ({
    id: r.id,
    started_at: r.started_at,
    finished_at: r.finished_at,
    status: r.status,
    input_summary: r.input_summary,
    cost_usd: r.cost_usd,
    tokens_used: r.tokens_used,
    error_message: r.error_message,
  }));
  return new Response(JSON.stringify({ ok: true, runs: rows }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export const POST: APIRoute = async (ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const result = await runWriter({
      keyword: typeof body.keyword === 'string' ? body.keyword : undefined,
      audience: ['Tercer sector', 'Instituciones', 'Empresas con propósito', 'Todas'].includes(body.audience as string)
        ? (body.audience as 'Tercer sector' | 'Instituciones' | 'Empresas con propósito' | 'Todas')
        : 'Todas',
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      saveToFile: body.saveToFile !== false,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        runId: result.runId,
        slug: result.outputJson.draft.slug,
        title: result.outputJson.draft.title,
        words: result.outputJson.draft.estimatedWordCount,
        filePath: result.outputJson.filePath,
        costUsd: Number(result.costUsd.toFixed(4)),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
};
