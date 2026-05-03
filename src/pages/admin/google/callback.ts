import type { APIRoute } from 'astro';
import { exchange } from '@/lib/seo/GoogleOAuthService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const expectedState = context.cookies.get('startidea_oauth_state')?.value;

  if (error) {
    return new Response(html(`<h1>Conexión cancelada</h1><p>Google devolvió: <code>${escape(error)}</code></p><p><a href="/admin/google/status">Volver</a></p>`), {
      status: 400, headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  if (!code) {
    return new Response('missing code', { status: 400 });
  }
  if (!state || state !== expectedState) {
    return new Response('invalid state (CSRF)', { status: 400 });
  }
  // limpiar cookie de state
  context.cookies.delete('startidea_oauth_state', { path: '/' });

  try {
    const { email } = await exchange(code);
    return context.redirect(`/admin/google/status?ok=1&email=${encodeURIComponent(email)}`, 302);
  } catch (err) {
    const msg = (err as Error).message || 'error desconocido';
    console.error('[google/callback]', msg);
    return new Response(html(`<h1>Error en el intercambio OAuth</h1><pre>${escape(msg)}</pre><p><a href="/admin/google/status">Volver</a></p>`), {
      status: 500, headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
};

function escape(s: string) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)); }
function html(body: string) { return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>OAuth · Startidea</title><style>body{font-family:system-ui;max-width:720px;margin:4rem auto;padding:0 1rem;line-height:1.5}code,pre{background:#f3efe8;padding:0.2em 0.4em;border-radius:3px}pre{padding:1rem;overflow:auto}</style></head><body>${body}</body></html>`; }
