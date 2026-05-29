/**
 * POST /api/auto-copiloto/trigger
 *
 * Ejecuta un ciclo completo del Copiloto Autónomo:
 *  1. Lee perfiles activos + confirmados de la BD
 *  2. Obtiene convocatorias nuevas del HUB (últimas ~26h)
 *  3. Para cada perfil, filtra convocatorias que encajan
 *  4. Por cada match no procesado antes:
 *     a. Crea expediente en BD
 *     b. Genera documentos vía IA (copiloto-engine)
 *     c. Guarda output en BD
 *     d. Envía email con documentos al cliente
 *     e. Registra en auto_copiloto_log
 *  5. Devuelve resumen { processed, skipped, errors }
 *
 * Solo accesible con ADMIN_TOKEN (mismo mecanismo que el panel).
 * El cron VPS llama a este endpoint con el hash del token.
 *
 * Límite: máx. MAX_PER_PROFILE convocatorias por perfil por ejecución
 * para evitar spam y saturar el API de OpenRouter.
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

// Normaliza un string eliminando acentos y pasando a minúsculas
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
import { insertExpediente, saveAiOutput, updateStatus } from '@/lib/expedientes-db';
import { buildConvContext, runAiGeneration, parseEligibility } from '@/lib/copiloto-engine';
import { sendEmail } from '@/lib/email-resend';
import { detectSede } from '@/lib/sedes-map';
import { buildPremiumCTAHtml } from '@/lib/copiloto-cta';
import { notifyError } from '@/lib/notify-error';
import { getEnv } from '@/lib/env';

export const prerender = false;

const HUB_URL = 'https://hub.startidea.tech';
const MAX_PER_PROFILE = 2; // convocatorias máximas por perfil por ejecución
const RECENT_HOURS = 26;   // solo convocatorias publicadas en las últimas 26h


function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

// ─── Scoring: ¿encaja esta convocatoria con este perfil? (0 = no encaja) ─────
//
// Retorna un score de relevancia 0-100. Score 0 = descartado (no cumple filtros duros).
// Score > 0 = encaja; cuanto mayor, más relevante. Se usan para priorizar las mejores
// convocatorias cuando hay más de MAX_PER_PROFILE matches.

function convScoreForProfile(
  conv: {
    slug: string;
    title: string;
    organization: string;
    ccaa: string | null;
    geo_level: string | null;
    finalidades: string[];
    amount_eur: number | null;
  },
  profile: AutoCopilotoProfile,
): number {
  let score = 0;

  // ── Filtros DUROS (descarte si no se cumplen) ──────────────────────────────

  // Territorio (filtro duro)
  const territorios: string[] = JSON.parse(profile.territorios || '["nacional"]');
  if (territorios.length > 0 && !territorios.includes('nacional')) {
    const convCcaa = normalize(conv.ccaa ?? '');
    const convGeo = normalize(conv.geo_level ?? '');
    const matchTerritorio = territorios.some(
      (t) => convCcaa.includes(normalize(t)) || normalize(t) === convGeo || (normalize(t) === 'europa' && convGeo === 'europa'),
    );
    if (!matchTerritorio) return 0;
  }

  // Importe (filtros duros)
  if (profile.importe_min > 0 && conv.amount_eur !== null && conv.amount_eur < profile.importe_min) return 0;
  if (profile.importe_max && conv.amount_eur !== null && conv.amount_eur > profile.importe_max) return 0;

  // Finalidades (filtro duro si el perfil las tiene definidas)
  const finalidades: string[] = JSON.parse(profile.finalidades || '[]');
  if (finalidades.length > 0) {
    const hasFinalidad = finalidades.some((f) => conv.finalidades.includes(f));
    if (!hasFinalidad) return 0;
  }

  // Keywords (filtro duro si el perfil las tiene definidas)
  if (profile.keywords) {
    const kws = profile.keywords.split(',').map((k) => normalize(k.trim())).filter(Boolean);
    if (kws.length > 0) {
      const haystack = normalize(conv.title + ' ' + conv.organization);
      const hasKeyword = kws.some((k) => haystack.includes(k));
      if (!hasKeyword) return 0;
    }
  }

  // ── Scoring de relevancia (positivo si pasó los filtros duros) ─────────────

  score += 10; // base: pasó todos los filtros

  // Territorio exacto (CCAA del perfil == CCAA de la conv) → +20
  if (profile.ccaa && conv.ccaa && normalize(conv.ccaa).includes(normalize(profile.ccaa))) {
    score += 20;
  }
  // Convocatoria nacional (accesible para todos) → +10
  if (conv.geo_level === 'nacional' || conv.geo_level === null) {
    score += 10;
  }
  // Keyword en título (más relevante que en organismo) → +15 por keyword
  if (profile.keywords) {
    const kws = profile.keywords.split(',').map((k) => normalize(k.trim())).filter(Boolean);
    const titleNorm = normalize(conv.title);
    for (const k of kws) {
      if (titleNorm.includes(k)) score += 15;
    }
  }
  // Finalidad match → +15
  if (finalidades.length > 0 && finalidades.some((f) => conv.finalidades.includes(f))) {
    score += 15;
  }
  // Importe dentro del rango preferido del perfil → +10
  if (conv.amount_eur !== null) {
    const min = profile.importe_min || 0;
    const max = profile.importe_max || Infinity;
    if (conv.amount_eur >= min && conv.amount_eur <= max) score += 10;
  }

  return Math.min(score, 100);
}

// ─── Emails de entrega ───────────────────────────────────────────────────────

function mdToHtml(md: string): string {
  return md
    .replace(/^#{1,3} (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:16px 0 6px">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/gs, '<ul style="padding-left:20px;margin:8px 0">$&</ul>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0">')
    .replace(/^(?!<[hul])(.+)$/gm, '<p style="margin:6px 0">$1</p>');
}

/** Convierte las líneas REQ: del bloque elegibilidad en HTML con semáforo visual */
function eligibilityChecksToHtml(checks: string[]): string {
  if (!checks.length) return '';
  const rows = checks.map((c) => {
    const color = c.startsWith('✅') ? '#16a34a'
      : c.startsWith('❌') ? '#dc2626'
      : c.startsWith('⚠️') ? '#d97706'
      : '#6b7280';
    return `<tr>
      <td style="padding:5px 8px;font-size:13px;color:${color};font-weight:bold;white-space:nowrap">${c.split(' — ')[0]}</td>
      <td style="padding:5px 8px;font-size:13px;color:#555">${esc(c.split(' — ').slice(1).join(' — '))}</td>
    </tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0">${rows}</table>`;
}

/**
 * Email cuando la org NO cumple requisitos (BLOQUEANTE: SI).
 * Explica qué requisito falla y qué datos faltan para verificar el resto.
 */
async function sendEligibilityAlertEmail(opts: {
  to: string;
  org_nombre: string;
  representante: string;
  convocatoria_title: string;
  convocatoria_url: string | null;
  expediente_id: string;
  checks: string[];
  resumen: string;
  datosFaltantes: string;
  manage_token: string;
}): Promise<boolean> {
  const primerNombre = opts.representante.split(' ')[0];
  const manageUrl = `https://startidea.es/subvenciones/mi-copiloto?t=${opts.manage_token}`;
  const faltantesHtml = opts.datosFaltantes && opts.datosFaltantes !== 'Ninguno'
    ? `<div style="background:#fffbeb;border:1px solid #fbbf24;padding:16px 20px;margin:20px 0">
        <p style="font-size:13px;font-weight:700;color:#92400e;margin:0 0 8px">Para completar el análisis necesitamos saber:</p>
        ${opts.datosFaltantes.split('\n').filter(l => l.startsWith('- ')).map(l =>
          `<p style="font-size:13px;color:#78350f;margin:3px 0">${esc(l)}</p>`
        ).join('')}
        <p style="font-size:12px;color:#92400e;margin:8px 0 0">
          Actualiza tu perfil respondiendo a este email o en
          <a href="${manageUrl}" style="color:#e6356b">Mi Copiloto →</a>
        </p>
      </div>`
    : '';

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
    los requisitos de las bases encontramos que hay al menos un criterio de elegibilidad
    que <strong>tu organización no cumple</strong> (o no tenemos datos para confirmarlo).
  </p>
  ${opts.resumen ? `<div style="background:#fff5f5;border-left:3px solid #dc2626;padding:12px 20px;margin:0 0 20px;font-size:14px;color:#333">${esc(opts.resumen)}</div>` : ''}

  <div style="background:#fff;border:1px solid #e0ddd8;padding:20px;margin:20px 0">
    <p style="font-size:13px;font-family:monospace;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin:0 0 12px">Análisis de requisitos</p>
    ${eligibilityChecksToHtml(opts.checks)}
  </div>

  ${faltantesHtml}

  <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:16px 20px;margin:20px 0;font-size:14px;color:#0369a1">
    <strong>¿Qué puedes hacer?</strong>
    <ul style="margin:8px 0;padding-left:20px;line-height:1.8">
      <li>Si crees que hay un error en el análisis, responde a este email — lo revisamos.</li>
      <li>Si la convocatoria es de interés pero falta un requisito concreto, podemos explorar si hay convocatorias similares que sí apliquen.</li>
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

async function sendAutoCopilotoEmail(opts: {
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
  eligibilityChecks: string[];
  eligibilityResumen: string;
  eligibilityScore: number;
  datosFaltantes: string;
  manage_token: string;
}): Promise<boolean> {
  const primerNombre = opts.representante.split(' ')[0];
  const manageUrl = `https://startidea.es/subvenciones/mi-copiloto?t=${opts.manage_token}`;

  // Detectar sede para el enlace directo
  const sede = detectSede({
    convocatoriaUrl: opts.convocatoria_url,
    convocatoriaTitle: opts.convocatoria_title,
  });
  const sedeHtml = sede
    ? `<li>Accede a la sede: <a href="${esc(sede.urlTramite ?? sede.url)}" style="color:#e6356b" target="_blank">${esc(sede.nombre)} ↗</a>${sede.autofirmaRequired ? ' (necesitas Autofirma)' : ''}</li>`
    : `<li>Accede a la sede electrónica del organismo con tu certificado digital</li>`;

  // Semáforo de elegibilidad para el email de documentos
  const scoreColor = opts.eligibilityScore >= 70 ? '#16a34a' : opts.eligibilityScore >= 45 ? '#d97706' : '#dc2626';
  const eligibilityBadge = opts.eligibilityChecks.length > 0 ? `
  <div style="background:#fff;border:1px solid #e0ddd8;padding:20px 24px;margin:24px 0">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <p style="font-size:13px;font-family:monospace;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin:0">
        🔍 Análisis de elegibilidad
      </p>
      <span style="font-family:monospace;font-size:12px;font-weight:700;color:${scoreColor};background:${scoreColor}15;padding:2px 8px;border-radius:2px">
        ${opts.eligibilityScore}/100
      </span>
    </div>
    ${eligibilityChecksToHtml(opts.eligibilityChecks)}
    ${opts.eligibilityResumen ? `<p style="font-size:13px;color:#555;margin:8px 0 0;font-style:italic">${esc(opts.eligibilityResumen)}</p>` : ''}
    ${opts.datosFaltantes && opts.datosFaltantes !== 'Ninguno' ? `
    <div style="border-top:1px solid #f0ece4;margin-top:12px;padding-top:12px">
      <p style="font-size:12px;color:#888;margin:0 0 6px;font-weight:bold">Para confirmar elegibilidad falta saber:</p>
      ${opts.datosFaltantes.split('\n').filter((l: string) => l.startsWith('- ')).map((l: string) =>
        `<p style="font-size:12px;color:#666;margin:2px 0">${esc(l)}</p>`
      ).join('')}
    </div>` : ''}
  </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Documentos Copiloto — Startidea</title></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:640px;margin:0 auto;padding:32px 24px">

  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Copiloto Autónomo de Subvenciones
  </p>

  <h1 style="font-size:24px;font-weight:700;line-height:1.2;margin:0 0 16px;color:#1f1f22">
    Hola, ${esc(primerNombre)}. Hemos encontrado algo para ${esc(opts.org_nombre)}.
  </h1>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px">
    El Copiloto ha detectado una nueva convocatoria que puede encajar con tu organización:
    <strong>${esc(opts.convocatoria_title)}</strong>.
  </p>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 24px">
    Hemos preparado automáticamente la documentación preliminar (expediente
    <code style="font-family:monospace;font-size:13px;background:#f0ece4;padding:2px 6px">${esc(opts.expediente_id)}</code>).
    Revísala, completa los campos marcados con <strong>[COMPLETAR]</strong> y preséntala.
  </p>

  ${eligibilityBadge}

  <div style="background:#fff7f8;border-left:3px solid #e6356b;padding:12px 20px;margin:24px 0;font-size:14px;color:#333">
    <strong>Para presentarla:</strong>
    <ol style="margin:8px 0;padding-left:20px;line-height:1.8">
      <li>Revisa y completa los documentos (busca los <strong>[COMPLETAR]</strong>)</li>
      <li>Reúne el checklist de documentación</li>
      ${sedeHtml}
      <li>Sigue la guía de presentación (sección al final de este email)</li>
      <li>Si necesitas ayuda: <a href="mailto:hola@startidea.es" style="color:#e6356b">hola@startidea.es</a></li>
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
    fuente:            'hub',
  })}

  <hr style="border:none;border-top:1px solid #e0ddd8;margin:32px 0">

  <p style="font-size:13px;color:#888;line-height:1.6">
    ¿Dudas puntuales sobre los documentos? Responde a este email o escríbenos a
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

// ─── Descripción enriquecida del proyecto para el prompt IA ─────────────────

/**
 * Construye un bloque de descripción del proyecto mucho más rico que la simple
 * org_descripcion, usando todos los campos de contexto disponibles en el perfil.
 * Cuantos más datos tenga el perfil, mejores documentos genera la IA.
 */
function buildRichDescription(profile: AutoCopilotoProfile, convTitle: string): string {
  const parts: string[] = [];

  parts.push(profile.org_descripcion);

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
    parts.push(`\nProyectos anteriores financiados con subvenciones:\n${profile.proyectos_anteriores}`);
  }
  if (profile.logros_principales) {
    parts.push(`\nLogros e indicadores de impacto destacados:\n${profile.logros_principales}`);
  }

  parts.push(
    `\n[Este expediente fue generado automáticamente por el Copiloto de Startidea al detectar\n` +
    `la convocatoria "${convTitle}". Los campos específicos del proyecto deben completarse\n` +
    `antes de la presentación.]`,
  );

  return parts.filter(Boolean).join('\n\n');
}

// ─── Endpoint principal ───────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  // Auth
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  const startTime = Date.now();
  const results: { profile: string; conv: string; status: 'ok' | 'skip' | 'error'; detail?: string }[] = [];

  // 1. Perfiles activos
  const profiles = getActiveProfiles();
  if (profiles.length === 0) {
    return new Response(JSON.stringify({ ok: true, profiles: 0, processed: 0, message: 'Sin perfiles activos' }), { status: 200 });
  }

  // 2. Convocatorias recientes del HUB (últimas RECENT_HOURS)
  let recentConvs: Array<{
    id: number;
    slug: string;
    title: string;
    organization: string;
    ccaa: string | null;
    geo_level: string | null;
    finalidades: string[];
    amount_eur: number | null;
    deadline: string | null;
    published_at: string | null;
    source_url: string;
  }> = [];

  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(
      `${HUB_URL}/api/public/subsidies?status=abierto&sort=recent&pageSize=100`,
      { signal: ctl.signal, headers: { Accept: 'application/json' } },
    );
    if (r.ok) {
      const data = await r.json();
      const cutoff = Date.now() - RECENT_HOURS * 60 * 60 * 1000;
      recentConvs = (data.items ?? []).filter((c: { published_at: string | null }) => {
        if (!c.published_at) return false;
        return new Date(c.published_at).getTime() >= cutoff;
      });
    }
  } catch (err) {
    // HUB caído = cron del día no detecta nada. Crítico: avisa a Mario.
    await notifyError({
      component: 'auto-copiloto/trigger',
      severity:  'critical',
      message:   'No se pudo conectar al HUB para obtener convocatorias del día. Ningún perfil recibirá emails hasta que se resuelva.',
      error:     err,
      context:   { hub_url: HUB_URL },
    });
    return new Response(
      JSON.stringify({ ok: false, error: 'hub_unavailable' }),
      { status: 502 },
    );
  }

  if (recentConvs.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, profiles: profiles.length, processed: 0, message: 'Sin convocatorias nuevas en el HUB' }),
      { status: 200 },
    );
  }

  // 3. Procesar cada perfil
  for (const profile of profiles) {
    const matching = recentConvs
      .map((c) => ({ conv: c, score: convScoreForProfile(c, profile) }))
      .filter(({ conv, score }) => score > 0 && !isAlreadyProcessed(profile.id, conv.slug))
      .sort((a, b) => b.score - a.score)   // mejores primero
      .slice(0, MAX_PER_PROFILE)
      .map(({ conv }) => conv);

    for (const conv of matching) {
      try {
        // 3a. Crear expediente
        const expId = `AC-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
        const now = Math.floor(Date.now() / 1000);

        // Descripción enriquecida con todos los datos disponibles del perfil
        const descripcionAuto = buildRichDescription(profile, conv.title);

        insertExpediente({
          id: expId,
          convocatoria_slug: conv.slug,
          convocatoria_title: conv.title,
          convocatoria_url: conv.source_url ?? null,
          org_nombre: profile.org_nombre,
          org_cif: profile.org_cif || 'Por comunicar',
          org_tipo: profile.org_tipo,
          representante: profile.representante,
          email: profile.email,
          telefono: profile.telefono,
          provincia: profile.ccaa || '',
          descripcion_proyecto: descripcionAuto,
          importe_solicitado: conv.amount_eur
            ? `${conv.amount_eur.toLocaleString('es-ES')} € (máximo de la convocatoria)`
            : 'Por determinar',
          experiencia: 'Generación automática — completar antes de presentar',
          apoderamiento: 0,
          comentarios: `Auto-generado por Copiloto Autónomo · Perfil: ${profile.id}`,
          como_conocio: 'copiloto-autonomo',
          docs_adjuntos: '[]',
          ip: 'auto-copiloto',
          created_at: now,
          updated_at: now,
        });

        updateStatus(expId, 'analizando_ia');

        // 3b. Construir contexto + generar IA
        const { context: convContext } = await buildConvContext({
          convocatoria_slug: conv.slug,
          convocatoria_title: conv.title,
          convocatoria_url: conv.source_url ?? null,
        });

        const gen = await runAiGeneration(
          {
            org_nombre: profile.org_nombre,
            org_cif: profile.org_cif || 'Por comunicar',
            org_tipo: profile.org_tipo,
            representante: profile.representante,
            provincia: profile.ccaa || '',
            experiencia: '',
            importe_solicitado: conv.amount_eur
              ? `${conv.amount_eur.toLocaleString('es-ES')} €`
              : '',
            descripcion_proyecto: descripcionAuto,
            comentarios: '',
          },
          convContext,
        );

        if (!gen.ok) {
          logGeneration({
            profile_id: profile.id,
            convocatoria_slug: conv.slug,
            convocatoria_title: conv.title,
            error: gen.error,
          });
          results.push({ profile: profile.org_nombre, conv: conv.title, status: 'error', detail: gen.error });
          continue;
        }

        const eleg = gen.elegibilidad;
        const bloqueante = eleg?.bloqueante ?? false;

        // 3c. Guardar output (incluyendo elegibilidad y datos faltantes)
        saveAiOutput(expId, {
          memoria: gen.memoria,
          presupuesto: gen.presupuesto,
          checklist: gen.checklist,
          guia: gen.guia,
          elegibilidad: eleg?.raw,
          datosFaltantes: gen.datosFaltantes,
        });
        updateStatus(expId, 'docs_listos');

        // 3d. Enviar email — bifurcar según elegibilidad
        let emailSent = false;

        if (bloqueante) {
          // La org NO cumple un requisito bloqueante → email de alerta, sin docs
          emailSent = await sendEligibilityAlertEmail({
            to: profile.email,
            org_nombre: profile.org_nombre,
            representante: profile.representante,
            convocatoria_title: conv.title,
            convocatoria_url: conv.source_url ?? null,
            expediente_id: expId,
            checks: eleg?.checks.map(c => c.texto) ?? [],
            resumen: eleg?.resumen ?? '',
            datosFaltantes: gen.datosFaltantes,
            manage_token: profile.manage_token,
          });
          console.log(`[auto-copiloto] BLOQUEANTE para ${profile.org_nombre} en ${conv.title} — email de alerta enviado`);
        } else {
          // Elegible (o dudoso) → enviar documentos + semáforo
          emailSent = await sendAutoCopilotoEmail({
            to: profile.email,
            org_nombre: profile.org_nombre,
            representante: profile.representante,
            convocatoria_slug: conv.slug,
            convocatoria_title: conv.title,
            convocatoria_url: conv.source_url ?? null,
            expediente_id: expId,
            ai_memoria: gen.memoria,
            ai_presupuesto: gen.presupuesto,
            ai_checklist: gen.checklist,
            ai_guia: gen.guia,
            eligibilityChecks: eleg?.checks.map(c => c.texto) ?? [],
            eligibilityResumen: eleg?.resumen ?? '',
            eligibilityScore: eleg?.score ?? 50,
            datosFaltantes: gen.datosFaltantes,
            manage_token: profile.manage_token,
          });
        }

        if (emailSent) updateStatus(expId, 'entregado');

        // 3e. Registrar en log (deduplicación)
        logGeneration({
          profile_id: profile.id,
          convocatoria_slug: conv.slug,
          convocatoria_title: conv.title,
          expediente_id: expId,
          sent: emailSent,
          deadline: conv.deadline ?? null,
        });

        results.push({
          profile: profile.org_nombre,
          conv: conv.title,
          status: 'ok',
          detail: bloqueante ? `elegibilidad_bloqueante (score=${eleg?.score})` : `elegibilidad_ok (score=${eleg?.score})`,
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error('[auto-copiloto/trigger] Error processing:', profile.org_nombre, conv.slug, detail);
        logGeneration({
          profile_id: profile.id,
          convocatoria_slug: conv.slug,
          convocatoria_title: conv.title,
          error: detail,
        });
        results.push({ profile: profile.org_nombre, conv: conv.title, status: 'error', detail });
      }
    }

    markLastRun(profile.id);
  }

  // Notificar a Mario si hubo generaciones
  const processed = results.filter((r) => r.status === 'ok').length;
  const errors = results.filter((r) => r.status === 'error').length;
  const elapsed = Math.round((Date.now() - startTime) / 1000);

  // Si más del 50% de los intentos han fallado, es señal de problema sistémico
  // (OpenRouter saturado, prompt roto, cuota agotada, etc.) → alerta crítica
  const total = processed + errors;
  if (total > 0 && errors / total > 0.5) {
    await notifyError({
      component: 'auto-copiloto/trigger',
      severity:  'critical',
      message:   `Tasa de error elevada en el ciclo diario del Copiloto: ${errors}/${total} fallos (${Math.round((errors/total) * 100)}%). Revisar logs de OpenRouter, cuota y prompt.`,
      context:   { processed, errors, elapsed_s: elapsed },
    });
  }

  if (processed > 0 || errors > 0) {
    const tgToken = getEnv('TELEGRAM_BOT_TOKEN');
    const tgChat = getEnv('TELEGRAM_CHAT_ID');
    if (tgToken && tgChat) {
      const lines = results
        .filter((r) => r.status !== 'skip')
        .map((r) => `${r.status === 'ok' ? '✅' : '❌'} ${r.profile} → ${r.conv.slice(0, 50)}`)
        .join('\n');
      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChat,
          text: `🤖 <b>Copiloto Autónomo — ciclo diario</b>\n\n✅ Generados: ${processed}\n❌ Errores: ${errors}\n⏱ Tiempo: ${elapsed}s\n\n${lines}`,
          parse_mode: 'HTML',
        }),
      }).catch(console.error);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      profiles: profiles.length,
      recent_convs: recentConvs.length,
      processed,
      errors,
      elapsed_s: elapsed,
      results,
    }),
    { status: 200 },
  );
};
