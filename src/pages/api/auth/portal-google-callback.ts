// GET /api/auth/portal-google-callback?code=...&state=...
//
// Callback OAuth de Google para el portal de clientes.
//
// Flujo:
//  1. Intercambia el código por access_token
//  2. Obtiene el email verificado del usuario de Google
//  3a. Si el email ya tiene expedientes o perfil → sesión portal directa
//  3b. Si es la primera vez → redirige al registro con el email prellenado
//
// Usa las mismas credenciales que el admin:
//   GOOGLE_ADMIN_CLIENT_ID / GOOGLE_ADMIN_CLIENT_SECRET

import type { APIRoute } from 'astro';
import {
  emailHasPortalAccess,
  createPortalSession,
} from '../../../lib/expedientes-db';

export const prerender = false;

const REDIRECT_URI  = 'https://startidea.es/api/auth/portal-google-callback';
const PORTAL_COOKIE = 'startidea_portal';
const COOKIE_MAX_AGE = 7 * 24 * 3600; // 7 días

function env(key: string): string {
  return (
    (import.meta as { env?: Record<string, string> }).env?.[key] ??
    process.env[key] ??
    ''
  );
}

function portalError(code: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/portal?m=${encodeURIComponent(code)}` },
  });
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const clientId     = env('GOOGLE_ADMIN_CLIENT_ID');
  const clientSecret = env('GOOGLE_ADMIN_CLIENT_SECRET');

  if (!clientId || !clientSecret) return portalError('oauth_not_configured');

  const code       = url.searchParams.get('code');
  const state      = url.searchParams.get('state') ?? '';
  const oauthError = url.searchParams.get('error');

  if (oauthError || !code) return portalError('oauth_denied');

  // ── 1. Intercambiar código por access_token ────────────────────────────
  let accessToken: string;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('[portal-google-callback] token exchange:', await tokenRes.text());
      return portalError('oauth_error');
    }

    const tokens = await tokenRes.json() as { access_token?: string };
    accessToken   = tokens.access_token ?? '';
    if (!accessToken) return portalError('oauth_error');
  } catch (err) {
    console.error('[portal-google-callback]', err);
    return portalError('oauth_error');
  }

  // ── 2. Obtener email del usuario ───────────────────────────────────────
  let email: string;
  let verified: boolean;
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) return portalError('oauth_error');

    const user = await userRes.json() as { email?: string; verified_email?: boolean };
    email    = (user.email ?? '').toLowerCase().trim();
    verified = user.verified_email ?? false;
  } catch {
    return portalError('oauth_error');
  }

  if (!email || !verified) return portalError('oauth_unverified');

  // ── 3. ¿Tiene acceso al portal? ────────────────────────────────────────
  const access = emailHasPortalAccess(email);

  if (!access.registered && !access.hasExpedientes) {
    // Primera vez: redirigir al registro con el email prellenado
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/portal/registro?email=${encodeURIComponent(email)}&via=google`,
      },
    });
  }

  // ── 4. Crear sesión portal y setear cookie ─────────────────────────────
  const sessionToken = createPortalSession(email);
  cookies.set(PORTAL_COOKIE, sessionToken, {
    httpOnly:  true,
    secure:    true,
    sameSite:  'lax',
    path:      '/',
    maxAge:    COOKIE_MAX_AGE,
  });

  // ── 5. Redirigir al destino ────────────────────────────────────────────
  let next = '/portal/dashboard';
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    if (decoded.startsWith('/portal')) next = decoded;
  } catch { /* state inválido → /portal/dashboard */ }

  return new Response(null, { status: 302, headers: { Location: next } });
};
