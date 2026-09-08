/**
 * POST /api/stripe-webhook
 *
 * Recibe eventos de Stripe. Verifica la firma con STRIPE_WEBHOOK_SECRET usando
 * el cuerpo CRUDO (request.text()). En 'checkout.session.completed' con pago
 * confirmado: marca la reserva 'pagada', avisa a Mario (Telegram + email) y
 * envía confirmación al alumno. Es la fuente de verdad del pago.
 *
 * Configurar en Stripe Dashboard → Developers → Webhooks:
 *   endpoint: https://startidea.es/api/stripe-webhook
 *   evento:   checkout.session.completed
 */

import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { getStripe, webhookSecret } from '@/lib/stripe';
import { markReservaPaid } from '@/lib/cursos-db';
import { sendTelegram } from '@/lib/telegram';
import { sendOwnerLeadEmail, sendEmail } from '@/lib/email-resend';
import { getProfileById, getProfileByStripeCustomer, setProfilePlan } from '@/lib/auto-copiloto-db';
import { COPILOTO_PLANS, isCopilotoPlan } from '@/lib/copiloto-pro';
import { getPedido as getMemoriaPedido, markPaid as markMemoriaPaid } from '@/lib/memorias-db';
import { MEMORIA_TIPOS } from '@/lib/memorias-engine';

/**
 * Copiloto Pro: sincroniza el plan del perfil con la suscripción de Stripe.
 * Lo llaman checkout.session.completed (alta) y customer.subscription.* (renovación,
 * impago, baja). Idempotente: escribir el mismo plan dos veces no cambia nada.
 */
function syncCopilotoPlan(sub: Stripe.Subscription, profileIdHint?: string | null): { profile: string; plan: string } | null {
  const profileId = profileIdHint || sub.metadata?.profile_id || null;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
  const profile = (profileId ? getProfileById(profileId) : null) ?? (customerId ? getProfileByStripeCustomer(customerId) : null);
  if (!profile) return null;
  const requested = sub.metadata?.plan;
  const active = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
  const plan = active && isCopilotoPlan(requested) && requested !== 'free' ? requested : 'free';
  const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
  const periodEnd = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null;
  setProfilePlan(profile.id, {
    plan,
    plan_until: plan === 'free' ? null : periodEnd,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
  });
  return { profile: profile.org_nombre, plan };
}

