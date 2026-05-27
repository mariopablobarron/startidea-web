// GET /api/auth/google?next=/admin
//
// Inicia el flujo OAuth 2.0 con Google.
// Redirige a la pantalla de consentimiento de Google; tras aprobar,
// Google llama a /api/auth/google-callback con ?code=... y ?state=...
//
// Vars necesarias en Coolify → Secrets:
//   GOOGLE_ADMIN_CLIENT_ID     — ID de cliente OAuth (Web application)
//   ADMIN_EMAIL                — email autorizado (mariopablobarron@gmail.com)

import type { APIRoute } from 'astro';

export const prerender = false;

const REDIRECT_URI = 'https://startidea.es/api/auth/google-callback';
const SCOPES = 'openid email';

function getClientId(): string {
  return (
    (import.meta as { env?: Record<string, string> }).env?.GOOGLE_ADMIN_CLIENT_ID ??
    process.env.GOOGLE_ADMIN_CLIENT_ID ??
    ''
  );
}

export const GET: APIRoute = ({ url }) => {
  const clientId = getClientId();
  if (!clientId) {
    return new Response(
      '<!doctype html><body>Google OAuth no configurado. Añade GOOGLE_ADMIN_CLIENT_ID en Coolify Secrets.</body>',
      { status: 503, headers: { 'content-type': 'text/html' } }
    );
  }

  const next = url.searchParams.get('next') ?? '/admin';
  // state = next URL en base64url para recuperarla en el callback
  const state = Buffer.from(next.startsWith('/') ? next : '/admin').toString('base64url');

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'online',
    state,
    prompt:        'select_account',
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` },
  });
};
