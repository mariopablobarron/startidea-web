/**
 * Predicado de publicación para content collections (notas + diagnósticos).
 *
 * Una pieza es visible en producción cuando:
 *   1. NO es borrador  (draft: false), Y
 *   2. su fecha de publicación ya llegó  (pubDate <= ahora).
 *
 * La condición de fecha habilita el GOTEO PROGRAMADO: una pieza con
 * `draft: false` y `pubDate` futura queda oculta hasta ese día. Como el sitio
 * es `output: 'static'`, el "ahora" se evalúa en BUILD-TIME — por eso el goteo
 * necesita un rebuild diario en la VPS (cron) que reconstruya el contenedor
 * para que las piezas cuya fecha ha llegado entren solas. Ver
 * `scripts/rebuild-diario.sh` y la sección "Goteo de contenido" en CLAUDE.md.
 *
 * Los paneles /admin llaman a getCollection SIN este filtro a propósito:
 * deben ver todo, incluidos borradores y piezas programadas.
 */
export function esPublicado(data: { draft?: boolean; pubDate: Date }): boolean {
  return !data.draft && data.pubDate.getTime() <= Date.now();
}
