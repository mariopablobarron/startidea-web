/**
 * POST /api/auto-copiloto/match-catalog
 *
 * Busca perfiles activos del Copiloto Autónomo que encajan con una convocatoria
 * recién activada en el catálogo local y genera documentos para cada match.
 *
 * Se llama automáticamente (fire-and-forget) desde
 * PATCH /api/admin/convocatorias cuando se activa una convocatoria local.
 * También puede invocarse manualmente desde el panel admin.
 *
 * Body:  { slug: string }
 * Auth:  x-admin-token header
 *
 * Diferencias vs trigger.ts (que usa convocatorias del HUB externo):
 *  - ccaa hardcoded "andalucia" (Junta de Andalucía)
 *  - geo_level hardcoded "regional"
 *  - finalidades: match textual contra financiaResumen, no slugs
 *  - amount_eur: importeMax del catálogo local
 */
import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { isValidAdminHeader } from '@/lib/admin-session';
import {
  getConvocatoria,
  insertExpediente,
  saveAiOutput,
  updateStatus,
} from '@/lib/expedientes-db';
import {
  getActiveProfiles,
  isAlreadyProcessed,
  logGeneration,
  type AutoCopilotoProfile,
} from '@/lib/auto-copiloto-db';
import { buildConvContext, runAiGeneration } from '@/lib/copiloto-engine';
import { sendEmail } from '@/lib/email-resend';
import { detectSede } from '@/lib/sedes-map';
import { buildPremiumCTAHtml } from '@/lib/copiloto-cta';

export const prerender = false;

/** Número máximo de perfiles a procesar por activación de convocatoria. */
const MAX_PER_RUN = 5;

// ─── Utilidades ───────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function esc(s: string): string {
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

// ─── Scoring adaptado para catálogo local ────────────────────────────────────

/**
 * Puntúa qué tan relevante es una convocatoria del catálogo local para un perfil.
 * 0 = no encaja (filtro duro fallido). > 0 = encaja, cuanto mayor mejor.
 */
function scoreLocalConvForProfile(
  conv: {
    slug: string;
    title: string;
    organization: string;
    finalidades_text: string[];  // financiaResumen — texto libre, no slugs
    amount_eur: number | null;
  },
  profile: AutoCopilotoProfile,
): number {
  let score = 0;

  // ── Filtros DUROS ──────────────────────────────────────────────────────────

  // Territorio: convocatorias del catálogo local son de la Junta de Andalucía
  const territorios: string[] = JSON.parse(profile.territorios || '["nacional"]');
  if (territorios.length > 0 && !territorios.includes('nacional')) {
    const matchTerritorio = territorios.some(
      (t) => normalize(t) === 'andalucia' || normalize(t) === 'andalucía',
    );
    if (!matchTerritorio) return 0;
  }

  // Importe
  if (profile.importe_min > 0 && conv.amount_eur !== null && conv.amount_eur < profile.importe_min) return 0;
  if (profile.importe_max && conv.amount_eur !== null && conv.amount_eur > profile.importe_max) return 0;

  // Finalidades: match textual cuando no hay slugs estructurados
  const finalidades: string[] = JSON.parse(profile.finalidades || '[]');
  if (finalidades.length > 0) {
    const haystack = normalize(
      conv.title + ' ' + conv.organization + ' ' + conv.finalidades_text.join(' '),
    );
    // Convertir slug "inclusion-social" → "inclusion social" para match textual
    const hasFinalidad = finalidades.some((f) =>
      haystack.includes(normalize(f.replace(/-/g, ' '))),
    );
    if (!hasFinalidad) return 0;
  }

  // Keywords
  if (profile.keywords) {
    const kws = profile.keywords
      .split(',')
      .map((k) => normalize(k.trim()))
      .filter(Boolean);
    if (kws.length > 0) {
      const haystack = normalize(conv.title + ' ' + conv.organization);
      if (!kws.some((k) => haystack.includes(k))) return 0;
    }
  }

  // ── Scoring de relevancia ──────────────────────────────────────────────────

  score += 10; // base: pasó todos los filtros duros

  // Perfil andaluz → +20 (estas convocatorias son para Andalucía)
  if (profile.ccaa && normalize(profile.ccaa).includes('andaluc')) score += 20;

  // Keyword en título → +15 por keyword
  if (profile.keywords) {
    const kws = profile.keywords.split(',').map((k) => normalize(k.trim())).filter(Boolean);
    const titleNorm = normalize(conv.title);
    for (const k of kws) {
      if (titleNorm.includes(k)) score += 15;
    }
  }

  // Finalidad match textual → +15
  if (finalidades.length > 0) {
    const haystack = normalize(conv.title + ' ' + conv.finalidades_text.join(' '));
    if (finalidades.some((f) => haystack.includes(normalize(f.replace(/-/g, ' '))))) score += 15;
  }

  // Importe dentro de rango → +10
  if (conv.amount_eur !== null) {
    const min = profile.importe_min || 0;
    const max = profile.importe_max || Infinity;
    if (conv.amount_eur >= min && conv.amount_eur <= max) score += 10;
  }

  return Math.min(score, 100);
}

