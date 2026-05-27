// GET /api/auth/google-callback?code=...&state=...
//
// Callback OAuth de Google. Intercambia el código por tokens, verifica
// que el email sea el de Mario, y establece la cookie de sesión admin.
//
// Vars necesarias en Coolify → Secrets:
//   GOOGLE_ADMIN_CLIENT_ID      — ID de cliente OAuth
//   GOOGLE_ADMIN_CLIENT_SECRET  — Secret del cliente OAuth
//   ADMIN_EMAIL                 — email autorizado (mariopablobarron@gmail.com)

import type { APIRoute } from 'astro';
import { setAdminSessionDirect } from '../../../lib/admin-session';

export const prerender = false;

const REDIRECT_URI = 'https://startidea.es/api/auth/google-callback';

function env(key: string): string {
  return (
    (import.meta as { env?: Record<string, string> }).env?.[key] ??
    process.env[key] ??
    ''
  );
}

function loginError(reason: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/admin/login?error=${encodeURIComponent(reason)}` },
  });
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const clientId     = env('GOOGLE_ADMIN_CLIENT_ID');
  const clientSecret = env('GOOGLE_ADMIN_CLIENT_SECRET');
  const adminEmail   = env('ADMIN_EMAIL') || 'mariopablobarron@gmail.com';

  if (!clientId || !clientSecret) {
    return loginError('oauth_not_configured');
  }

  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const oauthError = url.searchParams.get('error');

  if (oauthError || !code) {
    return loginError('oauth_denied');
  }

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
      console.error('[google-callback] token exchange failed:', await tokenRes.text());
      return loginError('token_exchange_failed');
    }

    const tokens = await tokenRes.json() as { access_token?: string };
    accessToken = tokens.access_token ?? '';
    if (!accessToken) return loginError('no_access_token');
  } catch (err) {
    console.error('[google-callback] token exchange error:', err);
    return loginError('token_exchange_error');
  }

  // ── 2. Obtener email del usuario ───────────────────────────────────────
  let email: string;
  let verified: boolean;
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      console.error('[google-callback] userinfo failed:', await userRes.text());
      return loginError('userinfo_failed');
    }

    const user = await userRes.json() as { email?: string; verified_email?: boolean };
    email    = user.email ?? '';
    verified = user.verified_email ?? false;
  } catch (err) {
    console.error('[google-callback] userinfo error:', err);
    return loginError('userinfo_error');
  }

  // ── 3. Verificar que es Mario ──────────────────────────────────────────
  if (!verified || email.toLowerCase() !== adminEmail.toLowerCase()) {
    console.warn('[google-callback] unauthorized email attempt:', email);
    return loginError('unauthorized_email');
  }

  // ── 4. Establecer sesión admin (misma cookie que el token manual) ──────
  const ok = setAdminSessionDirect(cookies);
  if (!ok) {
    // ADMIN_TOKEN no está configurado en el container
    return loginError('admin_token_missing');
  }

  // ── 5. Redirigir al destino original ──────────────────────────────────
  let next = '/admin';
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    if (decoded.startsWith('/')) next = decoded;
  } catch { /* state inválido → ir a /admin */ }

  return new Response(null, {
    status: 302,
    headers: { Location: next },
  });
};
