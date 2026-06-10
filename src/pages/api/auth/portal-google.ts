// GET /api/auth/portal-google
//
// Inicia el flujo OAuth 2.0 de Google para el portal de clientes.
// Usa las mismas credenciales que el admin (GOOGLE_ADMIN_CLIENT_ID/SECRET)
// pero con un redirect_uri distinto registrado en Google Cloud Console:
//   https://startidea.es/api/auth/portal-google-callback

import type { APIRoute } from 'astro';

export const prerender = false;

const REDIRECT_URI = 'https://startidea.es/api/auth/portal-google-callback';

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
    return new Response(null, {
      status: 302,
      headers: { Location: '/portal?m=oauth_not_configured' },
    });
  }

  const next  = url.searchParams.get('next') ?? '/portal/dashboard';
  const state = Buffer.from(next.startsWith('/portal') ? next : '/portal/dashboard').toString('base64url');

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'openid email',
    access_type:   'online',
    state,
    prompt:        'select_account',
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` },
  });
};
