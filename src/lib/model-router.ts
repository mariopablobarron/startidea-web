/**
 * model-router.ts — selección de modelo por tarea (patrón Meta-Controller /
 * deterministic-picker).
 *
 * En vez de un router automático opaco (que cambia de modelo de forma no
 * determinista y puede disparar el coste), un mapa EXPLÍCITO y predecible:
 * Haiku barato por defecto, Sonnet donde la calidad de redacción importa.
 *
 * Cada slug es override-able por variable de entorno (sin tocar código), p. ej.
 * `MODELO_REDACCION=anthropic/claude-sonnet-4.6` o `MODELO_REDACCION=anthropic/claude-haiku-4-5`
 * para revertir.
 */

export type TareaIA =
  | 'generacion' // generación principal del copiloto (probada en Haiku)
  | 'redaccion' // redacción/mejora donde importa la calidad (memoria, reflexión)
  | 'clasificacion' // tareas cortas/estructuradas (elegibilidad, leads)
  | 'estilo' // editor de estilo / constitución de marca
  | 'default';

const HAIKU = 'anthropic/claude-haiku-4-5';
const SONNET = 'anthropic/claude-sonnet-4.5';

const MAPA: Record<TareaIA, string> = {
  generacion: HAIKU,
  redaccion: SONNET,
  clasificacion: HAIKU,
  estilo: HAIKU,
  default: HAIKU,
};

/** Devuelve el slug de modelo OpenRouter para la tarea, con override por env. */
export function pickModel(tarea: TareaIA = 'default'): string {
  const envKey = `MODELO_${tarea.toUpperCase()}`;
  const override =
    typeof process !== 'undefined' && process.env ? process.env[envKey] : undefined;
  return (override && override.trim()) || MAPA[tarea] || HAIKU;
}
