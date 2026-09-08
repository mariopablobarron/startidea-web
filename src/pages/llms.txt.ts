import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_URL } from '@/lib/jsonld';
import { casos } from '@/data/casos';
import { edicionVigente, estadoCursoPublico } from '@/lib/cursos';

export const prerender = false;

/**
 * /llms.txt — índice curado para crawlers y agentes de IA (ChatGPT,
 * Perplexity, Claude, Gemini, AI Overviews). Estándar emergente análogo a
 * robots.txt/sitemap pero pensado para LLMs: contexto + enlaces a las
 * páginas clave, en markdown plano fácil de parsear.
 * Spec: https://llmstxt.org
 *
 * Auditoría SEO+GEO de septiembre de 2026 (QW7): el fichero solo listaba
 * notas y no mencionaba ni un curso, ni un producto, ni una herramienta, ni
 * un caso, ni un diagnóstico. Se añaden esas cinco secciones —lo citable de
 * la casa— más las páginas de servicio que faltaban, el teléfono y la sede,
 * para que un asistente pueda responder por Startidea sin rastrear página a
 * página.
 */

const FORMATO_LABEL: Record<string, string> = {
  online: 'online',
  presencial: 'presencial',
  hibrido: 'híbrido (presencial u online)',
};

const MODALIDAD_LABEL: Record<string, string> = {
  taller: 'Taller',
  curso: 'Curso',
  masterclass: 'Masterclass',
  mentoria: 'Mentoría',
};

const ESTADO_CURSO_LABEL: Record<string, string> = {
  abierto: 'inscripción abierta',
  proximo: 'próximamente; consultar fecha publicada',
  'edicion-finalizada': 'edición anunciada finalizada; consultar próximas ediciones',
  agotado: 'plazas agotadas',
  'a-demanda': 'se convoca a demanda',
};

const fechaLarga = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