export const prerender = false;

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export const POST: APIRoute = async ({ request }) => {
  const stripe = getStripe();
  const secret = webhookSecret();
  if (!stripe || !secret) {
    return new Response('stripe no configurado', { status: 500 });
  }

  const sig = request.headers.get('stripe-signature') ?? '';
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return new Response('sin cuerpo', { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[stripe-webhook] firma inválida:', err);
    return new Response('firma inválida', { status: 400 });
  }

  // ── Copiloto Pro: suscripciones ──────────────────────────────────────────
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    if (sub.metadata?.kind === 'copiloto_pro') {
      const r = syncCopilotoPlan(sub);
      if (r && event.type !== 'customer.subscription.updated') {
        sendTelegram(`<b>🧭 Copiloto Pro</b> · ${esc(r.profile)} → plan <b>${esc(r.plan)}</b> (${esc(event.type)})`).catch(() => {});
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    // ── Generador de memorias: pago único del documento ────────────────────
    if (session.metadata?.kind === 'memoria') {
      if (session.payment_status === 'paid') {
        const pedidoId = session.metadata?.pedido_id ?? '';
        const pedido = pedidoId ? getMemoriaPedido(pedidoId) : null;
        if (pedido && markMemoriaPaid(pedido.id)) {
          const def = MEMORIA_TIPOS[pedido.tipo];
          sendTelegram(
            `<b>💳 Documento pagado</b> · ${esc(def.nombre)} · ${esc(pedido.org_nombre)} · ${esc(((session.amount_total ?? 0) / 100).toFixed(2))} € · ${esc(pedido.id)}`,
          ).catch(() => {});
        }
      }
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (session.metadata?.kind === 'copiloto_pro') {
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId);
          const r = syncCopilotoPlan(sub, session.metadata?.profile_id ?? null);
          if (r) {
            const planDef = isCopilotoPlan(r.plan) ? COPILOTO_PLANS[r.plan] : null;
            sendTelegram(
              `<b>💳 Copiloto Pro contratado</b>\n${esc(r.profile)} · ${esc(planDef?.nombre ?? r.plan)} · ${esc(String(planDef?.precioEur ?? ''))} €/mes`,
            ).catch(() => {});
          }
        } catch (err) {
          console.error('[stripe-webhook] copiloto_pro subscription:', err);
        }
      }
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (session.payment_status === 'paid') {
      const email = session.customer_details?.email ?? '';
      const nombre = session.customer_details?.name ?? '';
      const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : '';
      const title = session.metadata?.title ?? session.metadata?.slug ?? 'curso';
      const esfl = session.metadata?.esfl === '1';
      const totalEur = ((session.amount_total ?? 0) / 100).toFixed(2);

      let result;
      try {
        result = markReservaPaid(session.id, paymentIntent, nombre, email, Date.now());
      } catch (err) {
        console.error('[stripe-webhook] error marcando pagada:', err);
      }

      // Stripe reintenta el mismo evento: si ya estaba pagada (no hubo
      // transición) y hay registro, hacemos ACK sin volver a notificar.
      if (result && !result.transitioned && result.reserva) {
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      const reserva = result?.reserva;

      // Avisos no bloqueantes.
      try {
        sendTelegram(
          `<b>💳 Reserva de curso pagada</b>\n` +
            `${esc(title)}\n` +
            `${esc(nombre || '—')} · ${esc(email || '—')}${esfl ? ' · ESFL' : ''}\n` +
            `Señal: <b>${esc(totalEur)} €</b> · ref ${esc(reserva?.id ?? session.id)}`,
        ).catch(() => {});
      } catch { /* noop */ }

      sendOwnerLeadEmail({
        subject: `Reserva pagada — ${title}`,
        leadName: nombre || email,
        leadEmail: email,
        bodyHtml: `
          <p style="margin:0 0 4px 0"><strong>${esc(title)}</strong></p>
          <p style="margin:0 0 12px 0;color:#666">${esc(nombre || '—')} · ${esc(email || '—')}${esfl ? ' · entidad sin ánimo de lucro' : ''}</p>
          <p style="margin:0 0 4px 0"><strong>Señal pagada:</strong> ${esc(totalEur)} €</p>
          <p style="margin:12px 0 0 0"><a href="https://startidea.es/admin/cursos-reservas">Ver reservas →</a></p>
        `,
      }).catch((e) => console.error('[stripe-webhook] email owner:', e));

      if (email) {
        const firstName = (nombre || '').split(' ')[0] || '';
        sendEmail({
          to: email,
          subject: `Plaza reservada — ${title}`,
          html: `
            <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:560px">
              <p>Hola ${esc(firstName)}:</p>
              <p>Tu plaza en <strong>${esc(title)}</strong> ha quedado <strong>reservada</strong>. Hemos recibido tu señal de <strong>${esc(totalEur)} €</strong>, que se descuenta del precio total cuando se confirme la edición.</p>
              <p>El equipo de Startidea te escribirá con la fecha definitiva y los detalles. Si la edición no llegara a abrirse, la señal se te devuelve íntegra.</p>
              <p>Cualquier duda, responde a este correo o escribe a <a href="mailto:hola@startidea.es">hola@startidea.es</a>.</p>
              <p style="color:#666">Startidea Lab · Granada · <a href="https://startidea.es">startidea.es</a></p>
            </div>
          `,
          replyTo: 'hola@startidea.es',
        }).catch((e) => console.error('[stripe-webhook] email alumno:', e));
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
