/**
 * GET /api/memorias/checkout?t=<manage_token>
 * Stripe Checkout (pago único) del documento. El precio es el del tipo del
 * pedido (nunca del cliente). Sin Stripe → contacto con el pedido preparado.
 */

import type { APIRoute } from 'astro';
import { getStripe, hasStripe } from '@/lib/stripe';
import { getPedidoByToken, setStripeSession } from '@/lib/memorias-db';
import { MEMORIA_TIPOS } from '@/lib/memorias-engine';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const prerender = false;

export const GET: APIRoute = async ({ request, url, clientAddress, redirect }) => {
  const token = (url.searchParams.get('t') ?? '').trim();
  const pedido = token ? getPedidoByToken(token) : null;
  if (!pedido) return redirect('/memorias');
  const manageUrl = `${url.origin}/memorias/pedido?t=${encodeURIComponent(token)}`;
  if (pedido.paid_at) return redirect(manageUrl);
  const def = MEMORIA_TIPOS[pedido.tipo];
  const contacto = `/contacto?ref=memorias&pedido=${encodeURIComponent(pedido.id)}`;
  if (!hasStripe()) return redirect(contacto);

  const ip = getClientIp(request) || clientAddress || 'unknown';
  const rl = rateLimit({ key: ip, bucket: 'memorias-checkout', maxHits: 8, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return new Response('Demasiados intentos. Espera un momento.', { status: 429 });

  const stripe = getStripe();
  if (!stripe) return redirect(contacto);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'es',
      customer_email: pedido.email,
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: pedido.precio_cents,
            product_data: {
              name: `${def.nombre} · ${pedido.org_nombre}`,
              description: `Documento completo redactado con IA y revisado por Startidea. Pedido ${pedido.id}.`,
            },
          },
        },
      ],
      success_url: `${manageUrl}&pago=ok`,
      cancel_url: `${manageUrl}&pago=cancelado`,
      metadata: { kind: 'memoria', pedido_id: pedido.id, tipo: pedido.tipo, org: pedido.org_nombre.slice(0, 100) },
    });
    setStripeSession(pedido.id, session.id);
    if (!session.url) return redirect(contacto);
    return redirect(session.url, 303);
  } catch (err) {
    console.error('[memorias/checkout] Stripe:', err);
    return redirect(contacto);
  }
};
