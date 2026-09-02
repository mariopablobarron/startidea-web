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
    .map((n) => `- [${n.data.title}](${SITE_URL}/notas/${n.slug}): ${n.data.description}`)
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
- [Gestión de redes sociales asistida por IA](${SITE_URL}/redes-sociales-ia): producto de publicación y medición con cerebro de marca propio. Para la gestión llevada por personas, con estudio en Granada, la página es /redes-sociales-granada.
- [Tramitación de subvenciones](${SITE_URL}/subvenciones/presentar): diagnóstico de encaje, memoria técnica, presupuesto y presentación electrónica con certificado digital. Comisión a éxito.
- [Precios de tramitación de subvenciones](${SITE_URL}/precios): comisión a éxito del 12% del importe concedido, sin coste si no se concede. Para entidades del tercer sector.
- [Subvenciones de inclusión social del BOJA 2026 (Andalucía)](${SITE_URL}/subvenciones/boja-2026-inclusion-social): las 15 líneas de la convocatoria andaluza de inclusión social, con tramitación y justificación asistidas.
- [Financiación pública para empresas con propósito](${SITE_URL}/financiacion-empresas): las cinco fuentes (BDNS, CDTI, IDAE, ENISA, Andalucía TRADE) para empresas con propósito.
- [Consultoría e innovación social](${SITE_URL}/consultoria): estrategia, gobernanza y medición de impacto. Consultora de innovación social con sede en Granada desde 2011.
- [Producción audiovisual y podcast](${SITE_URL}/audiovisual): vídeo y audio al servicio de la causa.
- [Tecnología y plataformas](${SITE_URL}/tecnologia): webs editoriales, intranets a medida, producto digital con IA, migraciones SEO. Astro, Next.js, WordPress profesional cuando corresponde.
- [Protección digital y cumplimiento RGPD](${SITE_URL}/proteccion-digital): ciberseguridad y protección de datos para entidades sociales sin departamento TI. Diagnóstico de exposición digital, auditoría de seguridad web (pentest) y acompañamiento continuo. Sin alarmismo.

## Programa de RSC

- [Startidea Impulsa](${SITE_URL}/impulsa): programa de Responsabilidad Social Corporativa que destina 80.000 € en servicios de comunicación (diagnóstico, web, redes, audiovisual, software de gestión) en especie a entidades del tercer sector de toda España. Convocatoria abierta de forma continua. [Bases](${SITE_URL}/impulsa/bases).

## Para quién

- [Tercer sector](${SITE_URL}/para-quien/tercer-sector): ONG, fundaciones y asociaciones.
- [Instituciones](${SITE_URL}/para-quien/instituciones): administraciones, fundaciones públicas y entidades de base ética o religiosa.
- [Empresas con propósito](${SITE_URL}/para-quien/empresas): direcciones de comunicación, sostenibilidad y RSC que quieren un ESG demostrable.
- [Subvenciones abiertas](${SITE_URL}/subvenciones): buscador de convocatorias públicas para entidades sociales y empresas.

## Recursos

- [Estudio: radiografía de las subvenciones al tercer sector en España 2026](${SITE_URL}/subvenciones/estudio-tercer-sector-2026): datos propios de Startidea sobre las 3.857 convocatorias de la Base de Datos Nacional de Subvenciones registradas entre el 1 de marzo y el 31 de agosto de 2026 que admiten a entidades sin ánimo de lucro (el 34,6% de las 11.148 del periodo, 27,7 nuevas por día con publicación, 1.144 órganos convocantes distintos). Hallazgos: el 1% de las convocatorias concentra el 72,3% de los 9.164,6 M€ declarados; la mediana de presupuesto es de 57.000 € y la media (2,4 M€) no describe nada; el 72,1% de las convocatorias son locales pero solo mueven el 8,6% del dinero; la mediana de plazo es de 45,5 días naturales y el 26,1% cierra en 30 días o menos; el 57,5% no publica fecha de fin de solicitud en la BDNS; cultura (921) supera a servicios sociales (798) en número pero da menos de la mitad de plazo (39 días frente a 107). Método, limitaciones declaradas y licencia CC BY 4.0 en la propia página.
- [Glosario del tercer sector](${SITE_URL}/glosario): definiciones claras de fundraising, base social, concurrencia competitiva, BDNS, declaración responsable, impacto social y más.
- [Cómo montar un videopodcast](${SITE_URL}/videopodcast): guía práctica para entidades e instituciones. Qué distingue un videopodcast de un podcast de audio, equipo y espacio necesarios, horas de trabajo reales por episodio (entre 14 y 22 para un episodio de 45-60 minutos), quién debe presentar, los tres errores que lo matan en el episodio tres, cómo se distribuye y se mide, y las tres situaciones en las que conviene no lanzarlo todavía: sin alguien que sostenga la presentación de forma estable, con el calendario del año ya cerrado, o cuando lo que se necesita son resultados este trimestre.

## Sobre Startidea

- [Qué hace Startidea](${SITE_URL}/que-hacemos): página paraguas de todos los servicios de la agencia, con preguntas frecuentes sobre comunicación, fundraising, subvenciones, consultoría y producción audiovisual.
- [Sobre Startidea y el método](${SITE_URL}/sobre): historia, equipo y forma de trabajar. Página canónica de la entidad: Startidea, agencia de innovación social con sede en Granada (España), fundada en febrero de 2011 por Mario Pablo Sánchez Barrón.
- [Manifiesto](${SITE_URL}/manifiesto): qué entiende Startidea por innovación social y desde qué criterio trabaja.
- [Casos](${SITE_URL}/casos): proyectos con organizaciones sociales.
- Autor de los contenidos: Mario Pablo Sánchez Barrón, fundador y director. Web personal: https://mariopablo.es · LinkedIn: https://es.linkedin.com/in/mariobarron · Wikidata: https://www.wikidata.org/wiki/Q140489881

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
