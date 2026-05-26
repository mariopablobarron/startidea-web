/**
 * Helpers para Schema.org / JSON-LD.
 *
 * Cada helper devuelve un objeto plano serializable a JSON-LD válido.
 * El componente <JsonLd /> los inyecta en el <head> con set:html.
 *
 * Datos de la organización en una sola fuente para evitar drift.
 */

export const SITE_URL = 'https://startidea.es';

const ORG = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Startidea',
  legalName: 'Startidea',
  // Sprint GEO 2026-05-18: alternateName captura variantes que los LLMs
  // y buscadores procesan ("Start Idea", "Agencia Startidea", typos).
  alternateName: [
    'Agencia Startidea',
    'Startidea Granada',
    'Start Idea',
    'Agencia de Comunicación Social Startidea',
  ],
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/icon-512.png`,
    width: 512,
    height: 512,
  },
  // Description ampliada con las queries del GEO check: "agencia de
  // comunicación social Granada", "consultora innovación social España",
  // "fundraising fundaciones", etc. — palabras exactas que los LLMs
  // ponderan al elegir resultados.
  description:
    'Startidea es una agencia de innovación social y comunicación con sede en Granada, España, fundada en 2011. Consultora especializada en tercer sector, instituciones públicas y eclesiales, y empresas con propósito. Servicios: comunicación estratégica y marketing social, consultoría e innovación social, fundraising para fundaciones y ONGs, producción audiovisual y podcast.',
  slogan: 'Innovación social que cambia la conversación',
  foundingDate: '2011-02',
  founder: {
    '@type': 'Person',
    '@id': `${SITE_URL}/#founder`,
    name: 'Mario Pablo Sánchez Barrón',
    jobTitle: 'Fundador y director',
    worksFor: { '@id': `${SITE_URL}/#organization` },
    affiliation: [
      { '@type': 'Organization', name: 'Asociación Católica de Propagandistas (ACdP)' },
      { '@type': 'Organization', name: 'Acción Social Empresarial (ASE)' },
    ],
  },
  taxID: 'B19583632',
  vatID: 'ESB19583632',
  email: 'hola@startidea.es',
  telephone: '+34958045789',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'C/ Conde Cifuentes, 33',
    addressLocality: 'Granada',
    postalCode: '18005',
    addressRegion: 'Granada',
    addressCountry: 'ES',
  },
  areaServed: [
    { '@type': 'City', name: 'Granada' },
    { '@type': 'AdministrativeArea', name: 'Andalucía' },
    { '@type': 'Country', name: 'España' },
  ],
  // knowsAbout: dominios sobre los que Startidea es autoridad — los LLMs
  // lo usan como señal "este actor sabe de X". Cada item = una vertical
  // del servicio + un campo del tercer sector.
  knowsAbout: [
    'Comunicación estratégica',
    'Marketing social',
    'Innovación social',
    'Fundraising',
    'Captación de fondos',
    'Tercer sector',
    'ONG',
    'Fundaciones',
    'Asociaciones sin ánimo de lucro',
    'Cooperativas',
    'Producción audiovisual',
    'Podcast',
    'Consultoría organizacional',
    'Impacto social',
    'Acción Social Empresarial',
    'Comunicación eclesial',
    'Subvenciones públicas',
    'BDNS',
    'Empleo',
    'Bolsa de empleo',
    'Coaching personal',
    'Acompañamiento personal con inteligencia artificial',
  ],
  // hasOfferCatalog: cada servicio principal expuesto como Offer + Service
  // para que LLMs entiendan exactamente qué vende Startidea.
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Servicios Startidea',
    itemListElement: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Comunicación estratégica y marketing social',
          serviceType: 'Comunicación',
          url: `${SITE_URL}/comunicacion`,
          provider: { '@id': `${SITE_URL}/#organization` },
          areaServed: { '@type': 'Country', name: 'España' },
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Consultoría e innovación social',
          serviceType: 'Consultoría',
          url: `${SITE_URL}/consultoria`,
          provider: { '@id': `${SITE_URL}/#organization` },
          areaServed: { '@type': 'Country', name: 'España' },
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Fundraising y alianzas',
          serviceType: 'Fundraising',
          url: `${SITE_URL}/fundraising`,
          provider: { '@id': `${SITE_URL}/#organization` },
          areaServed: { '@type': 'Country', name: 'España' },
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Producción audiovisual y podcast',
          serviceType: 'Producción audiovisual',
          url: `${SITE_URL}/audiovisual`,
          provider: { '@id': `${SITE_URL}/#organization` },
          areaServed: { '@type': 'Country', name: 'España' },
        },
      },
    ],
  },
  // subOrganization: cross-link a propiedades del grupo. Refuerza la
  // autoridad y permite que LLMs entiendan el ecosistema completo.
  subOrganization: [
    {
      '@type': 'Organization',
      name: 'Granada Social',
      url: 'https://granadasocial.org',
      description: 'Medio digital sociocultural editado por Startidea.',
    },
    {
      '@type': 'Organization',
      name: 'Hub Startidea',
      url: 'https://hubstartidea.es',
      description: 'Coworking y estudios audiovisuales de Startidea en Granada.',
    },
    {
      '@type': 'Organization',
      name: 'TodoMerchandising',
      url: 'https://merchandising.hubstartidea.es',
      description: 'Catálogo B2B online de merchandising promocional sostenible.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Raíz y Acción',
      url: 'https://raizyaccion.hubstartidea.es',
      description: 'Plataforma de acompañamiento y coaching personal con inteligencia artificial: check-ins de estado emocional, gestión de acciones y objetivos, eneagrama y mentor virtual. Desarrollada por Startidea.',
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Web',
    },
    {
      '@type': 'Organization',
      name: 'Startidea Empleo',
      url: 'https://empleo.startidea.es',
      description: 'Bolsa de empleo online para cualquier sector en España. Conecta empresas, entidades y organizaciones con candidatos.',
    },
  ],
  sameAs: [
    'https://www.linkedin.com/company/agenciastartidea',
    'https://www.instagram.com/agenciastartidea',
    'https://www.facebook.com/agenciastartidea',
    'https://x.com/startideasocial',
    'https://www.youtube.com/c/AgenciadeComunicaciónSocialSTARTIDEA',
    'https://open.spotify.com/show/3c3Pm70Up3v1GOdYuSxj05',
  ],
};

