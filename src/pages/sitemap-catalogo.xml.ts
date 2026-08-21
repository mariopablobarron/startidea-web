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
import { listConvocatoriasActivas, isConvocatoriaVigente } from '@/lib/expedientes-db';
import { SITE_URL } from '@/lib/jsonld';

export const prerender = false;

export const GET: APIRoute = async () => {
  let convs: ReturnType<typeof listConvocatoriasActivas> = [];
  try { convs = listConvocatoriasActivas(); } catch {}

  // `activa = 1` es una marca manual y no caduca sola: una convocatoria puede
  // seguir marcada activa con el plazo vencido. El sitemap solo debe anunciar
  // lo que la ficha va a servir en index — mismo criterio que el `noindex` de
  // /subvenciones/catalogo/[slug].
  convs = convs.filter((c) => isConvocatoriaVigente(c));

  const today = new Date().toISOString().split('T')[0];

  // Páginas SSR (prerender=false) que NO cubre el sitemap estático de
  // @astrojs/sitemap. /precios es la landing de "cuánto cuesta tramitar una
  // subvención a éxito" — indexable y de alta intención, pero invisible al
  // crawler sin este alta manual.
  const staticSsr = [
    { loc: `${SITE_URL}/precios`, changefreq: 'monthly', priority: '0.8' },
  ];

  const urlEntries = [
    // Índice del catálogo
    `  <url>
    <loc>${SITE_URL}/subvenciones/catalogo</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`,
    // Páginas SSR sueltas de alta intención
    ...staticSsr.map(s => `  <url>
    <loc>${s.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${s.changefreq}</changefreq>
    <priority>${s.priority}</priority>
  </url>`),
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
