/**
 * POST /api/curso-checkout
 *
 * Crea una sesión de Stripe Checkout para cobrar la SEÑAL de reserva de plaza
 * de un curso del Lab y redirige a la pasarela. La reserva queda 'pendiente'
 * hasta que el webhook confirma el pago.
 *
 * Si Stripe no está configurado (sin STRIPE_SECRET_KEY), degrada con elegancia
 * redirigiendo al formulario de contacto con el curso preseleccionado.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { randomUUID } from 'node:crypto';
import { getStripe, hasStripe } from '@/lib/stripe';
import { createReserva } from '@/lib/cursos-db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress, redirect }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const slug = String(form.get('slug') ?? '').trim().slice(0, 120);
  const esfl = form.get('esfl') === 'on' || form.get('esfl') === 'true' ? 1 : 0;
  if (!slug) return redirect('/laboratorio/cursos');

  // Fallback elegante si aún no hay Stripe configurado.
  if (!hasStripe()) {
    return redirect(`/contacto?curso=${encodeURIComponent(slug)}&ref=curso`);
  }

  // Rate-limit suave: evita que un bot cree sesiones en bucle.
  const ip = getClientIp(request) || clientAddress || 'unknown';
  const rl = rateLimit({ key: ip, bucket: 'curso-checkout', maxHits: 8, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return new Response('Demasiados intentos. Espera un momento.', { status: 429 });
  }

  // Curso autoritativo desde la colección (nunca confiar en el precio del cliente).
  // Se busca por .slug igual que getStaticPaths, para evitar la ambigüedad
  // slug/id de getEntry en Astro 5.
  const cursos = await getCollection('cursos', (c) => !c.data.draft);
  const curso = cursos.find((c) => c.slug === slug);
  if (!curso || curso.data.estado === 'agotado') {
    return redirect(`/laboratorio/cursos/${encodeURIComponent(slug)}`);
  }

  const senalEur = curso.data.senal ?? 50;
  const amountCents = Math.round(senalEur * 100);
  const title = curso.data.title;
  const origin = new URL(request.url).origin;

  const stripe = getStripe();
  if (!stripe) return redirect(`/contacto?curso=${encodeURIComponent(slug)}&ref=curso`);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'es',
      billing_address_collection: 'auto',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: amountCents,
            product_data: {
              name: `Señal de reserva — ${title}`,
              description: 'Depósito para reservar plaza. Se descuenta del precio total al confirmarse la edición.',
            },
          },
        },
      ],
      success_url: `${origin}/laboratorio/cursos/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/laboratorio/cursos/${encodeURIComponent(slug)}`,
      metadata: { slug, title, esfl: String(esfl) },
    });

    createReserva({
      id: randomUUID().split('-')[0].toUpperCase(),
      curso_slug: slug,
      curso_title: title,
      esfl,
      senal_cents: amountCents,
      stripe_session_id: session.id,
      created_at: Date.now(),
    });

    if (!session.url) return redirect(`/laboratorio/cursos/${encodeURIComponent(slug)}`);
    return redirect(session.url, 303);
  } catch (err) {
    console.error('[curso-checkout] error creando sesión:', err);
    return redirect(`/contacto?curso=${encodeURIComponent(slug)}&ref=curso`);
  }
};
