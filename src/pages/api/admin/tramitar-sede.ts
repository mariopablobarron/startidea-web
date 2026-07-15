/**
 * /api/admin/tramitar-sede
 *
 * Cablea el panel admin con el container Playwright SEPARADO (copiloto-sede).
 * Dado un expediente, detecta su sede y le pide al container que prepare la
 * tramitación ASISTIDA (rellena todo hasta la firma; el cliente firma con su
 * certificado/Cl@ve).
 *
 * POST { id }  →  { ok, status, sedeUrl, prefill, checklist, ... }
 * Auth: x-admin-token.
 *
 * Requiere COPILOTO_SEDE_URL (URL interna del container) + COPILOTO_SEDE_SECRET.
 * Si el container no está desplegado todavía, devuelve un error claro (no rompe).
 */
import type { APIRoute } from 'astro';
import { isValidAdminHeader, isAdminLoggedIn } from '@/lib/admin-session';
import { getExpediente } from '@/lib/expedientes-db';
import { detectSede } from '@/lib/sedes-map';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminLoggedIn(cookies) && !isValidAdminHeader(request.headers.get('x-admin-token') ?? '')) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let id = '';
  // Política de negocio + legal: SOLO tramitación asistida. El Copiloto nunca
  // firma ni presenta por el cliente. Se bloquea aquí (capa web) además del
  // driver, porque el driver mock no aplica esta restricción.
  const modo: 'asistido' = 'asistido';
  try {
    const body = (await request.json()) as { id?: string; modo?: string };
    id = (body.id ?? '').trim();
    if (body.modo === 'autonomo') {
      return json({
        ok: false,
        error: 'modo_no_permitido',
        detail: 'Solo tramitación asistida. El Copiloto nunca firma ni presenta por el cliente.',
      }, 422);
    }
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  if (!id) return json({ ok: false, error: 'id_required' }, 400);

  const exp = getExpediente(id);
  if (!exp) return json({ ok: false, error: 'expediente_no_encontrado' }, 404);

  const sede = detectSede({
    convocatoriaUrl: exp.convocatoria_url,
    convocatoriaTitle: exp.convocatoria_title,
  });
  if (!sede) {
    return json({ ok: false, error: 'sede_no_detectada', detail: 'No se pudo detectar la sede de este expediente.' }, 422);
  }
  if (!sede.key) {
    return json({
      ok: false,
      error: 'sin_driver',
      detail: `La sede "${sede.nombre}" aún no tiene driver de tramitación asistida. Disponible: Junta de Andalucía.`,
    }, 422);
  }

  const base = process.env.COPILOTO_SEDE_URL;
  const secret = process.env.COPILOTO_SEDE_SECRET;
  if (!base || !secret) {
    return json({
      ok: false,
      error: 'no_configurado',
      detail: 'Falta COPILOTO_SEDE_URL / COPILOTO_SEDE_SECRET. El container copiloto-sede no está desplegado todavía.',
    }, 503);
  }

  // Opción de firma según lo elegido por la entidad en el alta del expediente:
  //   apoderamiento=1 → Startidea firma como representante (certificado nuestro)
  //   apoderamiento=0 → firma la entidad con SU certificado
  const signMode = exp.apoderamiento === 1 ? 'apoderado' : 'entidad';

  // Payload para el container: datos del expediente + sede + adjuntos.
  const payload = {
    expedienteId: exp.id,
    sede: sede.key,
    mode: modo, // 'asistido' (handoff de firma) | 'autonomo' (el agente firma)
    signMode,   // 'entidad' | 'apoderado' (solo aplica en modo autonomo)
    formData: {
      org_nombre: exp.org_nombre,
      org_cif: exp.org_cif,
      representante: exp.representante,
      email: exp.email,
      telefono: exp.telefono,
      provincia: exp.provincia,
      descripcion_proyecto: exp.descripcion_proyecto,
      importe_solicitado: exp.importe_solicitado,
    },
    files: (() => {
      try { return JSON.parse(exp.docs_adjuntos ?? '[]'); } catch { return []; }
    })(),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    const res = await fetch(`${base.replace(/\/$/, '')}/tramitar`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-copiloto-secret': secret },
      body: JSON.stringify(payload),
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    return json({ ok: res.ok, sede: sede.nombre, ...data }, res.ok ? 200 : 502);
  } catch (e) {
    return json({
      ok: false,
      error: 'container_inaccesible',
      detail: `No se pudo contactar con copiloto-sede en ${base}: ${e instanceof Error ? e.message : String(e)}`,
    }, 502);
  }
};
