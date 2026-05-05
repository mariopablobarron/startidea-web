/**
 * POST /admin/seo/agent-analyst — dispara el agente analista SEO.
 * GET  /admin/seo/agent-analyst — lista las últimas ejecuciones.
 */
import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/seo/auth';
import { runAnalyst } from '@/lib/seo-agents/analyst';
import { listOutputs } from '@/lib/seo-agents/shared';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;
  const rows = listOutputs('analyst', 30).map((r) => ({
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

  const body = await ctx.request.json().catch(() => ({}) as Record<string, unknown>);
  const notify = body?.notifyTelegram !== false;

  try {
    const result = await runAnalyst({ notifyTelegram: notify });
    return new Response(
      JSON.stringify({
        ok: true,
        runId: result.runId,
        weeklyFocus: result.outputJson.weeklyFocus,
        topActionsCount: result.outputJson.topActions.length,
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
