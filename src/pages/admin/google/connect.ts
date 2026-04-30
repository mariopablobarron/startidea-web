import type { APIRoute } from 'astro';
import { authUrl } from '@/lib/seo/GoogleOAuthService';
import { requireAdmin } from '@/lib/seo/auth';

export const prerender = false;

export const GET: APIRoute = (context) => {
  const denied = requireAdmin(context);
  if (denied) return denied;

  // Anti-CSRF: state aleatorio en cookie + URL
  const state = crypto.randomUUID();
  context.cookies.set('startidea_oauth_state', state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 600,
  });

  return context.redirect(authUrl(state), 302);
};
