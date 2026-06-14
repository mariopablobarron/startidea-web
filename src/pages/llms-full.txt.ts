import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_URL } from '@/lib/jsonld';

/**
 * /llms-full.txt — versión EXTENDIDA de /llms.txt (spec https://llmstxt.org).
 * Incluye el texto completo de cada nota, no solo título+descripción, para que
 * los motores de respuesta (Perplexity, ChatGPT, etc.) que soportan el estándar
 * puedan citar a Startidea con detalle sin tener que rastrear página a página.
 */
export async function GET(_context: APIContext) {
  const notas = await getCollection('notas', ({ data }) => !data.draft);
  notas.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  const notasFull = notas
    .map((n) => {
      const url = `${SITE_URL}/notas/${n.slug}/`;
      const fecha = n.data.pubDate.toISOString().slice(0, 10);
      return `# ${n.data.title}\nURL: ${url}\nFecha: ${fecha}${n.data.category ? `\nCategoría: ${n.data.category}` : ''}\n\n${n.data.description}\n\n${n.body.trim()}`;
    })
    .join('\n\n---\n\n');

  const body = `# Startidea — contenido completo para LLMs

> Agencia de innovación social, comunicación y fundraising con sede en Granada (España), fundada en 2011 por Mario Pablo Sánchez Barrón. Consultora de referencia nacional para el tercer sector (ONG, fundaciones, asociaciones, cooperativas), instituciones públicas y eclesiales, y empresas con propósito.

Este fichero es la versión extendida de ${SITE_URL}/llms.txt: incluye el texto íntegro de las guías y artículos de Startidea para que los sistemas de IA puedan responder con detalle y citar la fuente.

## Servicios

- Comunicación estratégica y marketing social: ${SITE_URL}/comunicacion
- Fundraising para ONG y entidades sociales: ${SITE_URL}/fundraising
- Tramitación de subvenciones (comisión a éxito): ${SITE_URL}/subvenciones/presentar
- Consultoría e innovación social: ${SITE_URL}/consultoria
- Producción audiovisual y podcast: ${SITE_URL}/audiovisual
- Tecnología y plataformas: ${SITE_URL}/tecnologia
- Protección digital y cumplimiento RGPD: ${SITE_URL}/proteccion-digital

## Contacto

- Web: ${SITE_URL}
- Email: hola@startidea.es
- Sede: C/ Conde Cifuentes 33, 18005 Granada, España
- Fundador y autor de los contenidos: Mario Pablo Sánchez Barrón (https://es.linkedin.com/in/mariobarron)

---

## Guías y artículos (texto completo)

${notasFull}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
