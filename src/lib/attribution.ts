/**
 * Atribución de leads — formatea el objeto `attribution` (first-touch) que el
 * cliente captura en AnalyticsTracker.astro (utm_*, landing_page, referrer) en
 * una línea legible para la notificación de Telegram. Cierra el embudo: cada
 * lead se traza a la página y fuente que lo trajo.
 *
 * Defensivo: acepta `unknown`, ignora campos vacíos, recorta longitudes. Si no
 * hay nada útil (tráfico directo sin UTMs), devuelve '' y el caller omite la línea.
 */
interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_page?: string;
  referrer?: string;
}

function clip(s: unknown, max: number): string {
  return typeof s === 'string' ? s.trim().slice(0, max) : '';
}

export function formatAttribution(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const a = raw as Attribution;
  const parts: string[] = [];
  const source = clip(a.utm_source, 60);
  const medium = clip(a.utm_medium, 60);
  const campaign = clip(a.utm_campaign, 80);
  const content = clip(a.utm_content, 60);
  const landing = clip(a.landing_page, 80);
  const referrer = clip(a.referrer, 120);

  if (source) parts.push(`fuente=${source}`);
  if (medium) parts.push(`medio=${medium}`);
  if (campaign) parts.push(`campaña=${campaign}`);
  if (content) parts.push(`contenido=${content}`);
  if (landing) parts.push(`landing=${landing}`);
  // El referrer solo aporta si no hay UTMs (evita ruido cuando ya sabemos la campaña).
  if (referrer && !source) parts.push(`ref=${referrer}`);

  return parts.join(' · ');
}
