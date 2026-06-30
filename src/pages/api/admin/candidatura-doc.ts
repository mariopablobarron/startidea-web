/**
 * GET /api/admin/candidatura-doc?id=<id>&i=<idx>
 *
 * Descarga protegida de un adjunto de una candidatura. Solo admin.
 * Lee el nombre en disco directamente del array `adjuntos` (campo `archivo`)
 * y sirve el fichero desde EXPEDIENTES_DIR/candidaturas/<id>/.
 */

import type { APIRoute } from 'astro';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { getCandidatura, getCandidaturasDir, type Adjunto } from '@/lib/candidaturas-db';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';

export const prerender = false;

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.rtf': 'application/rtf',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  if (!isAdminLoggedIn(cookies)) {
    return redirect('/admin/login?next=' + encodeURIComponent('/admin/candidaturas'));
  }

  const id = (url.searchParams.get('id') ?? '').trim();
  const idx = parseInt(url.searchParams.get('i') ?? '', 10);
  if (!id || Number.isNaN(idx)) {
    return new Response('Parámetros inválidos', { status: 400 });
  }

  const cand = getCandidatura(id);
  if (!cand) return new Response('Candidatura no encontrada', { status: 404 });

  let adjuntos: Adjunto[] = [];
  try { adjuntos = JSON.parse(cand.adjuntos || '[]'); } catch { /* vacío */ }
  const adj = adjuntos[idx];
  if (!adj || !adj.archivo) return new Response('Adjunto no encontrado', { status: 404 });

  const dir = join(getCandidaturasDir(), cand.id);
  const filePath = join(dir, adj.archivo);
  // Defensa anti path-traversal: el archivo debe quedar dentro de su carpeta.
  if (!resolve(filePath).startsWith(resolve(dir) + '/')) {
    return new Response('Ruta inválida', { status: 400 });
  }

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    return new Response('Archivo no disponible', { status: 404 });
  }

  const ext = extname(adj.archivo).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  const downloadName = adj.nombre || adj.archivo;

  return new Response(data as any, {
    headers: {
      'content-type': mime,
      'content-disposition': `attachment; filename="${downloadName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
      'cache-control': 'private, no-store',
    },
  });
};
