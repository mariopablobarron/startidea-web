import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

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
    '/instagram-cambia-su-formato-el-43-reemplaza-al-cuadrado':                   '/notas',

    // Categorías de WP — redirigir a /notas
    '/category/news':                                     '/notas',
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      filter: (page) => {
        // Excluir siempre rutas internas/admin/utilidad
        if (page.includes('/admin/'))              return false;
        if (page.includes('/api/'))                return false;
        if (page.includes('/404'))                 return false;
        if (page.includes('/recursos/gracias'))    return false;
        // Páginas de formularios y confirmaciones (noindex)
        if (page.includes('/diagnostico/'))        return false;
        if (page.includes('/presupuesto/nuevo'))   return false;
        if (page.includes('/encuesta-fundraising')) return false;
        // Subvenciones: excluir páginas individuales del scraper BDNS (~2100 URLs)
        // Solo conservar: index · curated landings (boja-2026-*) · mapa
        if (page.includes('/subvenciones/')) {
          if (page.endsWith('/subvenciones/') || page.endsWith('/subvenciones'))
            return true;  // índice/buscador
          if (page.includes('/subvenciones/boja-2026'))    return true; // landings curadas
          if (page.includes('/subvenciones/mapa'))         return true; // mapa interactivo
          return false; // todo lo demás (BDNS individual, crear-alerta, mi-alerta, mi-copiloto, etc.)
        }
        return true;
      },
    }),
  ],
});
