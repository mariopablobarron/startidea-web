/**
 * Datos compartidos de audiencias para /para-quien (hub) y subrutas:
 * /para-quien/tercer-sector, /para-quien/instituciones, /para-quien/empresas.
 *
 * Mantener una sola fuente de verdad para que el contenido sea consistente
 * entre el hub y las páginas dedicadas.
 */
import { organizationSchema, breadcrumbList, faqPageSchema, SITE_URL } from '@/lib/jsonld';

export type Audiencia = {
  id: 'tercer-sector' | 'instituciones' | 'empresas';
  num: string;
  tag: string;
  href: string;
  title: string;
  shortTitle: string;
  quote: string;
  body: string[];
  keywords: string[];
  avoid: string[];
  services: string[];
  // FAQ citables (GEO/AEO): preguntas espejo de las búsquedas reales, con
  // respuestas autónomas (Startidea + servicio + lugar + dato). Se renderizan
  // visibles y se emiten como FAQPage JSON-LD desde la página de la audiencia.
  faqs: { q: string; a: string }[];
  // Casos de estudio relacionados (slugs de src/data/casos.ts) — opcional
  casosRelacionados?: string[];
  // Imagen lifestyle para card en home (16:9 o 3:2 aprox)
  image?: string;
  // Texto del CTA al final
  ctaLabel: string;
  // SEO/OG
  metaTitle: string;
  metaDescription: string;
  ogEyebrow: string;
  ogTitle: string;
  ogAccent: string;
  ogSubtitle: string;
};

