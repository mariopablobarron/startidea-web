/**
 * hub.ts — Fuente única de la URL base del HUB de subvenciones.
 *
 * El HUB (hub.startidea.tech) expone la API pública de subvenciones, alertas,
 * estadísticas y voz, además de /api/admin/* protegido. Antes convivían DOS
 * variables de entorno para lo mismo —PUBLIC_HUB_URL y PUBLIC_HUB_BASE_URL—
 * más algún literal hardcodeado, con riesgo de que divergieran. Aquí se
 * unifica todo en PUBLIC_HUB_URL.
 *
 * Las variables PUBLIC_ se incrustan en build (import.meta.env). En servidor
 * (SSR) además respetamos un override en runtime vía process.env. Este módulo
 * se importa solo desde código de servidor/build; los <script> de cliente leen
 * import.meta.env.PUBLIC_HUB_URL directamente (el navegador no tiene process).
 */
export const HUB_URL =
  (import.meta as { env?: Record<string, string> }).env?.PUBLIC_HUB_URL ??
  (typeof process !== 'undefined' ? process.env.PUBLIC_HUB_URL : undefined) ??
  'https://hub.startidea.tech';
