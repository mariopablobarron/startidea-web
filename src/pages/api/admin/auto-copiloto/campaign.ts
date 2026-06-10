/**
 * POST /api/admin/auto-copiloto/campaign
 *
 * Lanza una campaña manual del Copiloto Autónomo para una convocatoria específica,
 * sin la restricción de las 26h del trigger automático diario.
 *
 * Útil para:
 *   - Convocatorias publicadas antes del cron (ej. BOJA publicado ayer)
 *   - Convocatorias externas no indexadas en el HUB (ej. BOJA Junta de Andalucía)
 *   - Reenvíos o campañas específicas a segmentos de perfiles
 *
 * Modos:
 *   dryRun=true  → solo devuelve los perfiles que recibirían el email (sin enviar)
 *   dryRun=false → genera docs + envía emails (igual que el trigger automático)
 *
 * Body:
 * {
 *   convocatoria: {
 *     slug: string;           // clave única para deduplicación + HUB lookup
 *     title: string;
 *     url?: string;
 *     deadline?: string;      // ISO "YYYY-MM-DD"
 *     finalidades?: string[]; // para scoring
 *     amount_eur?: number;
 *     ccaa?: string;          // null = nacional
 *     geo_level?: string;
 *   };
 *   dryRun?: boolean;         // default true
 *   skipAlreadyProcessed?: boolean; // default true — omite perfiles que ya procesaron esta conv
 *   targetCcaa?: string;      // filtro adicional de CCAA (ej: "andalucia")
 *   targetOrgTipos?: string[]; // filtro adicional de tipo (ej: ["asociacion","fundacion"])
 * }
 *
 * Auth: x-admin-token (igual que el resto de admin APIs)
 */

import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { isValidAdminHeader } from '@/lib/admin-session';
import {
  getActiveProfiles,
  isAlreadyProcessed,
  logGeneration,
  markLastRun,
  type AutoCopilotoProfile,
} from '@/lib/auto-copiloto-db';
import {
  insertExpediente,
  saveAiOutput,
  updateStatus,
} from '@/lib/expedientes-db';
import { buildConvContext, runAiGeneration } from '@/lib/copiloto-engine';
import { sendEmail } from '@/lib/email-resend';
import { detectSede } from '@/lib/sedes-map';

export const prerender = false;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CampaignConvocatoria {
  slug: string;
  title: string;
  url?: string | null;
  deadline?: string | null;
  finalidades?: string[];
  amount_eur?: number | null;
  ccaa?: string | null;
  geo_level?: string | null;
}

interface CampaignBody {
  convocatoria: CampaignConvocatoria;
  dryRun?: boolean;
  skipAlreadyProcessed?: boolean;
  targetCcaa?: string;
  targetOrgTipos?: string[];
}

// ── Scoring (mismo algoritmo que en trigger.ts) ───────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function convScoreForProfile(
  conv: CampaignConvocatoria,
  profile: AutoCopilotoProfile,
): number {
  let score = 0;

  // Filtros duros
  const territorios: string[] = JSON.parse(profile.territorios || '["nacional"]');
  if (territorios.length > 0 && !territorios.includes('nacional')) {
    const convCcaa  = normalize(conv.ccaa ?? '');
    const convGeo   = normalize(conv.geo_level ?? '');
    const matchTerr = territorios.some(
      (t) => convCcaa.includes(normalize(t)) || normalize(t) === convGeo,
    );
    if (!matchTerr) return 0;
  }

  if (profile.importe_min > 0 && conv.amount_eur != null && conv.amount_eur < profile.importe_min) return 0;
  if (profile.importe_max   && conv.amount_eur != null && conv.amount_eur > profile.importe_max) return 0;

  const finalidades: string[] = JSON.parse(profile.finalidades || '[]');
  if (finalidades.length > 0 && (conv.finalidades ?? []).length > 0) {
    if (!finalidades.some((f) => (conv.finalidades ?? []).includes(f))) return 0;
  }

  if (profile.keywords) {
    const kws = profile.keywords.split(',').map((k) => normalize(k.trim())).filter(Boolean);
    if (kws.length > 0) {
      const haystack = normalize(conv.title);
      if (!kws.some((k) => haystack.includes(k))) return 0;
    }
  }

  // Scoring positivo
  score += 10; // base: pasó filtros
  if (profile.ccaa && conv.ccaa && normalize(conv.ccaa).includes(normalize(profile.ccaa))) score += 20;
  if (!conv.ccaa || conv.geo_level === 'nacional') score += 10;
  if (profile.keywords) {
    const kws = profile.keywords.split(',').map((k) => normalize(k.trim())).filter(Boolean);
    for (const k of kws) { if (normalize(conv.title).includes(k)) score += 15; }
  }
  if (finalidades.length > 0 && (conv.finalidades ?? []).some((f) => finalidades.includes(f))) score += 15;
  if (conv.amount_eur != null) {
    const min = profile.importe_min || 0;
    const max = profile.importe_max || Infinity;
    if (conv.amount_eur >= min && conv.amount_eur <= max) score += 10;
  }

  return Math.min(score, 100);
}

