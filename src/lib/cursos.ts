/** Fechas de edición publicadas como días completos, con corte en España. */
const diaMadrid = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
});

function fechaValida(fecha: Date | undefined): fecha is Date {
  return fecha instanceof Date && Number.isFinite(fecha.getTime());
}

/** Se evalúa en cada petición; no depende de que haya otro despliegue. */
export function edicionVigente(fecha: Date | undefined, ahora = new Date()): fecha is Date {
  if (!fechaValida(fecha)) return false;
  const partes = diaMadrid.formatToParts(ahora);
  const hoy = ['year', 'month', 'day'].map((tipo) => partes.find((p) => p.type === tipo)!.value).join('-');
  return fecha.toISOString().slice(0, 10) >= hoy;
}

export function edicionFinalizada(fecha: Date | undefined, ahora = new Date()): boolean {
  return fechaValida(fecha) && !edicionVigente(fecha, ahora);
}

type EstadoCurso = 'abierto' | 'proximo' | 'a-demanda' | 'agotado';
export function estadoCursoPublico(estado: EstadoCurso, fecha: Date | undefined, ahora = new Date()) {
  return edicionFinalizada(fecha, ahora) ? 'edicion-finalizada' : estado;
}
