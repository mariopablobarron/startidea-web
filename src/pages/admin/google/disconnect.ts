import type { APIRoute } from 'astro';
import { revoke } from '@/lib/seo/GoogleOAuthService';
import { requireAdmin } from '@/lib/seo/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const denied = requireAdmin(context);
  if (denied) return denied;

  const data = await context.request.formData().catch(() => null);
  const id = Number(data?.get('connection_id') || 0);
  if (!id) return new Response('missing connection_id', { status: 400 });

  try {
    await revoke(id);
  } catch (err) {
    console.error('[google/disconnect]', (err as Error).message);
  }
  return context.redirect('/admin/google/status', 302);
};