// ─── Descripción enriquecida para el prompt IA ───────────────────────────────

function buildRichDescription(profile: AutoCopilotoProfile, convTitle: string): string {
  const parts: string[] = [profile.org_descripcion];
  if (profile.anos_activos > 0) {
    parts.push(`La organización lleva ${profile.anos_activos} años activa.`);
  }
  if (profile.beneficiarios_anuales > 0) {
    parts.push(`Atiende directamente a ${profile.beneficiarios_anuales.toLocaleString('es-ES')} beneficiarios al año.`);
  }
  if (profile.presupuesto_anual) {
    parts.push(`Presupuesto anual aproximado: ${profile.presupuesto_anual}.`);
  }
  if (profile.proyectos_anteriores) {
    parts.push(`\nProyectos anteriores financiados:\n${profile.proyectos_anteriores}`);
  }
  if (profile.logros_principales) {
    parts.push(`\nLogros e indicadores de impacto:\n${profile.logros_principales}`);
  }
  parts.push(
    `\n[Expediente generado automáticamente por el Copiloto de Startidea al detectar\n` +
    `la convocatoria "${convTitle}". Los campos específicos del proyecto deben completarse\n` +
    `antes de la presentación.]`,
  );
  return parts.filter(Boolean).join('\n\n');
}

// ─── Emails ───────────────────────────────────────────────────────────────────

