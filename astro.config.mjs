import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://startidea.es',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  prefetch: true,
  // Redirecciones 301 desde URLs del WordPress antiguo
  redirects: {
    '/quienessomos':                                      '/sobre',
    '/quienessomos/':                                     '/sobre',
    '/servicios':                                         '/',
    '/servicios/':                                        '/',
    '/portfolio':                                         '/casos',
    '/portfolio/':                                        '/casos',
    '/portfolio_':                                        '/casos',
    '/portfolio_/':                                       '/casos',
    '/portfolio-marketing-social':                        '/casos',
    '/portfolio-marketing-social/':                       '/casos',
    '/portfolio-audiovisual-y-podcast':                   '/casos',
    '/portfolio-audiovisual-y-podcast/':                  '/casos',
    '/blog':                                              '/notas',
    '/blog/':                                             '/notas',
    '/politicacookies':                                   '/cookies',
    '/politicacookies/':                                  '/cookies',
    '/politicaprivacidad':                                '/privacidad',
    '/politicaprivacidad/':                               '/privacidad',
    '/comunicacion-estrategica-y-marketing-social-startidea':  '/comunicacion',
    '/comunicacion-estrategica-y-marketing-social-startidea/': '/comunicacion',
    '/produccion-audiovisual-y-podcast-startidea':        '/audiovisual',
    '/produccion-audiovisual-y-podcast-startidea/':       '/audiovisual',
    '/produccion-audiovisual-y-podcast':                  '/audiovisual',
    '/produccion-audiovisual-y-podcast/':                 '/audiovisual',
    '/consultoria-e-innovacion-social':                   '/consultoria',
    '/consultoria-e-innovacion-social/':                  '/consultoria',
    '/fundraising-alianzas':                              '/fundraising',
    '/fundraising-alianzas/':                             '/fundraising',
    '/hub-startidea-espacios-y-comunidad':                '/hub',
    '/hub-startidea-espacios-y-comunidad/':               '/hub',

    // Redirecciones desde slugs antiguos de casos
    '/casos/valientes':                                   '/casos/acogimiento-familiar-granada',
    '/casos/valientes/':                                  '/casos/acogimiento-familiar-granada',
    '/casos/relevos-vida':                                '/casos',
    '/casos/relevos-vida/':                               '/casos',
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
        !page.includes('/recursos/gracias'),
    }),
  ],
});
