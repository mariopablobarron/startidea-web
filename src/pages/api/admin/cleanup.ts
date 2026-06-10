/**
 * /api/admin/cleanup
 *
 * Housekeeping de la BD. Diseñado para ejecución periódica vía cron VPS.
 *
 *   GET  ?dryRun=1   → previa: cuántos perfiles serían eliminados
 *   POST             → ejecuta el cleanup real
 *
 * Auth: x-admin-token header.
 *
 * Actualmente cubre:
 *  - Perfiles del Copiloto Autónomo no confirmados >30 días
 *
 * Pensado para crecer (futuro: logs antiguos, expedientes rechazados >12m,
 * portal_magic_tokens expirados, etc.).
 */
import type { APIRoute } from 'astro';
import { isValidAdminHeader } from '@/lib/admin-session';
import {
  cleanupUnconfirmedProfiles,
  previewCleanupUnconfirmed,
} from '@/lib/auto-copiloto-db';
import { cleanupExpiredPortalTokens } from '@/lib/expedientes-db';

export const prerender = false;

function auth(request: Request): boolean {
  return isValidAdminHeader(request.headers.get('x-admin-token') ?? '');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!auth(request)) return json({ ok: false, error: 'unauthorized' }, 401);

  const days = Math.max(7, Number(url.searchParams.get('days') ?? 30));

  try {
    const preview = previewCleanupUnconfirmed(days);
    return json({
      ok: true,
      preview: {
        unconfirmed_profiles: {
          count: preview.count,
          older_than_days: days,
          oldest_at: preview.oldest_ts ? new Date(preview.oldest_ts * 1000).toISOString() : null,
        },
      },
    });
  } catch (err) {
    return json({ ok: false, error: 'internal', detail: String(err) }, 500);
  }
};

export const POST: APIRoute = async ({ request, url }) => {
  if (!auth(request)) return json({ ok: false, error: 'unauthorized' }, 401);

  const days = Math.max(7, Number(url.searchParams.get('days') ?? 30));

  try {
    const profilesDeleted = cleanupUnconfirmedProfiles(days);
    const tokens = cleanupExpiredPortalTokens();
    return json({
      ok: true,
      deleted: {
        unconfirmed_profiles: profilesDeleted,
        expired_magic_tokens: tokens.magic_tokens,
        expired_sessions:     tokens.sessions,
        older_than_days:      days,
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return json({ ok: false, error: 'internal', detail: String(err) }, 500);
  }
};
