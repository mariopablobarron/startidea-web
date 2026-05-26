import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://startidea.es',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  prefetch: true,
  // Redirecciones 301 desde URLs del WordPress antiguo.
  // Solo una versión por URL: Astro 5 con trailingSlash:'ignore' (default)
  // normaliza ambas variantes (con y sin /) desde una sola entrada.
  // Duplicar con "/" causaba colisiones de ruta en el router.
  redirects: {
    '/quienessomos':                                      '/sobre',
    '/servicios':                                         '/',
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

    // Posts antiguos del blog WP que aún ranquean en GSC
    '/que-es-la-cultura-participativa-y-como-implantarla-en-las-organizaciones':  '/notas',
    '/instagram-cambia-su-formato-el-43-reemplaza-al-cuadrado':                   '/notas',

    // Categorías de WP — redirigir a /notas
    '/category/news':                                     '/notas',
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      filter: (page) =>
        !page.includes('/admin/') &&
        !page.includes('/api/') &&
        !page.includes('/404') &&
        !page.includes('/recursos/gracias') &&
        !page.includes('/subvenciones/mi-alerta') &&
        !page.includes('/subvenciones/verificacion'),
    }),
  ],
});
