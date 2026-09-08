/**
 * GET /api/copiloto-pro/checkout?t=<manage_token>&plan=pro|pro_memoria
 *
 * Crea una sesión de Stripe Checkout (suscripción mensual) para pasar un
 * perfil del Copiloto Autónomo al plan Pro o Pro Memoria y redirige a la
 * pasarela. El manage_token identifica al perfil (mismo bearer que
 * /subvenciones/mi-copiloto). El plan se activa en el webhook, nunca aquí.
 *
 * Precios: STRIPE_PRICE_COPILOTO_PRO y STRIPE_PRICE_COPILOTO_PRO_MEMORIA en el
 * env del container. Sin Stripe o sin precio → redirige a contacto con el
 * asunto preparado (degradación elegante, como curso-checkout).
 */

import type { APIRoute } from 'astro';
import { getStripe, hasStripe } from '@/lib/stripe';
import { getProfileByManageToken } from '@/lib/auto-copiloto-db';
import { COPILOTO_PLANS, isCopilotoPlan } from '@/lib/copiloto-pro';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const prerender = false;

export const GET: APIRoute = async ({ request, url, clientAddress, redirect }) => {
  const token = (url.searchParams.get('t') ?? '').trim();
  const planKey = url.searchParams.get('plan') ?? 'pro';
  if (!token || !isCopilotoPlan(planKey) || planKey === 'free') {
    return redirect('/subvenciones/auto-copiloto');
  }
  const profile = getProfileByManageToken(token);
  if (!profile) return redirect('/subvenciones/auto-copiloto');

  const plan = COPILOTO_PLANS[planKey];
  const priceId = plan.priceEnv ? (process.env[plan.priceEnv] ?? '') : '';
  const contacto = `/contacto?ref=copiloto-pro&plan=${planKey}&org=${encodeURIComponent(profile.org_nombre)}`;
  if (!hasStripe() || !priceId) return redirect(contacto);

  const ip = getClientIp(request) || clientAddress || 'unknown';
  const rl = rateLimit({ key: ip, bucket: 'copiloto-pro-checkout', maxHits: 8, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return new Response('Demasiados intentos. Espera un momento.', { status: 429 });

  const stripe = getStripe();
  if (!stripe) return redirect(contacto);

  const origin = new URL(request.url).origin;
  const manageUrl = `${origin}/subvenciones/mi-copiloto?t=${encodeURIComponent(token)}`;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: profile.stripe_customer_id ? undefined : profile.email,
      customer: profile.stripe_customer_id ?? undefined,
      client_reference_id: profile.id,
      allow_promotion_codes: true,
      locale: 'es',
      success_url: `${manageUrl}&pro=ok`,
      cancel_url: `${manageUrl}&pro=cancelado`,
      metadata: { kind: 'copiloto_pro', profile_id: profile.id, plan: planKey, org: profile.org_nombre.slice(0, 100) },
      subscription_data: { metadata: { kind: 'copiloto_pro', profile_id: profile.id, plan: planKey } },
    });
    if (!session.url) return redirect(contacto);
    return redirect(session.url, 303);
  } catch (err) {
    console.error('[copiloto-pro/checkout] Stripe:', err);
    return redirect(contacto);
  }
};
