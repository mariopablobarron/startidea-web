/**
 * Helpers compartidos de la colección `cursos`.
 */

/**
 * ¿La edición anunciada sigue por delante?
 *
 * `proxima_edicion` es una fecha suelta del frontmatter. Sin guarda, una vez
 * pasada la fecha la web seguiría anunciándola como «próxima edición» y el
 * JSON-LD emitiría un `startDate` en el pasado, que Google lee como una
 * CourseInstance caducada.
 *
 * La comparación se hace por día en UTC: la fecha del frontmatter llega a
 * medianoche UTC, así que el día de la edición todavía cuenta como vigente.
 *
 * OJO: las páginas de cursos son estáticas, así que esto se evalúa en el
 * build. La fecha desaparece en el primer despliegue posterior a la edición,
 * no en el instante exacto. Es una red de seguridad, no un sustituto de
 * actualizar el frontmatter cuando se cierra una edición.
 */
export function edicionVigente(fecha: Date | undefined): fecha is Date {
  if (!fecha) return false;
  const hoy = new Date();
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return fecha.getTime() >= hoyUTC;
}