export function organizationSchema() {
  return { '@context': 'https://schema.org', ...ORG };
}

/**
 * LocalBusiness — para keywords geolocalizadas: "agencia comunicación granada",
 * "startidea granada", "consultoría innovación social granada", etc.
 * Google muestra rich results y Local Pack para queries con intención local.
 *
 * Reusa los datos de ORG pero añade geo, openingHours y priceRange para
 * cumplir el schema completo.
 */
export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#localbusiness`,
    name: ORG.name,
    url: SITE_URL,
    image: ORG.logo.url,
    description: ORG.description,
    telephone: ORG.telephone,
    email: ORG.email,
    address: ORG.address,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 37.1759,
      longitude: -3.5965,
    },
    areaServed: [
      { '@type': 'City', name: 'Granada' },
      { '@type': 'AdministrativeArea', name: 'Andalucía' },
      { '@type': 'Country', name: 'España' },
    ],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
    ],
    priceRange: '€€',
    sameAs: ORG.sameAs,
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'Startidea',
    inLanguage: 'es-ES',
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbList(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

interface BlogPostingInput {
  url: string;
  title: string;
  description: string;
  datePublished: Date;
  dateModified?: Date;
  authorName: string;
  authorRole?: string;
  image?: string;
  keywords?: string[];
}

export function blogPostingSchema(b: BlogPostingInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': b.url },
    headline: b.title,
    description: b.description,
    datePublished: b.datePublished.toISOString(),
    dateModified: (b.dateModified ?? b.datePublished).toISOString(),
    author: {
      '@type': 'Person',
      name: b.authorName,
      ...(b.authorRole ? { jobTitle: b.authorRole } : {}),
    },
    publisher: { '@id': `${SITE_URL}/#organization` },
    image: b.image ?? `${SITE_URL}/og/home.png`,
    inLanguage: 'es-ES',
    ...(b.keywords && b.keywords.length ? { keywords: b.keywords.join(', ') } : {}),
  };
}

interface CaseStudyInput {
  url: string;
  title: string;
  description: string;
  cliente: string;
  year: string;
  image?: string;
}

export function caseStudySchema(c: CaseStudyInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': c.url },
    headline: c.title,
    description: c.description,
    datePublished: `${c.year}-01-01`,
    author: { '@id': `${SITE_URL}/#organization` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    image: c.image ?? `${SITE_URL}/og/home.png`,
    inLanguage: 'es-ES',
    about: c.cliente,
  };
}

interface FaqItem {
  q: string;
  a: string;
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

/**
 * Service schema dedicado para landings de servicio (/financiacion-empresas,
 * /comunicacion, /fundraising, etc.). Genera un Service @type completo con
 * provider apuntando al Organization, areaServed, serviceType y offerCatalog
 * opcional con las modalidades/líneas del servicio.
 *
 * Google lo procesa para rich snippets de servicio profesional, y los LLMs
 * lo usan como señal "Startidea ofrece exactamente esto".
 */
interface ServiceInput {
  name: string;
  description: string;
  serviceType: string;
  url: string;
  audience?: string[]; // ["Empresa", "ONG", "Fundación", "Startup"...]
  offers?: Array<{ name: string; description: string; url?: string }>;
}

export function serviceSchema(s: ServiceInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${s.url}#service`,
    name: s.name,
    description: s.description,
    serviceType: s.serviceType,
    url: s.url,
    provider: { '@id': `${SITE_URL}/#organization` },
    areaServed: [
      { '@type': 'Country', name: 'España' },
      { '@type': 'AdministrativeArea', name: 'Andalucía' },
    ],
    availableLanguage: ['es-ES'],
    ...(s.audience && s.audience.length
      ? {
          audience: s.audience.map((name) => ({
            '@type': 'Audience',
            audienceType: name,
          })),
        }
      : {}),
    ...(s.offers && s.offers.length
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: `Líneas de ${s.name}`,
            itemListElement: s.offers.map((o) => ({
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: o.name,
                description: o.description,
                ...(o.url ? { url: o.url } : {}),
              },
            })),
          },
        }
      : {}),
  };
}
