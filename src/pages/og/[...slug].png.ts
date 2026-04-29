import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderOg, type OgInput } from '@/lib/og';
import { casos } from '@/data/casos';

// ─── Catálogo de OGs ────────────────────────────────────────
// Cada slug → input para renderOg
async function buildCatalog(): Promise<Record<string, OgInput>> {
  const catalog: Record<string, OgInput> = {
    // Home
    'home': {
      kind: 'home',
      eyebrow: 'Startidea',
      title: 'Innovación social que se nota.',
      accent: 'se nota',
      subtitle: 'Estrategia, comunicación y herramientas digitales para organizaciones que existen para algo más.',
    },

    // Páginas estáticas
    'page/manifiesto': {
      kind: 'page',
      eyebrow: '— Manifiesto',
      title: 'La innovación social no es una etiqueta.',
      accent: 'no es una etiqueta',
      subtitle: 'Es una manera de mirar las organizaciones que existen para mejorar el mundo y exigirles que lo hagan mejor.',
    },
    'page/sobre': {
      kind: 'page',
      eyebrow: '— Sobre',
      title: 'Quince años. Una manera de mirar.',
      accent: 'Una manera de mirar',
      subtitle: 'Startidea es agencia, hub, medio y línea de productos. Una casa con cuatro voces, fundada en Granada en febrero de 2011 por Mario Pablo Sánchez Barrón.',
    },
    'page/contacto': {
      kind: 'page',
      eyebrow: '— Hablemos',
      title: 'Treinta minutos. Sin compromiso.',
      accent: 'Sin compromiso',
      subtitle: 'Una llamada de diagnóstico. Tú cuentas el reto y te decimos honestamente si encajamos.',
    },
    'page/para-quien': {
      kind: 'page',
      eyebrow: '— Para quién',
      title: 'Tres audiencias. Tres conversaciones.',
      accent: 'Tres conversaciones',
      subtitle: 'Tercer sector, instituciones y empresas con propósito real. No hablamos igual a cada una.',
    },
    'page/como-trabajamos': {
      kind: 'page',
      eyebrow: '— Cómo trabajamos',
      title: 'Las tres preguntas.',
      accent: 'tres preguntas',
      subtitle: 'Estrategia, comunicación y producto digital bajo el mismo techo. Las tres preguntas se responden juntas o no se responden bien.',
    },
    'page/casos': {
      kind: 'page',
      eyebrow: '— Casos',
      title: 'Lo que hacemos. Con su nombre y apellidos.',
      accent: 'su nombre y apellidos',
      subtitle: 'Proyectos reales con organizaciones reales: Down Granada, Granada Social, Proyecto Hombre, Tres Mil Millones de Latidos.',
    },
    'page/notas': {
      kind: 'page',
      eyebrow: '— Notas',
      title: 'Una nota al mes. Cero ruido.',
      accent: 'Cero ruido',
      subtitle: 'Notas editoriales sobre comunicación, estrategia y producto digital con propósito. Cinco minutos. Sin tracking pixels.',
    },
    'page/consultoria': {
      kind: 'page',
      eyebrow: '— Consultoría e Innovación Social',
      title: 'Pensar mejor. Decidir con criterio.',
      accent: 'Decidir con criterio',
      subtitle: 'Acompañamos a organizaciones, entidades sociales, administraciones y empresas con propósito a ordenar la estrategia, diseñar proyectos sólidos, captar recursos y demostrar resultados.',
    },
    'page/tecnologia': {
      kind: 'page',
      eyebrow: '— Tecnología',
      title: 'Plataformas que aguantan.',
      accent: 'que aguantan',
      subtitle: 'Webs editoriales, plataformas a medida, producto digital con IA, migraciones sin pérdida SEO. Stack moderno cuando suma, estable cuando es lo correcto.',
    },
    'page/comunicacion': {
      kind: 'page',
      eyebrow: '— Comunicación Estratégica',
      title: 'Comunicar mejor. Comunicar para algo.',
      accent: 'Comunicar para algo',
      subtitle: 'Estrategia, contenidos, redes, campañas con causa, marketing digital, marca, comunicación institucional y crisis. Comunicación con propósito, no decorativa.',
    },
    'page/audiovisual': {
      kind: 'page',
      eyebrow: '— Producción Audiovisual y Podcast',
      title: 'Vídeo y podcast con propósito.',
      accent: 'con propósito',
      subtitle: 'Convertimos ideas, conocimientos y causas en contenidos audiovisuales y podcasts pensados para construir marca, comunidad y reputación. Estudio propio en Granada.',
    },
    'page/fundraising': {
      kind: 'page',
      eyebrow: '— Fundraising y Alianzas',
      title: 'Diversificar. Profesionalizar.',
      accent: 'Profesionalizar',
      subtitle: 'Diversificación de ingresos, plan de fundraising a 12 meses, materiales de captación y mapeo de aliados. Para entidades que dejan de depender de una sola fuente.',
    },
    'page/hub': {
      kind: 'page',
      eyebrow: '— Hub Startidea',
      title: 'Trabajar acompañado. Sin perder el foco.',
      accent: 'Sin perder el foco',
      subtitle: 'Coworking, salas, estudio de podcast y despachos privados en pleno centro de Granada. Espacio para profesionales y proyectos con propósito.',
    },
    'page/merchandising': {
      kind: 'page',
      eyebrow: '— Merchandising',
      title: 'Detalles que se usan, se ven y se recuerdan.',
      accent: 'se recuerdan',
      subtitle: 'Más de 500 productos personalizables: textil orgánico, RPET, ecología-ética. Bronze Partner de FYVAR desde 2016.',
    },
    'page/404': {
      kind: 'page',
      eyebrow: '— Error 404',
      title: 'Esta página no existe.',
      accent: 'no existe',
      subtitle: 'O nunca existió, o la movimos de sitio sin avisar. Te dejamos atajos para volver a algo útil.',
    },
    'page/laboratorio-fundraising': {
      kind: 'page',
      eyebrow: '— Laboratorio · Diagnósticos de fundraising',
      title: 'El método. Aplicado.',
      accent: 'Aplicado',
      subtitle: 'Diagnósticos públicos y anonimizados del Tercer Sector. Radiografía, palancas detectadas y recomendaciones — el método Startidea aplicado a casos reales.',
    },
    'page/presupuesto': {
      kind: 'page',
      eyebrow: '— Pedir presupuesto',
      title: 'Una estimación. Después un diagnóstico.',
      accent: 'Después un diagnóstico',
      subtitle: 'Calculadora orientativa y briefing en cuatro pasos. Te enviamos un presupuesto detallado con la respuesta del diagnóstico — sin compromiso.',
    },
  };

  // Casos individuales
  for (const caso of casos) {
    catalog[`casos/${caso.slug}`] = {
      kind: 'caso',
      eyebrow: `Caso · ${caso.num}${caso.kind === 'propio' ? ' · Iniciativa propia' : ''}`,
      title: caso.title,
      subtitle: `${caso.cliente} · ${caso.intervention}`,
    };
  }

  // Notas individuales (Content Collection)
  const notas = await getCollection('notas', ({ data }) => !data.draft);
  for (const nota of notas) {
    const fmt = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
    catalog[`notas/${nota.slug}`] = {
      kind: 'nota',
      eyebrow: `Notas · ${fmt.format(nota.data.pubDate)}`,
      title: nota.data.title,
      subtitle: nota.data.description,
    };
  }

  return catalog;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const catalog = await buildCatalog();
  return Object.keys(catalog).map((slug) => ({ params: { slug } }));
};

export const GET: APIRoute = async ({ params }) => {
  const catalog = await buildCatalog();
  const slug = params.slug as string;
  const input = catalog[slug];

  if (!input) {
    return new Response('Not found', { status: 404 });
  }

  const png = await renderOg(input);
  return new Response(png as any, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
