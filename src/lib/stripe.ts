/**
 * Cliente Stripe (lazy). La clave secreta vive SOLO en el env del container
 * (STRIPE_SECRET_KEY) — nunca en el repo. Si no está configurada, getStripe()
 * devuelve null y los endpoints degradan con elegancia (fallback a contacto).
 */

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function stripeSecret(): string {
  return process.env.STRIPE_SECRET_KEY ?? '';
}

export function webhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? '';
}

export function hasStripe(): boolean {
  return Boolean(stripeSecret());
}

/** Devuelve el cliente Stripe o null si no hay clave configurada. */
export function getStripe(): Stripe | null {
  const key = stripeSecret();
  if (!key) return null;
  if (_stripe) return _stripe;
  // Sin fijar apiVersion: usa la versión por defecto de la cuenta.
  _stripe = new Stripe(key);
  return _stripe;
}
