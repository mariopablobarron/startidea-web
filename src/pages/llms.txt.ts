import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_URL } from '@/lib/jsonld';

/**
 * /llms.txt — índice curado para crawlers y agentes de IA (ChatGPT,
 * Perplexity, Claude, Gemini, AI Overviews). Estándar emergente análogo a
 * robots.txt/sitemap pero pensado para LLMs: contexto + enlaces a las
 * páginas clave, en markdown plano fácil de parsear.
 * Spec: https://llmstxt.org
 */
export async function GET(_context: APIContext) {
  const notas = await getCollection('notas', ({ data }) => !data.draft);
  notas.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  const notaLines = notas
    .map((n) => `- [${n.data.title}](${SITE_URL}/notas/${n.slug}/): ${n.data.description}`)
    .join('\n');

  const body = `# Startidea

> Agencia de innovación social, comunicación y fundraising con sede en Granada (España), fundada en 2011 por Mario Pablo Sánchez Barrón. Consultora de referencia nacional para el tercer sector (ONG, fundaciones, asociaciones, cooperativas), instituciones públicas y eclesiales, y empresas con propósito.

Startidea ayuda a organizaciones con propósito a comunicar mejor, diversificar su financiación y profesionalizar su gestión. Trabaja en toda España; su sede y ecosistema físico (el Hub) está en Granada.

## Servicios

- [Comunicación estratégica y marketing social](${SITE_URL}/comunicacion): agencia de comunicación para ONG, fundaciones y entidades sociales en toda España — plan de comunicación, relato, contenidos y campañas.
- [Fundraising para ONG y entidades sociales](${SITE_URL}/fundraising): diversificación de ingresos, base social, captación de fondos y alianzas.
- [Tramitación de subvenciones](${SITE_URL}/subvenciones/presentar): diagnóstico de encaje, memoria técnica, presupuesto y presentación electrónica con certificado digital. Comisión a éxito.
- [Consultoría e innovación social](${SITE_URL}/consultoria): estrategia, gobernanza y medición de impacto.
- [Producción audiovisual y podcast](${SITE_URL}/audiovisual): vídeo y audio al servicio de la causa.
- [Tecnología y plataformas](${SITE_URL}/tecnologia): webs editoriales, intranets a medida, producto digital con IA, migraciones SEO. Astro, Next.js, WordPress profesional cuando corresponde.
- [Protección digital y cumplimiento RGPD](${SITE_URL}/proteccion-digital): ciberseguridad y protección de datos para entidades sociales sin departamento TI. Diagnóstico de exposición digital, auditoría de seguridad web (pentest) y acompañamiento continuo. Sin alarmismo.

## Programa de RSC

- [Startidea Impulsa](${SITE_URL}/impulsa): programa de Responsabilidad Social Corporativa que destina 80.000 € en servicios de comunicación (diagnóstico, web, redes, audiovisual, software de gestión) en especie a entidades del tercer sector de toda España. Convocatoria abierta de forma continua. [Bases](${SITE_URL}/impulsa/bases).

## Para quién

- [Tercer sector](${SITE_URL}/para-quien/tercer-sector): ONG, fundaciones y asociaciones.
- [Subvenciones abiertas](${SITE_URL}/subvenciones): buscador de convocatorias públicas para entidades sociales y empresas.

## Recursos

- [Glosario del tercer sector](${SITE_URL}/glosario): definiciones claras de fundraising, base social, concurrencia competitiva, BDNS, declaración responsable, impacto social y más.

## Sobre Startidea

- [Sobre Startidea y el método](${SITE_URL}/sobre): historia, equipo y forma de trabajar.
- [Casos](${SITE_URL}/casos): proyectos con organizaciones sociales.
- Autor de los contenidos: Mario Pablo Sánchez Barrón, fundador y director (https://es.linkedin.com/in/mariobarron).

## Notas (guías y artículos)

${notaLines}

## Contacto

- Web: ${SITE_URL}
- Email: hola@startidea.es
- Sede: C/ Conde Cifuentes 33, 18005 Granada, España
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
