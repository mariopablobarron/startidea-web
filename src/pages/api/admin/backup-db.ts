/**
 * GET /api/admin/backup-db
 *
 * Descarga el archivo expedientes.db como backup.
 * Solo accesible con ADMIN_TOKEN.
 *
 * Uso desde la VPS para backup automático:
 *   curl -H "x-admin-token: SHA256_TOKEN" https://startidea.es/api/admin/backup-db \
 *     -o /data/backups/expedientes-$(date +%Y%m%d).db
 */
import type { APIRoute } from 'astro';
import { isValidAdminHeader } from '@/lib/admin-session';
import { backupDb } from '@/lib/expedientes-db';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  // Backup online consistente: NO leer el .db principal con readFileSync.
  // En modo WAL los writes recientes viven en expedientes.db-wal hasta el
  // checkpoint, así que un read directo del .db puede dar una copia
  // incompleta. backupDb() usa la API .backup() de better-sqlite3, que
  // produce un snapshot completo y coherente a un archivo temporal.
  const tmpPath = join(tmpdir(), `expedientes-backup-${Date.now()}.db`);
  try {
    await backupDb(tmpPath);
    const data = readFileSync(tmpPath);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(data, {
      status: 200,
      headers: {
        'content-type':        'application/octet-stream',
        'content-disposition': `attachment; filename="expedientes-${date}.db"`,
        'content-length':      String(data.byteLength),
        'cache-control':       'no-store',
      },
    });
  } catch (err) {
    console.error('[backup-db]', err);
    return new Response(JSON.stringify({ error: 'backup_failed' }), { status: 500 });
  } finally {
    try { if (existsSync(tmpPath)) unlinkSync(tmpPath); } catch { /* limpieza best-effort */ }
  }
};
