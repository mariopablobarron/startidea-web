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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
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