// ── Email helper ──────────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function mdToHtml(md: string): string {
  return md
    .replace(/^#{1,3} (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:16px 0 6px">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/gs, '<ul style="padding-left:20px;margin:8px 0">$&</ul>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0">')
    .replace(/^(?!<[hul])(.+)$/gm, '<p style="margin:6px 0">$1</p>');
}

async function sendCampaignEmail(opts: {
  to: string;
  org_nombre: string;
  representante: string;
  convocatoria_title: string;
  convocatoria_url: string | null;
  convocatoria_deadline: string | null;
  expediente_id: string;
  ai_memoria: string;
  ai_presupuesto: string;
  ai_checklist: string;
  ai_guia: string;
  manage_token: string;
}): Promise<boolean> {
  const primerNombre = opts.representante.split(' ')[0];
  const manageUrl = `https://startidea.es/subvenciones/mi-copiloto?t=${opts.manage_token}`;

  const sede = detectSede({
    convocatoriaUrl: opts.convocatoria_url,
    convocatoriaTitle: opts.convocatoria_title,
  });
  const sedeHtml = sede
    ? `<li>Accede a la sede: <a href="${esc(sede.urlTramite ?? sede.url)}" style="color:#e6356b">${esc(sede.nombre)} ↗</a></li>`
    : `<li>Accede a la sede electrónica del organismo con tu certificado digital</li>`;

  const deadlineHtml = opts.convocatoria_deadline
    ? `<div style="background:#f9fafb;border:1px solid #fdba74;padding:12px 20px;margin:16px 0;font-size:14px">
         ⚠ <strong>Plazo de presentación: ${esc(opts.convocatoria_deadline)}</strong>. Presenta con margen para evitar saturación de la sede.
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:640px;margin:0 auto;padding:32px 24px">

  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Copiloto de Subvenciones
  </p>

  <h1 style="font-size:24px;font-weight:700;line-height:1.2;margin:0 0 16px">
    Hola, ${esc(primerNombre)}. Hemos encontrado algo para ${esc(opts.org_nombre)}.
  </h1>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px">
    El Copiloto de Subvenciones de Startidea ha detectado una convocatoria que puede encajar con vuestra organización:
    <strong>${esc(opts.convocatoria_title)}</strong>.
  </p>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 24px">
    Hemos preparado la documentación preliminar (expediente
    <code style="font-family:monospace;font-size:13px;background:#f3f4f6;padding:2px 6px">${esc(opts.expediente_id)}</code>).
    Revisad los documentos, completad los campos marcados con <strong>[COMPLETAR]</strong> y presentadla.
  </p>

  ${deadlineHtml}

  <div style="background:#fff7f8;border-left:3px solid #e6356b;padding:12px 20px;margin:24px 0;font-size:14px;color:#333">
    <strong>Para presentarla:</strong>
    <ol style="margin:8px 0;padding-left:20px;line-height:1.8">
      <li>Revisad y completad los documentos (buscad los <strong>[COMPLETAR]</strong>)</li>
      <li>Reunid el checklist de documentación</li>
      ${sedeHtml}
      <li>Si necesitáis ayuda: <a href="mailto:hola@startidea.es" style="color:#e6356b">hola@startidea.es</a></li>
    </ol>
  </div>

  <div style="background:#fff;border:1px solid #e5e7eb;padding:24px;margin:24px 0">
    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:0 0 16px;font-family:monospace">📄 Memoria técnica</h2>
    ${mdToHtml(opts.ai_memoria)}
  </div>

  ${opts.ai_presupuesto ? `
  <div style="background:#fff;border:1px solid #e5e7eb;padding:24px;margin:24px 0">
    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:0 0 16px;font-family:monospace">💶 Presupuesto</h2>
    ${mdToHtml(opts.ai_presupuesto)}
  </div>` : ''}

  ${opts.ai_checklist ? `
  <div style="background:#fff;border:1px solid #e5e7eb;padding:24px;margin:24px 0">
    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:0 0 16px;font-family:monospace">📋 Documentación necesaria</h2>
    ${mdToHtml(opts.ai_checklist)}
  </div>` : ''}

  ${opts.ai_guia ? `
  <div style="background:#1f1f22;padding:24px;margin:24px 0;color:#ffffff">
    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#aaa;margin:0 0 16px;font-family:monospace">🗺️ Cómo presentarlo</h2>
    <div style="color:#e5e7eb;font-size:14px;line-height:1.7">${mdToHtml(opts.ai_guia)}</div>
  </div>` : ''}

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:13px;color:#888">
    Dudas o revisión: <a href="mailto:hola@startidea.es" style="color:#e6356b">hola@startidea.es</a> · código <strong>${esc(opts.expediente_id)}</strong>
  </p>
  <p style="font-size:12px;color:#bbb;margin-top:16px">
    Recibiste este email porque activaste el Copiloto Autónomo de Startidea.
    <a href="${manageUrl}" style="color:#bbb">Pausar o cancelar →</a>
  </p>
  <p style="font-size:11px;color:#bbb">Startidea · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada</p>
</div>
</body>
</html>`;

  return sendEmail({
    to: opts.to,
    subject: `[${opts.expediente_id}] Nueva convocatoria: ${opts.convocatoria_title} — Startidea`,
    html,
    replyTo: 'hola@startidea.es',
  });
}

