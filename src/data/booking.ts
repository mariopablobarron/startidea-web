/**
 * Reserva de cita (Cal.com / Calendly).
 *
 * 👉 Pega aquí tu enlace público de reserva cuando tengas el evento creado.
 *    Ejemplo Cal.com:   'https://cal.com/startidea/diagnostico-30min'
 *    Ejemplo Calendly:  'https://calendly.com/startidea/30min'
 *
 * Mientras esté vacío, los botones de reserva caen con elegancia al formulario
 * de /contacto (no se rompe nada). Es un enlace externo (se abre en pestaña
 * nueva): NO requiere tocar la CSP ni Traefik.
 */
export const BOOKING_URL = 'https://cal.com/mariopablo';

/** href del botón de reserva: el calendario si está configurado, si no /contacto. */
export function bookingHref(): string {
  return BOOKING_URL || '/contacto';
}

/** true si hay un calendario externo configurado. */
export function hasBooking(): boolean {
  return BOOKING_URL.startsWith('http');
}

/**
 * Nota fija que Cal.com vuelca en el formulario de la cita. Nunca lleva texto
 * de la persona ni el resumen: la URL se comparte, se registra en logs y
 * cabe en un tuit; el resumen ya está en el CRM del HUB y en el correo a Mario.
 */
export const BOOKING_NOTA_LAZO = 'Viene del resumen de Lazo (IA de Startidea). El resumen está en el CRM.';

/**
 * Enlace de reserva prellenado. Cal.com acepta `?name=&email=&notes=` y los
 * vuelca en el formulario de la cita. Solo viajan nombre y correo (los de la
 * propia persona, que abrirá el enlace) más la nota fija BOOKING_NOTA_LAZO.
 * Sin calendario configurado cae a /contacto, igual que bookingHref().
 */
export function bookingHrefWith(p: { name?: string; email?: string }): string {
  if (!hasBooking()) return '/contacto';
  const params = new URLSearchParams();
  const name = (p.name ?? '').trim().slice(0, 120);
  const email = (p.email ?? '').trim().slice(0, 120);
  if (name) params.set('name', name);
  if (email) params.set('email', email);
  params.set('notes', BOOKING_NOTA_LAZO);
  return `${BOOKING_URL}?${params.toString()}`;
}
