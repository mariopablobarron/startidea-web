/**
 * GET /sitemap-catalogo.xml
 *
 * Sitemap dinámico SSR para las páginas del catálogo propio de Startidea.
 * Las páginas /subvenciones/catalogo/[slug] son SSR (prerender=false) y
 * no aparecen en el sitemap estático de @astrojs/sitemap, así que este
 * endpoint genera el XML en tiempo real leyendo las convocatorias activas
 * del SQLite local.
 *
 * Referenciado en robots.txt:
 *   Sitemap: https://startidea.es/sitemap-catalogo.xml
 *
 * Cache: 1h (las convocatorias cambian poco durante el día).
 */
import type { APIRoute } from 'astro';
import { listConvocatoriasActivas } from '@/lib/expedientes-db';
import { SITE_URL } from '@/lib/jsonld';

export const prerender = false;

export const GET: APIRoute = async () => {
  let convs: ReturnType<typeof listConvocatoriasActivas> = [];
  try { convs = listConvocatoriasActivas(); } catch {}

  const today = new Date().toISOString().split('T')[0];

  const urlEntries = [
    // Índice del catálogo
    `  <url>
    <loc>${SITE_URL}/subvenciones/catalogo</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`,
    // Una entrada por convocatoria activa
    ...convs.map(c => `  <url>
    <loc>${SITE_URL}/subvenciones/catalogo/${c.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`),
  ].join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