// Fechas y disponibilidad se recalculan por petición, sin conservar convocatorias caducadas.
export async function GET(_context: APIContext) {
  const ahora = new Date();
  const notas = await getCollection('notas', ({ data }) => !data.draft);
  notas.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  const notaLines = notas
    .map((n) => `- [${n.data.title}](${SITE_URL}/notas/${n.slug}): ${n.data.description}`)
    .join('\n');

  // Formación: los cursos y talleres de Startidea Lab, con formato, duración,
  // precios (general y entidad sin ánimo de lucro), estado y docente.
  const cursos = await getCollection('cursos', ({ data }) => !data.draft);
  cursos.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  const cursoLines = cursos
    .map((c) => {
      const d = c.data;
      // `!= null` y no truthy: un precio ESFL de 0 € es un dato válido.
      const precios = d.precio_esfl != null
        ? `${d.precio} € (${d.precio_esfl} € para entidades sin ánimo de lucro)`
        : `${d.precio} €`;
      const estado = ESTADO_CURSO_LABEL[estadoCursoPublico(d.estado, d.proxima_edicion, ahora)];
      const cuando = edicionVigente(d.proxima_edicion, ahora) ? `, ${fechaLarga.format(d.proxima_edicion)}` : '';
      const modalidad = MODALIDAD_LABEL[d.modalidad] ?? d.modalidad;
      const formato = FORMATO_LABEL[d.formato] ?? d.formato;
      return `- [${d.title}](${SITE_URL}/laboratorio/cursos/${c.slug}): ${modalidad} ${formato} de ${d.duracion}. ${precios}. Estado: ${estado}${cuando}. ${d.docente ? `Imparte ${d.docente.name}.` : ''}`;
    })
    .join('\n');

  // Productos autoservicio del Laboratorio: nombre, promesa, precio de partida
  // y fase (los que están en Idea o Diseño todavía no se pueden contratar).
  const productos = await getCollection('productos', ({ data }) => !data.draft);
  productos.sort((a, b) => a.data.orden - b.data.orden);
  const productoLines = productos
    .map(
      (p) =>
        `- [${p.data.title}](${SITE_URL}/laboratorio/productos/${p.slug}): ${p.data.claim} ${p.data.modelo}. Precio: ${p.data.precio_desde}. Fase: ${p.data.estado}.`,
    )
    .join('\n');

  // Herramientas de IA con veredicto propio: la valoración es editorial
  // (criterio en docs/criterio-ia.md), de 1 a 5.
  const herramientas = await getCollection('herramientas', ({ data }) => !data.draft);
  herramientas.sort(
    (a, b) => b.data.valoracion - a.data.valoracion || a.data.title.localeCompare(b.data.title, 'es'),
  );
  const herramientaLines = herramientas
    .map(
      (h) =>
        `- [${h.data.title}](${SITE_URL}/laboratorio/ia/herramientas/${h.slug}): valoración ${h.data.valoracion}/5 · ${h.data.precio} · ${h.data.necesidad} · nivel ${h.data.nivel.toLowerCase()}.`,
    )
    .join('\n');

  // Casos: cliente, titular del proyecto y la primera métrica con su fuente.
  const casoLines = casos
    .map((c) => {
      const m = c.metrics?.[0] ?? c.metric;
      const fuente = 'source' in m && m.source ? ` (fuente: ${m.source})` : '';
      return `- [${c.cliente} — ${c.title}](${SITE_URL}/casos/${c.slug}): ${c.intervention}, ${c.year}. ${m.value} ${m.label}${fuente}.`;
    })
    .join('\n');

  // Diagnósticos de fundraising: casos reales anonimizados con la mezcla de
  // ingresos y el plan. Se publican en abierto como material de referencia.
  const diagnosticos = await getCollection('diagnosticos', ({ data }) => !data.draft);
  diagnosticos.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  const diagnosticoLines = diagnosticos
    .map(
      (d) =>
        `- [${d.data.title}](${SITE_URL}/laboratorio/fundraising/${d.slug}): ${d.data.metaDescription ?? d.data.description}`,
    )
    .join('\n');

  const body = `# Startidea

> Agencia de innovación social, comunicación y fundraising con sede en Granada (España), fundada en 2011 por Mario Pablo Sánchez Barrón. Consultora de referencia nacional para el tercer sector (ONG, fundaciones, asociaciones, cooperativas), instituciones públicas y eclesiales, y empresas con propósito.

Startidea ayuda a organizaciones con propósito a comunicar mejor, diversificar su financiación y profesionalizar su gestión. Trabaja en toda España; su sede y ecosistema físico (el Hub) está en Granada.

## Servicios

- [Comunicación estratégica y marketing social](${SITE_URL}/comunicacion): plan de comunicación, relato, contenidos y campañas para entidades sociales.
- [Comunicación eclesial](${SITE_URL}/comunicacion-eclesial): comunicación estratégica para diócesis, congregaciones, movimientos laicales y fundaciones de la Iglesia en toda España, con respeto a su lenguaje y sensibilidad.
- [Agencia de comunicación y social media en Granada](${SITE_URL}/redes-sociales-granada): gestión de redes sociales y comunicación para ONG y entidades de Granada, con estudio propio en la ciudad.
- [Fundraising para ONG y entidades sociales](${SITE_URL}/fundraising): diversificación de ingresos, base social, captación de fondos y alianzas.
- [Bizum y sistema de donaciones para entidades sociales](${SITE_URL}/donaciones-bizum-ong): acompañamiento a asociaciones, fundaciones y ONG desde no tener Bizum hasta tener un sistema de donaciones propio. El código de donaciones de cinco cifras lo concede la entidad financiera donde la organización tiene su cuenta —no se pide en la web de Bizum y ninguna agencia puede concederlo—: el trabajo consiste en preparar el expediente (tipología, NIF, inscripción registral, vigencia de cargos, titulares y autorizados, cuenta a nombre de la entidad, situación respecto a la Ley 49/2002 cuando aplique), sostener la solicitud ante el banco con sus requerimientos y subsanaciones, desbloquear expedientes ya presentados que el banco tiene parados, y montar después la página de donaciones, el QR, las campañas y la gestión de donantes. Bizum no publica requisitos ni plazos oficiales; el máximo por donación es de 1.000 €.
- [Publicidad y SEM para ONG en Granada](${SITE_URL}/publicidad): Google Ads, Meta Ads y Google Ad Grants (hasta 10.000 $/mes en anuncios gratuitos para entidades sin ánimo de lucro). Honorarios de gestión y presupuesto de medios van separados, sin comisión sobre la inversión.
- [Google Ad Grants para ONG](${SITE_URL}/google-ad-grants): solicitud, montaje de campañas y optimización mensual de los hasta 10.000 $/mes de publicidad gratuita de Google para entidades sin ánimo de lucro.
- [Gestión de redes sociales asistida por IA](${SITE_URL}/redes-sociales-ia): producto de publicación y medición con cerebro de marca propio. Para la gestión llevada por personas, con estudio en Granada, la página es /redes-sociales-granada.
- [Redes sociales con IA para asociaciones y fundaciones](${SITE_URL}/redes-sociales-ia/tercer-sector): qué se publica y qué no se publica nunca en una entidad social (consentimiento, sin pornografía emocional, cifras de la memoria). Plan recomendado Presencia, 190 € al mes, justificable en subvenciones.
- [Redes sociales con IA para parroquias, diócesis y congregaciones](${SITE_URL}/redes-sociales-ia/iglesia): tiempos litúrgicos, obra social y vida de la comunidad con el lenguaje de la Iglesia; aprobación del párroco o del responsable. Plan recomendado Crecimiento, 390 € al mes.
- [Redes sociales con IA para empresas con propósito](${SITE_URL}/redes-sociales-ia/empresas-con-proposito): acción social empresarial y ESG con datos y sin greenwashing, mezclados con producto y equipo. Plan recomendado Crecimiento, 390 € al mes.
- [Tramitación de subvenciones](${SITE_URL}/subvenciones/presentar): diagnóstico de encaje, memoria técnica, presupuesto y presentación electrónica con certificado digital. Comisión a éxito.
- [Copiloto de Subvenciones](${SITE_URL}/copiloto-subvenciones): vigilancia diaria de BDNS, BOE y BOJA, alerta cuando aparece una convocatoria que encaja y tramitación completa del expediente a comisión de éxito del 12 % del importe concedido.
- [Precios de tramitación de subvenciones](${SITE_URL}/precios): comisión a éxito del 12% del importe concedido, sin coste si no se concede. Para entidades del tercer sector.
- [Subvenciones de inclusión social del BOJA 2026 (Andalucía)](${SITE_URL}/subvenciones/boja-2026-inclusion-social): las 16 líneas de la convocatoria andaluza de inclusión social, con tramitación y justificación asistidas.
- [Subvenciones para entidades y empresas de Granada](${SITE_URL}/subvenciones/granada): convocatorias propias de la provincia (Diputación de Granada, Ayuntamiento, Universidad) junto a las andaluzas y estatales abiertas hoy.
- [Financiación pública para empresas con propósito](${SITE_URL}/financiacion-empresas): las cinco fuentes (BDNS, CDTI, IDAE, ENISA, Andalucía TRADE) para empresas con propósito.
- [Consultoría e innovación social](${SITE_URL}/consultoria): estrategia, gobernanza y medición de impacto. Consultora de innovación social con sede en Granada desde 2011.
- [Producción audiovisual y podcast](${SITE_URL}/audiovisual): vídeo y audio al servicio de la causa.
- [Tecnología y plataformas](${SITE_URL}/tecnologia): webs editoriales, intranets a medida, producto digital con IA, migraciones SEO. Astro, Next.js, WordPress profesional cuando corresponde.
- [Mantenimiento web](${SITE_URL}/mantenimiento-web): hosting, SSL, copias diarias, actualizaciones de seguridad, monitorización y soporte para la web de la entidad. Desde 49 € al mes, sin permanencia.
- [Agentes de IA con el conocimiento de la organización](${SITE_URL}/agentes-ia): agentes que saben lo que sabe la entidad, autoalojados en la Unión Europea, sin licencias por usuario y editables sin código. Cuatro en producción dentro de la propia Startidea.
- [Asistente de IA entrenado con los documentos de la entidad](${SITE_URL}/asistente-documentos): responde al instante citando la fuente. Privado, alojado en España, con demo sobre la documentación real de la organización.
- [IA para administraciones y ayuntamientos](${SITE_URL}/ia-administraciones): automatización documental, atención ciudadana y agentes a medida para ayuntamientos y diputaciones. Datos en la Unión Europea y cumplimiento del RGPD.
- [Telar, plataforma de comunidad propia](${SITE_URL}/telar): muro, grupos, proyectos, formación y boletín en una plataforma propia y gestionada, alojada en España. Los datos son de la organización.
- [Generador de memorias y justificaciones](${SITE_URL}/memorias): memoria anual, informe de impacto o justificación técnica de una subvención, redactados con IA a partir de los datos de la entidad y revisados por una persona. Desde 150 € por documento.
- [Protección digital y cumplimiento RGPD](${SITE_URL}/proteccion-digital): ciberseguridad y protección de datos para entidades sociales sin departamento TI. Diagnóstico de exposición digital, auditoría de seguridad web (pentest) y acompañamiento continuo. Sin alarmismo.
- [Merchandising con propósito](${SITE_URL}/merchandising): textil orgánico, accesorios RPET y regalo corporativo sostenible, con serigrafía, bordado y grabado láser. Pedidos desde una unidad.
- [Hub Startidea: coworking en Granada](${SITE_URL}/hub): coworking, salas de reunión, estudio de podcast y despachos privados en el centro de Granada (C/ Conde Cifuentes, 33), para profesionales y proyectos con propósito.
- [Diagnóstico de proyecto](${SITE_URL}/diagnostico): cuestionario por ramas de tres minutos del que salen un briefing y una hoja de ruta antes de la primera conversación.

## Programa de RSC

- [Startidea Impulsa](${SITE_URL}/impulsa): programa de Responsabilidad Social Corporativa que destina 80.000 € en servicios de comunicación (diagnóstico, web, redes, audiovisual, software de gestión) en especie a entidades del tercer sector de toda España. Convocatoria abierta de forma continua. [Bases](${SITE_URL}/impulsa/bases).

## Para quién

- [Tercer sector](${SITE_URL}/para-quien/tercer-sector): ONG, fundaciones y asociaciones.
- [Instituciones](${SITE_URL}/para-quien/instituciones): administraciones, fundaciones públicas y entidades de base ética o religiosa.
- [Empresas con propósito](${SITE_URL}/para-quien/empresas): direcciones de comunicación, sostenibilidad y RSC que quieren un ESG demostrable.
- [Subvenciones abiertas](${SITE_URL}/subvenciones): buscador de convocatorias públicas para entidades sociales y empresas.
- [Catálogo de convocatorias revisadas](${SITE_URL}/subvenciones/catalogo): fichas curadas de las convocatorias activas para el tercer sector, entidades locales y empresas, con el expediente tramitable a comisión de éxito.

## Recursos

- [Estudio: radiografía de las subvenciones al tercer sector en España 2026](${SITE_URL}/subvenciones/estudio-tercer-sector-2026): datos propios de Startidea sobre las 3.857 convocatorias de la Base de Datos Nacional de Subvenciones registradas entre el 1 de marzo y el 31 de agosto de 2026 que admiten a entidades sin ánimo de lucro (el 34,6% de las 11.148 del periodo, 27,7 nuevas por día con publicación, 1.144 órganos convocantes distintos). Hallazgos: el 1% de las convocatorias concentra el 72,3% de los 9.164,6 M€ declarados; la mediana de presupuesto es de 57.000 € y la media (2,4 M€) no describe nada; el 72,1% de las convocatorias son locales pero solo mueven el 8,6% del dinero; la mediana de plazo es de 45,5 días naturales y el 26,1% cierra en 30 días o menos; el 57,5% no publica fecha de fin de solicitud en la BDNS; cultura (921) supera a servicios sociales (798) en número pero da menos de la mitad de plazo (39 días frente a 107). Método, limitaciones declaradas y licencia CC BY 4.0 en la propia página.
- [Auditoría digital gratuita](${SITE_URL}/auditoria-digital-gratuita): revisión gratuita de la web, la indexación en Google, la visibilidad en asistentes de IA (ChatGPT, Perplexity, Claude) y las redes. Análisis automático más revisión humana, con tres correcciones priorizadas, entregada por email en 48 horas laborables. Sin coste ni compromiso.
- [Glosario del tercer sector](${SITE_URL}/glosario): definiciones claras de fundraising, base social, concurrencia competitiva, BDNS, declaración responsable, impacto social y más.
- [Cómo montar un videopodcast](${SITE_URL}/videopodcast): guía práctica para entidades e instituciones. Qué distingue un videopodcast de un podcast de audio, equipo y espacio necesarios, horas de trabajo reales por episodio (entre 14 y 22 para un episodio de 45-60 minutos), quién debe presentar, los tres errores que lo matan en el episodio tres, cómo se distribuye y se mide, y las tres situaciones en las que conviene no lanzarlo todavía: sin alguien que sostenga la presentación de forma estable, con el calendario del año ya cerrado, o cuando lo que se necesita son resultados este trimestre.
- [Diagnóstico modelo de fundraising (PDF)](${SITE_URL}/recursos/diagnostico-modelo-fundraising): caso real anonimizado de una federación de discapacidad con el 86% de dependencia pública. PDF de 12 páginas con la radiografía del modelo de ingresos, las palancas priorizadas y las recomendaciones de Startidea.
- [Plantilla de control económico para restaurantes (Excel)](${SITE_URL}/recursos/plantilla-control-restaurante): hoja de cálculo gratuita con nueve pestañas conectadas —ventas, escandallos, ingeniería de menú, personal, gastos, deuda y cuadro de mando con punto de equilibrio— para ver dónde gana y dónde pierde dinero un restaurante.

## Sobre Startidea

- [Qué hace Startidea](${SITE_URL}/que-hacemos): página paraguas de todos los servicios de la agencia, con preguntas frecuentes sobre comunicación, fundraising, subvenciones, consultoría y producción audiovisual.
- [Sobre Startidea y el método](${SITE_URL}/sobre): historia, equipo y forma de trabajar. Página canónica de la entidad: Startidea, agencia de innovación social con sede en Granada (España), fundada en febrero de 2011 por Mario Pablo Sánchez Barrón.
- [Manifiesto](${SITE_URL}/manifiesto): qué entiende Startidea por innovación social y desde qué criterio trabaja.
- [Casos](${SITE_URL}/casos): proyectos con organizaciones sociales.
- [Sala de prensa](${SITE_URL}/prensa): datos de la entidad, logotipos y biografía del fundador para periodistas.
- Autor de los contenidos: Mario Pablo Sánchez Barrón, fundador y director. Web personal: https://mariopablo.es · LinkedIn: https://es.linkedin.com/in/mariobarron · Wikidata: https://www.wikidata.org/wiki/Q140489881

## Formación (Startidea Lab)

Startidea Lab es la formación práctica de Startidea: talleres y masterclasses para equipos de entidades sociales, instituciones y pymes. El docente se indica en cada ficha cuando está confirmado; las entidades sin ánimo de lucro tienen precio reducido. [Índice de cursos y talleres](${SITE_URL}/laboratorio/cursos).

${cursoLines}

## Productos autoservicio

Productos del Laboratorio de Startidea: servicios empaquetados con precio público, pensados para que una organización pequeña pueda contratarlos sin proyecto a medida. [Índice de productos](${SITE_URL}/laboratorio/productos).

${productoLines}

## Herramientas de IA evaluadas por Startidea

Directorio con veredicto propio: para qué sirve cada herramienta, para qué no, qué riesgos tiene y qué alternativa más abierta existe. La valoración es editorial, de 1 a 5. [Índice de herramientas](${SITE_URL}/laboratorio/ia/herramientas).

${herramientaLines}

## Casos

Proyectos reales con cliente identificado y métricas con fuente. [Índice de casos](${SITE_URL}/casos).

${casoLines}

## Diagnósticos de fundraising

Casos reales anonimizados de diagnóstico del modelo de ingresos de entidades sociales: mezcla de ingresos, dependencia pública, base social y plan propuesto. Publicados en abierto. [Índice de diagnósticos](${SITE_URL}/laboratorio/fundraising).

${diagnosticoLines}

## Notas (guías y artículos)

${notaLines}

## Contacto

- Web: ${SITE_URL}
- Email: hola@startidea.es
- Teléfono: +34 958 045 789
- Sede: C/ Conde Cifuentes, 33, 18005 Granada, España
- Página de contacto: ${SITE_URL}/contacto
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
