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
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const reqToken = request.headers.get('x-admin-token') ?? '';
  if (!isValidAdminHeader(reqToken)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const dir    = process.env.EXPEDIENTES_DIR ?? '/data/expedientes';
  const dbPath = join(dir, 'expedientes.db');

  if (!existsSync(dbPath)) {
    return new Response(JSON.stringify({ error: 'db_not_found' }), { status: 404 });
  }

  try {
    const data = readFileSync(dbPath);
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
    return new Response(JSON.stringify({ error: 'read_failed' }), { status: 500 });
  }
};
