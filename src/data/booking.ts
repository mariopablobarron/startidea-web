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
