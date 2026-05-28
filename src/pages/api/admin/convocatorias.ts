/**
 * /api/admin/convocatorias
 *
 * Admin CRUD para la tabla de convocatorias.
 * Auth: x-admin-token header.
 *
 * POST   → upsert (crear o actualizar)
 * PATCH  → toggle activa/inactiva
 * GET    → listar todas (incluyendo inactivas)
 */
import type { APIRoute } from 'astro';
import { isValidAdminHeader } from '@/lib/admin-session';
import { upsertConvocatoria, toggleConvocatoriaActiva, listConvocatoriasAll } from '@/lib/expedientes-db';

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

/** Convierte texto multilínea en array de strings (filtra vacíos). */
function lines(s: string): string[] {
  return s.split('\n').map((l) => l.trim()).filter(Boolean);
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return json({ ok: false, error: 'unauthorized' }, 401);
  try {
    const convs = listConvocatoriasAll();
    return json({ ok: true, data: convs });
  } catch (err) {
    console.error('[api/admin/convocatorias] GET:', err);
    return json({ ok: false, error: 'internal' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!auth(request)) return json({ ok: false, error: 'unauthorized' }, 401);
  let body: Record<string, string>;
  try { body = await request.json() as Record<string, string>; }
  catch { return json({ ok: false, error: 'bad_json' }, 400); }

  const slug = body.slug?.trim();
  if (!slug) return json({ ok: false, error: 'slug_required' }, 400);
  if (!body.titulo?.trim()) return json({ ok: false, error: 'titulo_required' }, 400);

  try {
    upsertConvocatoria({
      slug,
      codigo:             body.codigo?.trim()             ?? '',
      titulo:             body.titulo.trim(),
      titulo_full:        body.titulo_full?.trim()        ?? body.titulo.trim(),
      organo:             body.organo?.trim()             ?? '',
      tipo_beneficiario:  body.tipo_beneficiario?.trim()  ?? 'privada',
      beneficiario_label: body.beneficiario_label?.trim() ?? '',
      deadline:           body.deadline?.trim()           ?? '',
      deadline_short:     body.deadline_short?.trim()     ?? '',
      deadline_note:      body.deadline_note?.trim()      || null,
      deadline_iso:       body.deadline_iso?.trim()       || null,
      importe_min:        body.importe_min ? Number(body.importe_min) : null,
      importe_max:        body.importe_max ? Number(body.importe_max) : null,
      importe_range:      body.importe_range?.trim()      ?? '',
      importe_detalle:    body.importe_detalle?.trim()    ?? '',
      tipo_entidades:     body.tipo_entidades?.trim()     ?? '',
      financia_resumen:   lines(body.financia_resumen ?? ''),
      gastos_ok:          lines(body.gastos_ok ?? ''),
      gastos_no:          lines(body.gastos_no ?? ''),
      requisitos:         lines(body.requisitos ?? ''),
      nota:               body.nota?.trim()               || null,
      url_boja:           body.url_boja?.trim()           || null,
      url_bases:          body.url_bases?.trim()          || null,
      url_sede:           body.url_sede?.trim()           || null,
      fuente:             body.fuente?.trim()             ?? 'manual',
      fuente_id:          body.fuente_id?.trim()          || null,
      activa:             body.activa === '0' ? 0 : 1,
      destacada:          body.destacada === '1' ? 1 : 0,
    });
    return json({ ok: true, slug });
  } catch (err) {
    console.error('[api/admin/convocatorias] POST:', err);
    return json({ ok: false, error: 'internal', detail: String(err) }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  if (!auth(request)) return json({ ok: false, error: 'unauthorized' }, 401);
  let body: { slug?: string };
  try { body = await request.json() as { slug?: string }; }
  catch { return json({ ok: false, error: 'bad_json' }, 400); }

  const slug = body.slug?.trim();
  if (!slug) return json({ ok: false, error: 'slug_required' }, 400);

  try {
    const activa = toggleConvocatoriaActiva(slug);

    // Cuando se activa una convocatoria, notificar perfiles del Copiloto Autónomo
    // que encajen. Fire-and-forget — no bloqueamos la respuesta.
    if (activa) {
      const origin = new URL(request.url).origin;
      const adminToken = request.headers.get('x-admin-token') ?? '';
      fetch(`${origin}/api/auto-copiloto/match-catalog`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ slug }),
      }).catch((e) =>
        console.error('[convocatorias PATCH] match-catalog notify error:', e),
      );
      console.log(`[convocatorias PATCH] Activada ${slug} → match-catalog disparado (async)`);
    }

    return json({ ok: true, slug, activa });
  } catch (err) {
    return json({ ok: false, error: 'internal', detail: String(err) }, 500);
  }
};