export const audiencias: Audiencia[] = [
  {
    id: 'tercer-sector',
    image: '/img/lifestyle/comunidad-hands.jpg',
    num: '01',
    tag: 'Tercer sector',
    href: '/para-quien/tercer-sector',
    shortTitle: 'Tercer sector',
    title: 'ONG, fundaciones y asociaciones que necesitan profesionalizar lo que cuentan.',
    quote: 'Comunicar bien no es opcional cuando lo que está en juego es tu causa.',
    body: [
      'Startidea trabaja con direcciones de comunicación, direcciones generales y patronatos de entidades del tercer sector con presupuesto y voluntad de profesionalizar su comunicación e impacto.',
      'Sabemos que vivís la tensión entre misión y eficacia. Que captáis fondos sin perder al donante histórico, que demostráis impacto a un patronato que no siempre habla el mismo idioma, que profesionalizáis vuestra comunicación digital con recursos limitados.',
      'No vamos a venderos humo de marketing. Tenemos casos parecidos al vuestro y, lo que es más importante, sabemos en qué se diferencian del que tenemos en frente.',
    ],
    keywords: ['Misión', 'Impacto', 'Comunidad', 'Transformación', 'Coherencia', 'Sostenibilidad'],
    avoid: ['"Branding" sin estrategia', 'Engagement como métrica única', 'Promesas que no se pueden cumplir'],
    services: [
      'Plan estratégico de comunicación',
      'Captación de fondos y fundraising digital',
      'Memorias e informes de impacto',
      'Producción audiovisual y podcast',
      'Profesionalización de equipo de comunicación',
    ],
    faqs: [
      {
        q: '¿Qué agencia trabaja con ONG y fundaciones del tercer sector en España?',
        a: 'Startidea es una agencia de innovación social con sede en Granada, en activo desde 2011, especializada en comunicación estratégica, fundraising y producción audiovisual para ONG, fundaciones y asociaciones del tercer sector en toda España.',
      },
      {
        q: '¿Qué necesita una ONG para profesionalizar su comunicación?',
        a: 'Una ONG que quiere profesionalizar su comunicación suele necesitar un plan estratégico de comunicación, captación de fondos (fundraising digital), memorias e informes de impacto y producción audiovisual. Startidea cubre esas líneas con un método propio y casos reales en el tercer sector.',
      },
      {
        q: '¿Cómo puede una fundación captar fondos sin depender solo de subvenciones?',
        a: 'Startidea diseña planes de fundraising a 12 meses que diversifican los ingresos de una fundación —base social de socios, donación individual, financiación pública y alianzas con empresa— para reducir la dependencia de una sola fuente y profesionalizar la captación.',
      },
      {
        q: '¿Tiene Startidea experiencia con entidades del tercer sector?',
        a: 'Sí. Startidea ha trabajado con entidades como Down Granada, Aldaima (acogimiento familiar) y Proyecto Hombre Granada, además de organizaciones estatales como Cruz Roja, Save the Children o Acción contra el Hambre.',
      },
    ],
    casosRelacionados: ['down-granada', 'acogimiento-familiar-granada', 'tres-mil-millones-latidos'],
    ctaLabel: 'Reservar diagnóstico para tercer sector',
    metaTitle: 'Tercer sector — ONG, fundaciones y asociaciones · Startidea',
    metaDescription:
      'Startidea trabaja con ONG, fundaciones y asociaciones que necesitan profesionalizar comunicación, fundraising e impacto. Casos reales, método transparente.',
    ogEyebrow: '— Para quién · Tercer sector',
    ogTitle: 'Profesionalizar lo que cuentas.',
    ogAccent: 'lo que cuentas',
    ogSubtitle:
      'ONG, fundaciones y asociaciones con presupuesto y voluntad de mover la aguja en captación, vínculo con donantes y narrativa de impacto.',
  },
  {
    id: 'instituciones',
    image: '/img/lifestyle/meeting-mesa.jpg',
    num: '02',
    tag: 'Instituciones',
    href: '/para-quien/instituciones',
    shortTitle: 'Instituciones',
    title: 'Administración pública, fundaciones públicas y entidades con base ética o religiosa.',
    quote: 'Modernizar el lenguaje sin traicionar la identidad. Es posible. Es necesario.',
    body: [
      'Responsables de áreas de comunicación, innovación social o transformación digital en administraciones, fundaciones públicas, diócesis, congregaciones, asociaciones eclesiales y plataformas confesionales.',
      'Vuestro reto: llegar a audiencias jóvenes, modernizar el lenguaje sin traicionar la identidad, justificar la inversión en comunicación ante órganos de gobierno, evaluar resultados sin desnaturalizar la misión.',
      'Conocemos vuestros códigos. No os vamos a forzar a parecer una startup. Sabemos comunicar lo que hacéis sin folclorismo ni edulcorante, con respeto a la identidad y rigor en la ejecución.',
    ],
    keywords: ['Identidad', 'Coherencia', 'Propósito', 'Evaluación', 'Rendición de cuentas', 'Narrativa institucional'],
    avoid: ['Jerga corporativa agresiva', 'Adaptaciones que descontextualizan la misión', 'Comunicación que solo busca rejuvenecer la fachada'],
    services: [
      'Estrategia de comunicación institucional',
      'Modernización de identidad sin pérdida de continuidad',
      'Producción de jornadas, congresos y publicaciones',
      'Comunicación digital con criterio editorial',
      'Acompañamiento a equipos internos',
    ],
    faqs: [
      {
        q: '¿Qué agencia ayuda a administraciones e instituciones a modernizar su comunicación?',
        a: 'Startidea, agencia de innovación social con sede en Granada (desde 2011), acompaña a administraciones públicas, fundaciones públicas y entidades de base ética o religiosa a modernizar su comunicación sin traicionar su identidad, con criterio editorial y evaluación de resultados.',
      },
      {
        q: '¿Cómo modernizar el lenguaje de una institución sin perder su identidad?',
        a: 'Startidea parte de los códigos propios de la institución y actualiza su comunicación por capas —narrativa, canales digitales y formatos— sin forzar un tono de startup ni desnaturalizar la misión, de modo que conecte con audiencias nuevas manteniendo la continuidad.',
      },
      {
        q: '¿Trabaja Startidea con instituciones eclesiales (diócesis, congregaciones)?',
        a: 'Sí. Startidea ofrece comunicación eclesial para diócesis, congregaciones, parroquias y fundaciones de la Iglesia, comunicando su misión con su propio lenguaje y con respeto a su identidad.',
      },
      {
        q: '¿Qué servicios de comunicación institucional ofrece Startidea?',
        a: 'Estrategia de comunicación institucional, modernización de identidad sin pérdida de continuidad, producción de jornadas, congresos y publicaciones, comunicación digital con criterio editorial y acompañamiento a equipos internos.',
      },
    ],
    casosRelacionados: ['granada-social-5', 'proyecto-hombre'],
    ctaLabel: 'Reservar diagnóstico institucional',
    metaTitle: 'Instituciones — Administraciones y entidades con base ética · Startidea',
    metaDescription:
      'Startidea trabaja con administraciones, fundaciones públicas y entidades de base ética o religiosa. Modernización de lenguaje sin traicionar la identidad.',
    ogEyebrow: '— Para quién · Instituciones',
    ogTitle: 'Modernizar el lenguaje. Sin traicionar la identidad.',
    ogAccent: 'Sin traicionar la identidad',
    ogSubtitle:
      'Administraciones, fundaciones públicas, diócesis, congregaciones y plataformas confesionales que quieren llegar a nuevas audiencias con rigor.',
  },
  {
    id: 'empresas',
    image: '/img/lifestyle/oficina-luz.jpg',
    num: '03',
    tag: 'Empresas con propósito',
    href: '/para-quien/empresas',
    shortTitle: 'Empresas',
    title: 'Direcciones de comunicación, sostenibilidad y RSC que quieren dejar de hacer ESG de postureo.',
    quote: 'El propósito o se demuestra o no existe. Te ayudamos a demostrarlo.',
    body: [
      'Direcciones de marketing, comunicación, sostenibilidad y RSC en empresas medianas y grandes con compromiso real con el propósito (no solo con el sello ESG).',
      'Vuestro problema: convertir el discurso ESG en hechos comunicables, evitar el greenwashing, conectar con stakeholders críticos, articular alianzas con tercer sector que tengan sentido y no sean sólo foto.',
      'Startidea aporta la red del tercer sector que tu equipo no tiene. Sabemos articular partnerships reales. Y la comunicación de propósito con Startidea no parece postureo — porque no lo es.',
    ],
    keywords: ['Propósito', 'Stakeholders', 'Impacto', 'Partnership', 'Reputación', 'Métricas'],
    avoid: ['ESG como ejercicio cosmético', 'Alianzas decorativas con ONG sin retorno mutuo', 'Reportes de sostenibilidad ilegibles'],
    services: [
      'Estrategia de propósito y narrativa ESG',
      'Articulación de partnerships con tercer sector',
      'Comunicación de impacto y reportes legibles',
      'Activación de empleados y stakeholders críticos',
      'Producción audiovisual de propósito',
    ],
    faqs: [
      {
        q: '¿Qué agencia ayuda a una empresa a comunicar su propósito y ESG sin greenwashing?',
        a: 'Startidea, agencia de innovación social con sede en Granada, ayuda a direcciones de comunicación, sostenibilidad y RSC a convertir el discurso ESG en hechos comunicables y verificables, evitando el greenwashing y conectando con stakeholders críticos.',
      },
      {
        q: '¿Cómo puede una empresa articular alianzas reales con el tercer sector?',
        a: 'Startidea aporta la red del tercer sector que el equipo interno no suele tener y articula partnerships con retorno mutuo —no fotos—, definiendo objetivos, roles y métricas de impacto compartidas entre empresa y entidad social.',
      },
      {
        q: '¿Ayuda Startidea con reportes de sostenibilidad e informes de impacto?',
        a: 'Sí. Startidea produce comunicación de impacto y reportes legibles que traducen los datos de sostenibilidad en un relato claro para consejos, empleados y stakeholders, sin la ilegibilidad habitual de las memorias ESG.',
      },
      {
        q: '¿Qué es una estrategia de propósito demostrable?',
        a: 'Es una estrategia que conecta lo que la empresa dice con lo que hace y lo hace medible: narrativa de propósito, activación de empleados, partnerships reales con tercer sector y métricas que evidencian el impacto. Startidea la diseña y la acompaña.',
      },
    ],
    casosRelacionados: ['clinica-baca', 'tres-mil-millones-latidos'],
    ctaLabel: 'Reservar diagnóstico de propósito',
    metaTitle: 'Empresas con propósito — ESG real, partnerships con tercer sector · Startidea',
    metaDescription:
      'Startidea trabaja con direcciones de comunicación, sostenibilidad y RSC en empresas con compromiso real. Propósito demostrable y partnerships con sentido.',
    ogEyebrow: '— Para quién · Empresas con propósito',
    ogTitle: 'El propósito o se demuestra o no existe.',
    ogAccent: 'o no existe',
    ogSubtitle:
      'Direcciones de comunicación, sostenibilidad y RSC que convierten el discurso ESG en hechos comunicables y partnerships reales con tercer sector.',
  },
];

export function getAudiencia(id: Audiencia['id']): Audiencia | undefined {
  return audiencias.find((a) => a.id === id);
}

/**
 * JSON-LD para una página de audiencia: Organization + BreadcrumbList + FAQPage.
 * Cierra el hueco GEO de /para-quien/* (antes no emitían ningún structured data).
 */
export function audienciaJsonLd(a: Audiencia) {
  return [
    organizationSchema(),
    breadcrumbList([
      { name: 'Inicio', url: `${SITE_URL}/` },
      { name: 'Para quién', url: `${SITE_URL}/para-quien` },
      { name: a.tag, url: `${SITE_URL}${a.href}` },
    ]),
    faqPageSchema(a.faqs.map((f) => ({ q: f.q, a: f.a }))),
  ];
}
