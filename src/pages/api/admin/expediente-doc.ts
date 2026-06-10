import type { APIRoute } from 'astro';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { getExpediente } from '@/lib/expedientes-db';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';

export const prerender = false;

const EXPEDIENTES_DIR = process.env.EXPEDIENTES_DIR ?? '/data/expedientes';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Reconstruye el nombre del archivo en disco a partir de la entrada de
// docs_adjuntos ("campo: nombre-original.pdf (123 KB)") replicando la
// sanitización del endpoint de subida (expediente.ts).
function diskNameFrom(entry: string): string | null {
  const sep = entry.indexOf(': ');
  if (sep === -1) return null;
  const fieldName = entry.slice(0, sep).trim();
  let original = entry.slice(sep + 2);
  const sizeIdx = original.lastIndexOf(' (');
  if (sizeIdx !== -1) original = original.slice(0, sizeIdx);
  const safe = original.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!fieldName || !safe) return null;
  return `${fieldName}_${safe}`;
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  if (!isAdminLoggedIn(cookies)) {
    return redirect('/admin/login?next=' + encodeURIComponent('/admin/expedientes'));
  }

  const id = (url.searchParams.get('id') ?? '').trim();
  const idx = parseInt(url.searchParams.get('i') ?? '', 10);
  if (!id || Number.isNaN(idx)) {
    return new Response('Parámetros inválidos', { status: 400 });
  }

  const exp = getExpediente(id);
  if (!exp) return new Response('Expediente no encontrado', { status: 404 });

  let docs: string[] = [];
  try { docs = JSON.parse(exp.docs_adjuntos || '[]'); } catch { /* vacío */ }
  const entry = docs[idx];
  if (!entry) return new Response('Documento no encontrado', { status: 404 });

  const diskName = diskNameFrom(entry);
  if (!diskName) return new Response('Documento ilegible', { status: 404 });

  const dir = join(EXPEDIENTES_DIR, `${exp.id}-${exp.org_cif}`);
  const filePath = join(dir, diskName);
  // Defensa anti path-traversal: el archivo debe quedar dentro de su carpeta.
  if (!resolve(filePath).startsWith(resolve(dir) + '/')) {
    return new Response('Ruta inválida', { status: 400 });
  }

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    return new Response('El archivo ya no está disponible en el servidor', { status: 404 });
  }

  const ext = extname(diskName).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  // Nombre legible para la descarga (el original sin el prefijo de campo).
  const downloadName = diskName.replace(/^[^_]+_/, '');

  return new Response(data as any, {
    headers: {
      'Content-Type': mime,
      // inline = previsualiza en el navegador (PDF/imágenes); el resto descarga.
      'Content-Disposition': `inline; filename="${downloadName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
};
