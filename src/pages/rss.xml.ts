import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { esPublicado } from '@/lib/publicado';

export async function GET(context: APIContext) {
  const notas = await getCollection('notas', ({ data }) => esPublicado(data));
  notas.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  return rss({
    title: 'Startidea — Notas',
    description:
      'Notas mensuales sobre comunicación, estrategia y producto digital al servicio de organizaciones con propósito. Una al mes, cinco minutos, sin tracking pixels.',
    site: context.site ?? 'https://startidea.es',
    items: notas.map((nota) => ({
      title: nota.data.title,
      description: nota.data.description,
      pubDate: nota.data.pubDate,
      link: `/notas/${nota.slug}/`,
      categories: nota.data.tags,
      author: 'hola@startidea.es (Startidea)',
    })),
    customData: '<language>es-es</language>',
    stylesheet: false,
  });
}
