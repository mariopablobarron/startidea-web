import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderOg, type OgInput } from '@/lib/og';
import { casos } from '@/data/casos';
import { audiencias } from '@/data/audiencias';

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
    'page/proteccion-digital': {
      kind: 'page',
      eyebrow: '— Protección Digital',
      title: 'Seguridad sin alarmismo.',
      accent: 'sin alarmismo',
      subtitle: 'Ciberseguridad y cumplimiento RGPD para entidades sociales sin departamento de TI. Diagnóstico de exposición, auditoría de seguridad web y acompañamiento continuo.',
    },
    'page/comunicacion': {
      kind: 'page',
      eyebrow: '— Comunicación Estratégica',
      title: 'Comunicar mejor. Comunicar para algo.',
      accent: 'Comunicar para algo',
      subtitle: 'Estrategia, contenidos, redes, campañas con causa, marketing digital, marca, comunicación institucional y crisis. Comunicación con propósito, no decorativa.',
    },
    'page/redes-sociales-granada': {
      kind: 'page',
      eyebrow: '— Redes sociales · Granada',
      title: 'Redes sociales y social media en Granada.',
      accent: 'en Granada',
      subtitle: 'Gestión de redes para tercer sector, instituciones y empresas con propósito: estrategia, calendario editorial, contenidos y comunidad. Con estudio en el centro de Granada.',
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
    'page/recursos-diagnostico': {
      kind: 'page',
      eyebrow: '— Recurso descargable · PDF 12 páginas',
      title: 'El modelo del diagnóstico de fundraising.',
      accent: 'del diagnóstico',
      subtitle: 'Caso real anonimizado: federación regional de discapacidad con 86% de dependencia pública. Mezcla de ingresos, palancas y recomendaciones.',
    },

    // ─── Landings añadidas 2026-05-26 ─────────────────────────────────
    'page/financiacion-empresas': {
      kind: 'page',
      eyebrow: '— Financiación pública',
      title: 'Toda la financiación pública. Filtrada para ti.',
      accent: 'Filtrada para ti',
      subtitle: '1.900+ convocatorias en vivo de BDNS, CDTI, IDAE, ENISA y Andalucía TRADE. Si una encaja, Startidea presenta el expediente por ti con certificado digital.',
    },
    'page/que-hacemos': {
      kind: 'page',
      eyebrow: '— Qué hace Startidea',
      title: 'Cinco servicios. Una mirada.',
      accent: 'Una mirada',
      subtitle: 'Comunicación · Consultoría · Fundraising · Audiovisual · Financiación pública. Trabajados juntos por un equipo con quince años desde Granada.',
    },
    'page/subvenciones': {
      kind: 'page',
      eyebrow: '— Buscador de subvenciones',
      title: 'Filtramos el BOE. Para ti.',
      accent: 'Para ti',
      subtitle: 'Convocatorias del BDNS más Andalucía TRADE e IDAE. Sin paywall, sin créditos, sin clickbait. Filtrado desde el ADN del tercer sector.',
    },
    'page/glosario': {
      kind: 'page',
      eyebrow: '— Glosario del tercer sector',
      title: 'Los términos, sin jerga.',
      accent: 'sin jerga',
      subtitle: 'Fundraising, base social, concurrencia competitiva, BDNS, declaración responsable… Definiciones claras de comunicación social, fundraising y subvenciones.',
    },
    'page/encuesta-fundraising': {
      kind: 'page',
      eyebrow: '— Encuesta · 4 minutos',
      title: '¿De qué depende tu financiación?',
      accent: 'tu financiación',
      subtitle: 'Encuesta anónima sobre dependencia pública en entidades del tercer sector. Startidea publicará el informe agregado — quien participa lo recibe antes que nadie.',
    },
    'page/impulsa': {
      kind: 'page',
      eyebrow: '— Startidea Impulsa · Programa RSC',
      title: '80.000 € en comunicación para el tercer sector.',
      accent: 'para el tercer sector',
      subtitle: 'Diagnóstico estratégico gratuito + ejecución del plan: web, redes, audiovisual y software de gestión. En especie, para entidades sociales de toda España.',
    },
    'page/impulsa-bases': {
      kind: 'page',
      eyebrow: '— Startidea Impulsa · Bases',
      title: 'Bases del programa.',
      accent: 'del programa',
      subtitle: 'Requisitos, dotación, criterios de valoración y obligaciones del programa de comunicación con propósito para el tercer sector.',
    },
    'page/subvenciones-mapa': {
      kind: 'page',
      eyebrow: '— Mapa de subvenciones · BDNS',
      title: 'Las ayudas abiertas, por territorio.',
      accent: 'por territorio',
      subtitle: 'Mapa interactivo en vivo de las convocatorias abiertas en España agrupadas por CCAA. Datos del BDNS actualizados a diario.',
    },
    'page/diagnostico': {
      kind: 'page',
      eyebrow: '— Diagnóstico inicial',
      title: 'Tres minutos. Un briefing claro.',
      accent: 'Un briefing claro',
      subtitle: 'Antes de hablar, cuéntanos qué necesitas resolver. Startidea recibe el cuestionario, prepara un primer análisis y llega a la reunión con preguntas que importan.',
    },
    'page/diagnostico-nuevo': {
      kind: 'page',
      eyebrow: '— Diagnóstico · cinco pasos',
      title: 'Tu reto, en cinco preguntas.',
      accent: 'en cinco preguntas',
      subtitle: 'Wizard adaptativo según tu tipo de organización. Empresa, institución, entidad social o emprendedor — las preguntas se ajustan al perfil.',
    },
    'page/diagnostico-gracias': {
      kind: 'page',
      eyebrow: '— Recibido',
      title: 'Gracias. Te llamamos pronto.',
      accent: 'Te llamamos pronto',
      subtitle: 'El equipo de Startidea lo lee, prepara una primera lectura y te contacta en las próximas 48 horas laborales.',
    },
    'page/presupuesto-nuevo': {
      kind: 'page',
      eyebrow: '— Pedir presupuesto · 3 pasos',
      title: 'Tres preguntas. Una cifra.',
      accent: 'Una cifra',
      subtitle: 'Si ya sabes lo que necesitas, te respondemos con rango orientativo y propuesta de llamada de 30 min en 48 horas laborales.',
    },
    'page/laboratorio': {
      kind: 'page',
      eyebrow: '— Startidea Lab',
      title: 'El método. A la vista.',
      accent: 'A la vista',
      subtitle: 'Experimentos abiertos y métodos aplicados. Hyperframes (vídeo con código), diagnósticos de fundraising y herramientas que estamos probando con clientes reales.',
    },
    'page/integraciones-google': {
      kind: 'page',
      eyebrow: '— Integraciones · Google',
      title: 'Startidea conecta con GA4 y Search Console.',
      accent: 'GA4 y Search Console',
      subtitle: 'Acceso solo de lectura a las propiedades que cada cliente autoriza. Datos para producir informes SEO internos, no se comparten con terceros y se eliminan a petición.',
    },
  };

  // Subpáginas de /para-quien (una OG por audiencia)
  for (const a of audiencias) {
    catalog[`page/para-quien-${a.id}`] = {
      kind: 'page',
      eyebrow: a.ogEyebrow,
      title: a.ogTitle,
      accent: a.ogAccent,
      subtitle: a.ogSubtitle,
    };
  }

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
