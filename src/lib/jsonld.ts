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
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/icon-512.png`,
    width: 512,
    height: 512,
  },
  description:
    'Agencia de innovación social en Granada. Comunicación, consultoría, fundraising, audiovisual y tecnología al servicio de organizaciones con propósito.',
  foundingDate: '2011-02',
  founder: {
    '@type': 'Person',
    name: 'Mario Pablo Sánchez Barrón',
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
  areaServed: { '@type': 'Country', name: 'España' },
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