async function sendCatalogMatchEmail(opts: {
  to: string;
  org_nombre: string;
  representante: string;
  convocatoria_slug: string;
  convocatoria_title: string;
  convocatoria_url: string | null;
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
    ? `<li>Accede a la sede: <a href="${esc(sede.urlTramite ?? sede.url)}" style="color:#e6356b" target="_blank">${esc(sede.nombre)} ↗</a>${sede.autofirmaRequired ? ' (necesitas Autofirma)' : ''}</li>`
    : `<li>Accede a la sede electrónica del organismo con tu certificado digital</li>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Convocatoria detectada — Startidea</title></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:640px;margin:0 auto;padding:32px 24px">

  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Copiloto Autónomo de Subvenciones
  </p>

  <h1 style="font-size:24px;font-weight:700;line-height:1.2;margin:0 0 16px;color:#1f1f22">
    Hola, ${esc(primerNombre)}. Hemos encontrado algo para ${esc(opts.org_nombre)}.
  </h1>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px">
    El Copiloto ha detectado una convocatoria que puede encajar con tu organización:
    <strong>${esc(opts.convocatoria_title)}</strong>.
  </p>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 24px">
    Hemos preparado automáticamente la documentación preliminar (expediente
    <code style="font-family:monospace;font-size:13px;background:#f0ece4;padding:2px 6px">${esc(opts.expediente_id)}</code>).
    Revísala, completa los campos marcados con <strong>[COMPLETAR]</strong> y preséntala.
  </p>

  <div style="background:#fff7f8;border-left:3px solid #e6356b;padding:12px 20px;margin:24px 0;font-size:14px;color:#333">
    <strong>Para presentarla:</strong>
    <ol style="margin:8px 0;padding-left:20px;line-height:1.8">
      <li>Revisa y completa los documentos (busca los <strong>[COMPLETAR]</strong>)</li>
      <li>Reúne el checklist de documentación</li>
      ${sedeHtml}
      <li>Sigue la guía de presentación (sección al final de este email)</li>
      <li>¿Necesitas ayuda?: <a href="mailto:hola@startidea.es" style="color:#e6356b">hola@startidea.es</a></li>
    </ol>
  </div>

  <div style="background:#fff8f2;border:1px solid #e0ddd8;padding:12px 20px;margin:16px 0;font-size:13px;color:#666;font-style:italic">
    ⚡ Estos documentos fueron preparados automáticamente por el Copiloto de Startidea.
    Están pensados como punto de partida, no como versión final. Revisa siempre los datos
    antes de presentar.
  </div>

  <!-- MEMORIA -->
  <div style="background:#fff;border:1px solid #e0ddd8;padding:24px;margin:24px 0">
    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:0 0 16px;font-family:monospace">📄 Memoria técnica</h2>
    ${mdToHtml(opts.ai_memoria)}
  </div>

  ${opts.ai_presupuesto ? `
  <div style="background:#fff;border:1px solid #e0ddd8;padding:24px;margin:24px 0">
    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:0 0 16px;font-family:monospace">💶 Presupuesto</h2>
    ${mdToHtml(opts.ai_presupuesto)}
  </div>` : ''}

  ${opts.ai_checklist ? `
  <div style="background:#fff;border:1px solid #e0ddd8;padding:24px;margin:24px 0">
    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:0 0 16px;font-family:monospace">📋 Documentación necesaria</h2>
    ${mdToHtml(opts.ai_checklist)}
  </div>` : ''}

  ${opts.ai_guia ? `
  <div style="background:#1f1f22;border:1px solid #333;padding:24px;margin:24px 0;color:#faf8f5">
    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#aaa;margin:0 0 16px;font-family:monospace">🗺️ Cómo presentarlo</h2>
    <div style="color:#e0ddd8;font-size:14px;line-height:1.7">${mdToHtml(opts.ai_guia)}</div>
  </div>` : ''}

  ${buildPremiumCTAHtml({
    convocatoriaSlug:  opts.convocatoria_slug,
    convocatoriaTitle: opts.convocatoria_title,
    expedienteId:      opts.expediente_id,
    fuente:            'catalogo',
  })}

  <hr style="border:none;border-top:1px solid #e0ddd8;margin:32px 0">

  <p style="font-size:13px;color:#888;line-height:1.6">
    ¿Dudas puntuales? Responde a este email o escríbenos a
    <a href="mailto:hola@startidea.es" style="color:#e6356b">hola@startidea.es</a>
    con el código <strong>${esc(opts.expediente_id)}</strong>.
  </p>

  <p style="font-size:12px;color:#bbb;margin-top:24px;border-top:1px solid #e0ddd8;padding-top:16px">
    Recibiste este email porque activaste el Copiloto Autónomo de Subvenciones de Startidea.
    <a href="${manageUrl}" style="color:#bbb">Pausar o cancelar →</a>
  </p>

  <p style="font-size:13px;color:#888;margin-top:8px">
    Startidea · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada
  </p>
</div>
</body>
</html>`;

  return sendEmail({
    to: opts.to,
    subject: `[${opts.expediente_id}] Nueva convocatoria detectada: ${opts.convocatoria_title} — Startidea`,
    html,
    replyTo: 'hola@startidea.es',
  });
}

async function sendEligibilityAlertEmail(opts: {
  to: string;
  org_nombre: string;
  representante: string;
  convocatoria_title: string;
  expediente_id: string;
  resumen: string;
  manage_token: string;
}): Promise<boolean> {
  const primerNombre = opts.representante.split(' ')[0];
  const manageUrl = `https://startidea.es/subvenciones/mi-copiloto?t=${opts.manage_token}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:32px 24px">
  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Copiloto Autónomo
  </p>
  <h1 style="font-size:22px;font-weight:700;line-height:1.2;margin:0 0 16px">
    Esta convocatoria probablemente no aplica para ${esc(opts.org_nombre)}.
  </h1>
  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px">
    El Copiloto detectó <strong>${esc(opts.convocatoria_title)}</strong>, pero al analizar
    los requisitos encontramos que hay al menos un criterio de elegibilidad que
    <strong>tu organización no cumple</strong> (o no tenemos datos para confirmarlo).
  </p>
  ${opts.resumen ? `<div style="background:#fff5f5;border-left:3px solid #dc2626;padding:12px 20px;margin:0 0 20px;font-size:14px;color:#333">${esc(opts.resumen)}</div>` : ''}
  <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:16px 20px;margin:20px 0;font-size:14px;color:#0369a1">
    <strong>¿Qué puedes hacer?</strong>
    <ul style="margin:8px 0;padding-left:20px;line-height:1.8">
      <li>Si crees que hay un error en el análisis, responde a este email — lo revisamos.</li>
      <li>Podemos explorar si hay convocatorias similares que sí apliquen a tu organización.</li>
    </ul>
    <a href="mailto:hola@startidea.es?subject=Revisar análisis: ${esc(opts.convocatoria_title)}" style="color:#e6356b;font-size:13px">Contactar con Startidea →</a>
  </div>
  <hr style="border:none;border-top:1px solid #e0ddd8;margin:28px 0">
  <p style="font-size:12px;color:#bbb">
    Alerta del Copiloto Autónomo · Expediente <code>${esc(opts.expediente_id)}</code> ·
    <a href="${manageUrl}" style="color:#bbb">Gestionar Copiloto →</a>
  </p>
  <p style="font-size:12px;color:#bbb">Startidea · CIF B19583632 · C/ Conde Cifuentes, 33 · 18005 Granada</p>
</div>
</body>
</html>`;

  return sendEmail({
    to: opts.to,
    subject: `[Alerta Copiloto] Posible incompatibilidad: ${opts.convocatoria_title}`,
    html,
    replyTo: 'hola@startidea.es',
  });
}

// ─── Endpoint principal ───────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  if (!isValidAdminHeader(request.headers.get('x-admin-token') ?? '')) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body: { slug?: string };
  try { body = await request.json() as { slug?: string }; }
  catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
  }

  const slug = body.slug?.trim();
  if (!slug) {
    return new Response(JSON.stringify({ ok: false, error: 'slug_required' }), { status: 400 });
  }

  // Cargar convocatoria del catálogo local
  let conv;
  try { conv = getConvocatoria(slug); } catch (e) {
    console.error('[match-catalog] Error loading conv:', e);
    conv = null;
  }

  if (!conv) {
    return new Response(JSON.stringify({ ok: false, error: 'conv_not_found' }), { status: 404 });
  }
  if (!conv.activa) {
    return new Response(JSON.stringify({ ok: false, error: 'conv_not_active', slug }), { status: 422 });
  }

  // Obtener perfiles activos
  let profiles: ReturnType<typeof getActiveProfiles> = [];
  try { profiles = getActiveProfiles(); } catch (e) {
    console.error('[match-catalog] Error getting profiles:', e);
    return new Response(JSON.stringify({ ok: false, error: 'db_error' }), { status: 500 });
  }

  if (profiles.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, slug, profiles_checked: 0, matched: 0, processed: 0, message: 'Sin perfiles activos' }),
      { status: 200 },
    );
  }

  // Construir objeto de conv compatible con el scoring
  const localConv = {
    slug:             conv.slug,
    title:            conv.tituloFull || conv.titulo,
    organization:     conv.organo,
    finalidades_text: conv.financiaResumen,
    amount_eur:       conv.importeMax,
  };

  // Puntuar y filtrar perfiles
  const matching = profiles
    .map((p) => ({ profile: p, score: scoreLocalConvForProfile(localConv, p) }))
    .filter(({ profile, score }) => score > 0 && !isAlreadyProcessed(profile.id, slug))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PER_RUN)
    .map(({ profile }) => profile);

  console.log(`[match-catalog] slug=${slug} profiles=${profiles.length} matched=${matching.length}`);

  if (matching.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true, slug,
        profiles_checked: profiles.length,
        matched: 0, processed: 0,
        message: 'Sin perfiles que encajen con esta convocatoria',
      }),
      { status: 200 },
    );
  }

  const results: { profile: string; status: 'ok' | 'error'; detail?: string }[] = [];

  for (const profile of matching) {
    try {
      const expId = `AC-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
      const now = Math.floor(Date.now() / 1000);
      const descripcionAuto = buildRichDescription(profile, localConv.title);
      const convUrl = conv.basesUrl ?? conv.bojaUrl ?? null;

      // 1. Crear expediente
      insertExpediente({
        id: expId,
        convocatoria_slug: slug,
        convocatoria_title: localConv.title,
        convocatoria_url: convUrl,
        org_nombre:          profile.org_nombre,
        org_cif:             profile.org_cif || 'Por comunicar',
        org_tipo:            profile.org_tipo,
        representante:       profile.representante,
        email:               profile.email,
        telefono:            profile.telefono,
        provincia:           profile.ccaa || '',
        descripcion_proyecto: descripcionAuto,
        importe_solicitado:  localConv.amount_eur
          ? `${localConv.amount_eur.toLocaleString('es-ES')} € (máximo de la convocatoria)`
          : 'Por determinar',
        experiencia: 'Generación automática — completar antes de presentar',
        apoderamiento: 0,
        comentarios: `Auto-generado por Copiloto Autónomo · Perfil: ${profile.id} · Catálogo local`,
        como_conocio: 'copiloto-autonomo',
        docs_adjuntos: '[]',
        ip: 'auto-copiloto-catalog',
        created_at: now,
        updated_at: now,
      });

      updateStatus(expId, 'analizando_ia');

      // 2. Construir contexto (buildConvContext ya busca en catálogo local primero)
      const { context: convContext } = await buildConvContext({
        convocatoria_slug: slug,
        convocatoria_title: localConv.title,
        convocatoria_url: convUrl,
      });

      // 3. Generar documentos con IA
      const gen = await runAiGeneration(
        {
          org_nombre:           profile.org_nombre,
          org_cif:              profile.org_cif || 'Por comunicar',
          org_tipo:             profile.org_tipo,
          representante:        profile.representante,
          provincia:            profile.ccaa || '',
          experiencia:          '',
          importe_solicitado:   localConv.amount_eur
            ? `${localConv.amount_eur.toLocaleString('es-ES')} €`
            : '',
          descripcion_proyecto: descripcionAuto,
          comentarios:          '',
        },
        convContext,
      );

      if (!gen.ok) {
        logGeneration({
          profile_id: profile.id,
          convocatoria_slug: slug,
          convocatoria_title: localConv.title,
          error: gen.error,
        });
        results.push({ profile: profile.org_nombre, status: 'error', detail: gen.error });
        continue;
      }

      // 4. Guardar output
      saveAiOutput(expId, {
        memoria:       gen.memoria,
        presupuesto:   gen.presupuesto,
        checklist:     gen.checklist,
        guia:          gen.guia,
        elegibilidad:  gen.elegibilidad?.raw,
        datosFaltantes: gen.datosFaltantes,
      });
      updateStatus(expId, 'docs_listos');

      const bloqueante = gen.elegibilidad?.bloqueante ?? false;

      // 5. Enviar email (bifurcar según elegibilidad)
      let emailSent = false;
      if (bloqueante) {
        emailSent = await sendEligibilityAlertEmail({
          to:                   profile.email,
          org_nombre:           profile.org_nombre,
          representante:        profile.representante,
          convocatoria_title:   localConv.title,
          expediente_id:        expId,
          resumen:              gen.elegibilidad?.resumen ?? '',
          manage_token:         profile.manage_token,
        });
        console.log(`[match-catalog] BLOQUEANTE para ${profile.org_nombre} · ${slug}`);
      } else {
        emailSent = await sendCatalogMatchEmail({
          to:                   profile.email,
          org_nombre:           profile.org_nombre,
          representante:        profile.representante,
          convocatoria_slug:    slug,
          convocatoria_title:   localConv.title,
          convocatoria_url:     convUrl,
          expediente_id:        expId,
          ai_memoria:           gen.memoria,
          ai_presupuesto:       gen.presupuesto,
          ai_checklist:         gen.checklist,
          ai_guia:              gen.guia,
          manage_token:         profile.manage_token,
        });
      }

      if (emailSent) updateStatus(expId, 'entregado');

      // 6. Registrar en log (deduplicación)
      logGeneration({
        profile_id:         profile.id,
        convocatoria_slug:  slug,
        convocatoria_title: localConv.title,
        expediente_id:      expId,
        sent:               emailSent,
        deadline:           conv.deadlineIso ?? null,
      });

      results.push({
        profile: profile.org_nombre,
        status: 'ok',
        detail: bloqueante
          ? `elegibilidad_bloqueante (score=${gen.elegibilidad?.score ?? '?'})`
          : `ok (score=${gen.elegibilidad?.score ?? '?'})`,
      });

    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[match-catalog] Error procesando:', profile.org_nombre, slug, detail);
      logGeneration({
        profile_id:         profile.id,
        convocatoria_slug:  slug,
        convocatoria_title: localConv.title,
        error:              detail,
      });
      results.push({ profile: profile.org_nombre, status: 'error', detail });
    }
  }

  const processed = results.filter((r) => r.status === 'ok').length;
  const errors = results.filter((r) => r.status === 'error').length;

  console.log(`[match-catalog] Fin · slug=${slug} processed=${processed} errors=${errors}`);

  return new Response(
    JSON.stringify({
      ok: true,
      slug,
      profiles_checked: profiles.length,
      matched: matching.length,
      processed,
      errors,
      results,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
};
