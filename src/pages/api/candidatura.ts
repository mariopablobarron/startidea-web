/**
 * POST /api/candidatura
 *
 * Recibe el formulario multipart de /trabaja-con-nosotros (candidatura
 * espontánea: empleo / freelance / colaboración). Guarda los adjuntos
 * (CV, cartas, portfolio) en EXPEDIENTES_DIR/candidaturas/<id>/, registra
 * en SQLite, avisa a Mario por Telegram + email, y envía confirmación al
 * candidato. Límite 30 MB POR ARCHIVO.
 */

import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  saveCandidatura,
  countCandidaturas,
  getCandidaturasDir,
  TIPOS_CANDIDATURA,
  AREAS_CANDIDATURA,
  type Adjunto,
} from '@/lib/candidaturas-db';
import { sendTelegram } from '@/lib/telegram';
import { sendOwnerLeadEmail, sendEmail } from '@/lib/email-resend';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const prerender = false;

const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MB por archivo
const MAX_TOTAL_BYTES = 90 * 1024 * 1024; // tope total por candidatura (anti-abuso de disco)
const MAX_FILES = 12; // nº máximo de adjuntos por candidatura
// Extensiones admitidas por campo de adjunto.
const ALLOWED_EXT = new Set([
  '.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.zip', '.ppt', '.pptx',
]);
const FILE_FIELDS = ['cv', 'carta', 'portfolio', 'otros'];

const TIPO_LABEL: Record<string, string> = {
  empleo: 'Empleo',
  freelance: 'Freelance',
  colaboracion: 'Colaboración',
};