// ── Construcción de descripción enriquecida ───────────────────────────────────

function buildRichDescription(profile: AutoCopilotoProfile, convTitle: string): string {
  const parts: string[] = [profile.org_descripcion];
  if (profile.anos_activos > 0) parts.push(`La organización lleva ${profile.anos_activos} años activa.`);
  if (profile.beneficiarios_anuales > 0) parts.push(`Atiende a ${profile.beneficiarios_anuales.toLocaleString('es-ES')} beneficiarios/año.`);
  if (profile.presupuesto_anual) parts.push(`Presupuesto anual: ${profile.presupuesto_anual}.`);
  if (profile.proyectos_anteriores) parts.push(`\nProyectos financiados anteriores:\n${profile.proyectos_anteriores}`);
  if (profile.logros_principales) parts.push(`\nLogros e indicadores:\n${profile.logros_principales}`);
  parts.push(`\n[Generado automáticamente por campaña manual del Copiloto de Startidea para "${convTitle}". Completar campos [COMPLETAR] antes de presentar.]`);
  return parts.filter(Boolean).join('\n\n');
}

// ── Endpoint ──────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: CampaignBody;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const { convocatoria, dryRun = true, skipAlreadyProcessed = true, targetCcaa, targetOrgTipos } = body;

  if (!convocatoria?.slug || !convocatoria?.title) {
    return new Response(JSON.stringify({ ok: false, error: 'missing convocatoria.slug or convocatoria.title' }), { status: 400 });
  }

  // 1. Perfiles activos + confirmados
  let profiles = getActiveProfiles();

  // Filtros adicionales opcionales
  if (targetCcaa) {
    const ccaaNorm = targetCcaa.toLowerCase();
    profiles = profiles.filter((p) => {
      const profileCcaa = p.ccaa.toLowerCase();
      // Incluir perfiles sin CCAA (nacional) y los que coincidan
      return !profileCcaa || profileCcaa.includes(ccaaNorm) || ccaaNorm.includes(profileCcaa);
    });
  }
  if (targetOrgTipos && targetOrgTipos.length > 0) {
    profiles = profiles.filter((p) => targetOrgTipos.includes(p.org_tipo));
  }

  // 2. Scoring
  const convForScore = {
    slug: convocatoria.slug,
    title: convocatoria.title,
    organization: 'Startidea campaña',
    ccaa: convocatoria.ccaa ?? null,
    geo_level: convocatoria.geo_level ?? (convocatoria.ccaa ? 'regional' : 'nacional'),
    finalidades: convocatoria.finalidades ?? [],
    amount_eur: convocatoria.amount_eur ?? null,
  };

  const scored = profiles
    .map((p) => ({ profile: p, score: convScoreForProfile(convForScore, p) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  // Para dry run y wet run: añadimos el perfil completo para uso interno
  const matchesFull = scored.map(({ profile, score }) => ({
    profile,
    score,
    already_processed: isAlreadyProcessed(profile.id, convocatoria.slug),
  }));

  // Vista pública (sin datos sensibles) para la respuesta dry run
  const matchesPublic = matchesFull.map(({ profile, score, already_processed }) => ({
    profile_id: profile.id,
    org_nombre: profile.org_nombre,
    email: profile.email,
    org_tipo: profile.org_tipo,
    ccaa: profile.ccaa,
    score,
    already_processed,
  }));

  // Dry run: solo devolver matches
  if (dryRun) {
    return new Response(JSON.stringify({
      ok: true,
      dryRun: true,
      total_profiles_evaluated: profiles.length,
      matches: matchesPublic,
    }), { status: 200 });
  }

  // Wet run: generar docs + enviar emails
  const startTime = Date.now();
  const results: { profile: string; status: 'ok' | 'skip' | 'error'; detail?: string }[] = [];

  // Pre-fetch contexto de la convocatoria (una sola vez para todos los perfiles)
  const { context: convContext } = await buildConvContext({
    convocatoria_slug: convocatoria.slug,
    convocatoria_title: convocatoria.title,
    convocatoria_url: convocatoria.url ?? null,
  });

  for (const { profile, score, already_processed } of matchesFull) {
    if (skipAlreadyProcessed && already_processed) {
      results.push({ profile: profile.org_nombre, status: 'skip', detail: 'ya procesado' });
      continue;
    }

    try {
      const expId = `CM-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
      const now   = Math.floor(Date.now() / 1000);
      const descr = buildRichDescription(profile, convocatoria.title);

      insertExpediente({
        id: expId,
        convocatoria_slug: convocatoria.slug,
        convocatoria_title: convocatoria.title,
        convocatoria_url: convocatoria.url ?? null,
        org_nombre: profile.org_nombre,
        org_cif: profile.org_cif || 'Por comunicar',
        org_tipo: profile.org_tipo,
        representante: profile.representante,
        email: profile.email,
        telefono: profile.telefono,
        provincia: profile.ccaa || '',
        descripcion_proyecto: descr,
        importe_solicitado: convocatoria.amount_eur
          ? `${convocatoria.amount_eur.toLocaleString('es-ES')} € (máximo convocatoria)`
          : 'Por determinar',
        experiencia: 'Generación automática — campaña manual — completar antes de presentar',
        apoderamiento: 0,
        comentarios: `Campaña manual Copiloto · Score ${score} · Perfil: ${profile.id}`,
        como_conocio: 'copiloto-autonomo',
        docs_adjuntos: '[]',
        ip: 'campaign',
        created_at: now,
        updated_at: now,
      });
      updateStatus(expId, 'analizando_ia');

      const gen = await runAiGeneration(
        {
          org_nombre: profile.org_nombre,
          org_cif: profile.org_cif || 'Por comunicar',
          org_tipo: profile.org_tipo,
          representante: profile.representante,
          provincia: profile.ccaa || '',
          experiencia: '',
          importe_solicitado: convocatoria.amount_eur
            ? `${convocatoria.amount_eur.toLocaleString('es-ES')} €`
            : '',
          descripcion_proyecto: descr,
          comentarios: '',
        },
        convContext,
      );

      if (!gen.ok) {
        logGeneration({ profile_id: profile.id, convocatoria_slug: convocatoria.slug, convocatoria_title: convocatoria.title, error: gen.error });
        results.push({ profile: profile.org_nombre, status: 'error', detail: gen.error });
        continue;
      }

      saveAiOutput(expId, {
        memoria: gen.memoria,
        presupuesto: gen.presupuesto,
        checklist: gen.checklist,
        guia: gen.guia,
        elegibilidad: gen.elegibilidad?.raw,
        datosFaltantes: gen.datosFaltantes,
      });
      updateStatus(expId, 'docs_listos');

      const sent = await sendCampaignEmail({
        to: profile.email,
        org_nombre: profile.org_nombre,
        representante: profile.representante,
        convocatoria_title: convocatoria.title,
        convocatoria_url: convocatoria.url ?? null,
        convocatoria_deadline: convocatoria.deadline ?? null,
        expediente_id: expId,
        ai_memoria: gen.memoria,
        ai_presupuesto: gen.presupuesto,
        ai_checklist: gen.checklist,
        ai_guia: gen.guia,
        manage_token: profile.manage_token,
      });

      if (sent) updateStatus(expId, 'entregado');

      logGeneration({
        profile_id: profile.id,
        convocatoria_slug: convocatoria.slug,
        convocatoria_title: convocatoria.title,
        expediente_id: expId,
        sent,
        deadline: convocatoria.deadline ?? null,
      });

      markLastRun(profile.id);
      results.push({ profile: profile.org_nombre, status: 'ok', detail: `exp=${expId}, score=${score}` });

      // Pausa entre perfiles para no saturar OpenRouter
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logGeneration({ profile_id: profile.id, convocatoria_slug: convocatoria.slug, convocatoria_title: convocatoria.title, error: detail });
      results.push({ profile: profile.org_nombre, status: 'error', detail });
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  return new Response(JSON.stringify({
    ok: true,
    dryRun: false,
    elapsed_s: elapsed,
    sent: results.filter((r) => r.status === 'ok').length,
    skipped: results.filter((r) => r.status === 'skip').length,
    errors: results.filter((r) => r.status === 'error').length,
    results,
  }), { status: 200 });
};
