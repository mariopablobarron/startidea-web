import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import { readdirSync, readFileSync } from 'node:fs';

// Mapa slug→fecha de las notas (updatedDate || pubDate) para emitir <lastmod>
// en el sitemap. Frescura = re-crawl más rápido de Google/Bing y mejor señal
// para AI Overviews. Defensivo: si algo falla, se queda vacío y no rompe build.
const notaLastmod = {};
try {
  const dir = new URL('./src/content/notas/', import.meta.url);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const fm = (readFileSync(new URL(file, dir), 'utf8').split('---')[1]) || '';
    const upd = fm.match(/updatedDate:\s*['"]?(\d{4}-\d{2}-\d{2})/);
    const pub = fm.match(/pubDate:\s*['"]?(\d{4}-\d{2}-\d{2})/);
    const date = (upd && upd[1]) || (pub && pub[1]);
    if (date) notaLastmod[file.replace(/\.md$/, '')] = date;
  }
} catch {
  /* sin lastmod si no se puede leer */
}

export default defineConfig({
  site: 'https://startidea.es',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  prefetch: true,
  // Astro 5 activa security.checkOrigin: true por defecto en SSR. Esto
  // rechaza con 403 los POST de forms que no envían Origin matching, lo
  // que rompe el wizard /subvenciones/presentar/nuevo (multipart form sin
  // Origin desde la propia página) y otros formularios públicos.
  // Defensas que sí tenemos: honeypot anti-bot, rate limit por IP en
  // endpoints públicos críticos, validación server-side de campos.
  security: {
    checkOrigin: false,
  },
  // Redirecciones 301 desde URLs del WordPress antiguo.
  // Solo una versión por URL: Astro 5 con trailingSlash:'ignore' (default)
  // normaliza ambas variantes (con y sin /) desde una sola entrada.
  // Duplicar con "/" causaba colisiones de ruta en el router.
  redirects: {
    // Atajos del programa Startidea Impulsa (fáciles de dictar / cartelería)
    '/bases':                                             '/impulsa/bases',
    '/programa':                                          '/impulsa',
    '/quienessomos':                                      '/sobre',
    '/servicios':                                         '/como-trabajamos',
    '/portfolio':                                         '/casos',
    '/portfolio_':                                        '/casos',
    '/portfolio-marketing-social':                        '/casos',
    '/portfolio-audiovisual-y-podcast':                   '/casos',
    '/blog':                                              '/notas',
    '/politicacookies':                                   '/cookies',
    '/politicaprivacidad':                                '/privacidad',
    '/comunicacion-estrategica-y-marketing-social-startidea':  '/comunicacion',
    '/produccion-audiovisual-y-podcast-startidea':        '/audiovisual',
    '/produccion-audiovisual-y-podcast':                  '/audiovisual',
    '/consultoria-e-innovacion-social':                   '/consultoria',
    '/fundraising-alianzas':                              '/fundraising',
    '/hub-startidea-espacios-y-comunidad':                '/hub',

    // Redirecciones desde slugs antiguos de casos
    '/casos/valientes':                                   '/casos/acogimiento-familiar-granada',
    '/casos/relevos-vida':                                '/casos',

    // Mapa de subvenciones migrado de /laboratorio/ a /subvenciones/
    '/laboratorio/mapa-subvenciones':                     '/subvenciones/mapa',

    // Posts antiguos del blog WP que aún ranquean en GSC → al artículo equivalente
    // (NO al índice /notas: redirigir una página que rankea a un índice no
    // relacionado = soft-404 y Google acaba tirando el ranking). La de cultura
    // participativa es la mejor página no-marca: 185 impr / 6 clics / pos 9.1.
    '/que-es-la-cultura-participativa-y-como-implantarla-en-las-organizaciones':  '/notas/cultura-participativa-tercer-sector',
    // Post viejo de Instagram → página de servicio temática (redes sociales),
    // no al índice /notas (soft-404, ver nota de arriba).
    '/instagram-cambia-su-formato-el-43-reemplaza-al-cuadrado':                   '/redes-sociales-granada',

    // Typo corregido en slug de diagnóstico publicado (andaluzia → andaluza)
    '/laboratorio/fundraising/asociacion-discapacidad-andaluzia': '/laboratorio/fundraising/asociacion-discapacidad-andaluza',

    // Categorías de WP — redirigir a /notas
    '/category/news':                                     '/notas',
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      serialize(item) {
        // Inyecta <lastmod> en las notas a partir de su fecha de frontmatter.
        const m = item.url.match(/\/notas\/([^/]+)\/?$/);
        if (m && notaLastmod[m[1]]) item.lastmod = notaLastmod[m[1]];
        return item;
      },
      filter: (page) => {
        // Excluir siempre rutas internas/admin/utilidad
        if (page.includes('/admin/'))              return false;
        if (page.includes('/api/'))                return false;
        if (page.includes('/404'))                 return false;
        if (page.includes('/recursos/gracias'))    return false;
        // Páginas de formularios y confirmaciones (noindex).
        // OJO: excluir subpáginas del árbol/brief, pero NO la landing /diagnostico
        // (indexable, con title/description/JSON-LD propios y es el inicio del funnel).
        if (page.includes('/diagnostico/') && !/\/diagnostico\/?$/.test(page)) return false;
        if (page.includes('/presupuesto/nuevo'))   return false;
        if (page.includes('/encuesta-fundraising')) return false;
        // Portal privado: dashboard (302 a /portal) y confirmación de envío.
        // Estaban filtrándose al índice de Google. Se conservan /portal/ y
        // /portal/registro/ (landing + alta públicas).
        if (page.includes('/portal/dashboard'))    return false;
        if (page.includes('/portal/enviado'))      return false;
        // Preview interna del laboratorio inmersivo (sin contenido indexable).
        if (page.includes('/lab/inmersivo'))       return false;
        // Experimentos de home + "gracias" de cursos: son noindex; fuera del
        // sitemap para no mandar a Google señales contradictorias (noindex+sitemap).
        if (page.includes('/lab/home-immersive'))  return false;
        if (page.includes('/lab/home-journey'))    return false;
        if (page.includes('/laboratorio/cursos/gracias')) return false;
        // Subvenciones: excluir páginas individuales del scraper BDNS (~2100 URLs)
        // Solo conservar: index · curated landings (boja-2026-*) · mapa
        if (page.includes('/subvenciones/')) {
          if (page.endsWith('/subvenciones/') || page.endsWith('/subvenciones'))
            return true;  // índice/buscador
          if (page.includes('/subvenciones/boja-2026'))    return true; // landings curadas
          if (page.includes('/subvenciones/mapa'))         return true; // mapa interactivo
          // Landing de tramitación asistida (línea de negocio principal), sin el
          // wizard /nuevo ni la confirmación /gracias (noindex).
          if (page.includes('/subvenciones/presentar') && !page.includes('/nuevo') && !page.includes('/gracias'))
            return true;
          return false; // todo lo demás (BDNS individual, crear-alerta, mi-alerta, mi-copiloto, etc.)
        }
        return true;
      },
    }),
  ],
});