function clean(v: FormDataEntryValue | null, max = 500): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    return await handle(request, clientAddress ?? '');
  } catch (err) {
    console.error('[candidatura] error no controlado:', err);
    return new Response(JSON.stringify({ ok: false, error: 'internal' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

async function handle(request: Request, clientAddress: string): Promise<Response> {
  // Rate limit por IP: máx 4 candidaturas / hora.
  const ip = getClientIp(request) || clientAddress || 'unknown';
  const rl = rateLimit({ key: ip, bucket: 'candidatura', maxHits: 4, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: 'rate', detail: `Demasiados envíos. Inténtalo en ${Math.ceil(rl.retryAfter / 60)} min.` }),
      { status: 429, headers: { 'content-type': 'application/json', 'retry-after': String(rl.retryAfter) } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'parse' }), { status: 400 });
  }

  // Honeypot anti-spam.
  if (clean(form.get('website'))) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // Consentimiento RGPD obligatorio (se recogen datos personales + CV).
  if (form.get('consent') !== 'on' && form.get('consent') !== 'true') {
    return new Response(JSON.stringify({ ok: false, error: 'consent' }), { status: 400 });
  }

  const tipoRaw = clean(form.get('tipo'), 20);
  const tipo = (TIPOS_CANDIDATURA as readonly string[]).includes(tipoRaw) ? tipoRaw : '';
  const areaRaw = clean(form.get('area'), 60);
  const area = (AREAS_CANDIDATURA as readonly string[]).includes(areaRaw) ? areaRaw : 'Otro';
  const nombre = clean(form.get('nombre'), 120);
  const email = clean(form.get('email'), 120);
  const telefono = clean(form.get('telefono'), 30);
  const ubicacion = clean(form.get('ubicacion'), 80);
  const linkedin = clean(form.get('linkedin'), 200);
  const web = clean(form.get('web'), 200);
  const mensaje = clean(form.get('mensaje'), 2500);

  if (!tipo || !nombre || !email) {
    return new Response(JSON.stringify({ ok: false, error: 'fields' }), { status: 400 });
  }
  if (!isEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'email' }), { status: 400 });
  }

  const id = randomUUID().split('-')[0].toUpperCase();
  const dir = join(getCandidaturasDir(), id);
  const adjuntos: Adjunto[] = [];

  try {
    let created = false;
    let totalBytes = 0;
    for (const field of FILE_FIELDS) {
      for (const entry of form.getAll(field)) {
        if (!(entry instanceof File) || !entry.name || entry.size === 0) continue;
        if (entry.size > MAX_FILE_BYTES) {
          return new Response(
            JSON.stringify({ ok: false, error: 'too_large', detail: `"${entry.name}" supera el límite de 30 MB.` }),
            { status: 413, headers: { 'content-type': 'application/json' } },
          );
        }
        totalBytes += entry.size;
        if (adjuntos.length >= MAX_FILES || totalBytes > MAX_TOTAL_BYTES) {
          return new Response(
            JSON.stringify({ ok: false, error: 'too_many', detail: 'Demasiados archivos o tamaño total excesivo. Reduce los adjuntos.' }),
            { status: 413, headers: { 'content-type': 'application/json' } },
          );
        }
        if (!ALLOWED_EXT.has(extOf(entry.name))) {
          return new Response(
            JSON.stringify({ ok: false, error: 'bad_type', detail: `Formato no admitido: "${entry.name}".` }),
            { status: 415, headers: { 'content-type': 'application/json' } },
          );
        }
        if (!created) { await mkdir(dir, { recursive: true }); created = true; }
        const safe = entry.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const diskName = `${field}_${safe}`;
        await writeFile(join(dir, diskName), Buffer.from(await entry.arrayBuffer()));
        adjuntos.push({ campo: field, nombre: entry.name, archivo: diskName, kb: Math.round(entry.size / 1024) });
      }
    }
  } catch (err) {
    console.error('[candidatura] error guardando ficheros:', err);
    return new Response(JSON.stringify({ ok: false, error: 'files' }), { status: 500 });
  }

  const now = Date.now();
  try {
    saveCandidatura({
      id, tipo, area, nombre, email, telefono, ubicacion, linkedin, web, mensaje,
      adjuntos: JSON.stringify(adjuntos),
      ip,
      created_at: now,
    });
  } catch (err) {
    console.error('[candidatura] error SQLite:', err);
    return new Response(JSON.stringify({ ok: false, error: 'db' }), { status: 500 });
  }

  // ── Avisos no bloqueantes ────────────────────────────────────────────────
  const adjList = adjuntos.length
    ? adjuntos.map((a) => `${a.nombre} (${a.kb} KB)`).join(', ')
    : '— sin adjuntos —';

  try {
    const total = countCandidaturas();
    sendTelegram(
      `<b>Nueva candidatura · ${esc(TIPO_LABEL[tipo] ?? tipo)}</b>\n` +
        `${esc(nombre)} · ${esc(email)}${telefono ? ' · ' + esc(telefono) : ''}\n` +
        `Área: ${esc(area)}${ubicacion ? ' · ' + esc(ubicacion) : ''}\n` +
        `Adjuntos: ${esc(adjList)}\n` +
        `Ref: <b>${esc(id)}</b> · Total acumulado: <b>${total}</b>`,
    ).catch(() => {});
  } catch { /* noop */ }

  sendOwnerLeadEmail({
    subject: `Nueva candidatura (${TIPO_LABEL[tipo] ?? tipo}) — ${nombre}`,
    leadName: nombre,
    leadEmail: email,
    bodyHtml: `
      <p style="margin:0 0 4px 0"><strong>${esc(nombre)}</strong> · ${esc(TIPO_LABEL[tipo] ?? tipo)} · ${esc(area)}</p>
      <p style="margin:0 0 12px 0;color:#666">${esc(email)}${telefono ? ' · ' + esc(telefono) : ''}${ubicacion ? ' · ' + esc(ubicacion) : ''}</p>
      ${linkedin ? `<p style="margin:0 0 4px 0"><strong>LinkedIn:</strong> ${esc(linkedin)}</p>` : ''}
      ${web ? `<p style="margin:0 0 4px 0"><strong>Web/Portfolio:</strong> ${esc(web)}</p>` : ''}
      <p style="margin:0 0 4px 0"><strong>Mensaje:</strong><br>${esc(mensaje) || '—'}</p>
      <p style="margin:12px 0 4px 0"><strong>Adjuntos:</strong> ${esc(adjList)}</p>
      <p style="margin:12px 0 0 0"><a href="https://startidea.es/admin/candidaturas">Ver en el panel →</a></p>
    `,
  }).catch((err) => console.error('[candidatura] email owner fail:', err));

  const firstName = nombre.split(' ')[0] || '';
  sendEmail({
    to: email,
    subject: 'Hemos recibido tu candidatura — Startidea',
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:560px">
        <p>Hola ${esc(firstName)}:</p>
        <p>Tu candidatura ha quedado registrada en Startidea. Gracias por tu interés en formar parte del proyecto.</p>
        <p>Esto es lo que pasa ahora: el equipo revisa cada candidatura recibida. Si encaja con una necesidad —ahora o más adelante—, te escribimos a este correo. Guardamos tu perfil aunque no haya un hueco inmediato.</p>
        <p>Mientras tanto, puedes conocer mejor el proyecto en <a href="https://startidea.es/sobre">sobre Startidea</a> o leer las <a href="https://startidea.es/notas">notas</a> del equipo.</p>
        <p>Cualquier cosa, responde a este correo o escribe a <a href="mailto:hola@startidea.es">hola@startidea.es</a>.</p>
        <p style="color:#666">Startidea · Innovación social, comunicación y fundraising<br>Granada · <a href="https://startidea.es">startidea.es</a></p>
      </div>
    `,
    replyTo: 'hola@startidea.es',
  }).catch((err) => console.error('[candidatura] email confirm fail:', err));

  return new Response(JSON.stringify({ ok: true, id }), { status: 200 });
}
