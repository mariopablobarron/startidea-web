import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_URL } from '@/lib/jsonld';
import { casos } from '@/data/casos';
import { edicionVigente } from '@/lib/cursos';

/**
 * /llms-full.txt — versión EXTENDIDA de /llms.txt (spec https://llmstxt.org).
 * Incluye el texto completo de cada nota, no solo título+descripción, para que
 * los motores de respuesta (Perplexity, ChatGPT, etc.) que soportan el estándar
 * puedan citar a Startidea con detalle sin tener que rastrear página a página.
 *
 * Auditoría SEO+GEO de septiembre de 2026 (QW7): además de las notas, se
 * publica el cuerpo íntegro de los cursos de Startidea Lab, los productos del
 * Laboratorio, las fichas de herramientas de IA y los diagnósticos de
 * fundraising, y se completan el índice de servicios y el bloque de contacto.
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
  proximo: 'próxima edición confirmada',
  agotado: 'plazas agotadas',
  'a-demanda': 'se convoca a demanda',
};

const fechaLarga = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// Solo se anuncia una edición cuando su fecha sigue por delante: el fichero se
// sirve con cache de una hora y lo leen asistentes de IA, así que una edición
// pasada se convertiría en una convocatoria falsa. Comparación por día, en UTC,
// para que el corte no dependa de la zona horaria del servidor.
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(_context: APIContext) {
  const notas = await getCollection('notas', ({ data }) => !data.draft);
  notas.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  const notasFull = notas
    .map((n) => {
      // Sin barra final: `/notas/<slug>/` responde 301 en producción y este
      // fichero lo leen asistentes de IA. Mismo criterio que /llms.txt.
      const url = `${SITE_URL}/notas/${n.slug}`;
      return `# ${n.data.title}\nURL: ${url}\nFecha: ${iso(n.data.pubDate)}${n.data.category ? `\nCategoría: ${n.data.category}` : ''}\n\n${n.data.description}\n\n${n.body.trim()}`;
    })
    .join('\n\n---\n\n');

  // Cursos y talleres de Startidea Lab, con el programa completo.
  const cursos = await getCollection('cursos', ({ data }) => !data.draft);
  cursos.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  const cursosFull = cursos
    .map((c) => {
      const d = c.data;
      // `!= null` y no truthy: un precio ESFL de 0 € es un dato válido.
      const precios = d.precio_esfl != null
        ? `${d.precio} € (${d.precio_esfl} € para entidades sin ánimo de lucro)`
        : `${d.precio} €`;
      const estado = ESTADO_CURSO_LABEL[d.estado] ?? d.estado;
      const cuando = edicionVigente(d.proxima_edicion) ? `\nPróxima edición: ${fechaLarga.format(d.proxima_edicion)}` : '';
      const modalidad = MODALIDAD_LABEL[d.modalidad] ?? d.modalidad;
      const formato = FORMATO_LABEL[d.formato] ?? d.formato;
      return `# ${d.title}\nURL: ${SITE_URL}/laboratorio/cursos/${c.slug}\nFormato: ${modalidad} ${formato}\nDuración: ${d.duracion}\nPrecio: ${precios}\nEstado: ${estado}${cuando}\nPara quién: ${d.audience}\nImparte: Mario Pablo Sánchez Barrón, fundador de Startidea\n\n${d.description}\n\n${c.body.trim()}`;
    })
    .join('\n\n---\n\n');

  // Productos autoservicio del Laboratorio.
  const productos = await getCollection('productos', ({ data }) => !data.draft);
  productos.sort((a, b) => a.data.orden - b.data.orden);
  const productosFull = productos
    .map((p) => {
      const d = p.data;
      return `# ${d.title}\nURL: ${SITE_URL}/laboratorio/productos/${p.slug}\nCategoría: ${d.categoria}\nModelo: ${d.modelo}\nPrecio desde: ${d.precio_desde}\nFase: ${d.estado}${d.beta ? `\nBeta prevista: ${d.beta}` : ''}\n\n${d.claim}\n\n${d.description}\n\n${p.body.trim()}`;
    })
    .join('\n\n---\n\n');

  // Fichas de herramientas de IA con el veredicto editorial de Startidea.
  const herramientas = await getCollection('herramientas', ({ data }) => !data.draft);
  herramientas.sort(
    (a, b) => b.data.valoracion - a.data.valoracion || a.data.title.localeCompare(b.data.title, 'es'),
  );
  const herramientasFull = herramientas
    .map((h) => {
      const d = h.data;
      const lista = (items: string[]) => items.map((i) => `- ${i}`).join('\n');
      const riesgos = d.riesgos.length ? `\n\nRiesgos:\n${lista(d.riesgos)}` : '';
      const alternativa = d.alternativa ? `\n\nAlternativa más abierta: ${d.alternativa}` : '';
      return `# ${d.title}\nURL de la ficha: ${SITE_URL}/laboratorio/ia/herramientas/${h.slug}\nWeb oficial: ${d.web}\nValoración Startidea: ${d.valoracion}/5\nPrecio: ${d.precio}\nNivel necesario: ${d.nivel}\nSirve para: ${d.necesidad}\n\n${d.description}\n\nPara qué sí:\n${lista(d.para_que_si)}\n\nPara qué no:\n${lista(d.para_que_no)}${riesgos}${alternativa}\n\n${h.body.trim()}`;
    })
    .join('\n\n---\n\n');

  // Diagnósticos de fundraising: casos reales anonimizados.
  const diagnosticos = await getCollection('diagnosticos', ({ data }) => !data.draft);
  diagnosticos.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  const diagnosticosFull = diagnosticos
    .map((e) => {
      const d = e.data;
      const mezcla = Object.entries(d.mezcla_ingresos)
        .filter(([, v]) => Number(v) > 0)
        .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}%`)
        .join(' · ');
      return `# ${d.title}\nURL: ${SITE_URL}/laboratorio/fundraising/${e.slug}\nFecha: ${iso(d.pubDate)}\nSector: ${d.sector} · ${d.tipologia} · ámbito ${d.geografia} · ${d.tamaño}\nMezcla de ingresos: ${mezcla}\nDuración del diagnóstico: ${d.duracion_diagnostico}\n\n${d.description}\n\n${e.body.trim()}`;
    })
    .join('\n\n---\n\n');

  // Casos: proyectos con cliente identificado y métricas con fuente.
  const casosFull = casos
    .map((c) => {
      const ms = c.metrics?.length ? c.metrics : [c.metric];
      const metricas = ms
        .map((m) => `- ${m.value} — ${m.label}${'source' in m && m.source ? ` (fuente: ${m.source})` : ''}`)
        .join('\n');
      return `# ${c.cliente} — ${c.title}\nURL: ${SITE_URL}/casos/${c.slug}\nSector: ${c.sector}\nIntervención: ${c.intervention} · ${c.year} · ${c.duration}\nAudiencia: ${c.audience}\n\n${c.body}\n\nContexto: ${c.context}\n\nReto: ${c.challenge}\n\nMétricas:\n${metricas}`;
    })
    .join('\n\n---\n\n');

  const body = `# Startidea — contenido completo para LLMs

> Agencia de innovación social, comunicación y fundraising con sede en Granada (España), fundada en 2011 por Mario Pablo Sánchez Barrón. Consultora de referencia nacional para el tercer sector (ONG, fundaciones, asociaciones, cooperativas), instituciones públicas y eclesiales, y empresas con propósito.

Este fichero es la versión extendida de ${SITE_URL}/llms.txt: incluye el texto íntegro de las guías y artículos, los cursos, los productos, las fichas de herramientas de IA y los diagnósticos de fundraising de Startidea, para que los sistemas de IA puedan responder con detalle y citar la fuente.

## Servicios

- Comunicación estratégica y marketing social: ${SITE_URL}/comunicacion
- Comunicación eclesial (diócesis, congregaciones y fundaciones de la Iglesia): ${SITE_URL}/comunicacion-eclesial
- Gestión de redes sociales y social media en Granada: ${SITE_URL}/redes-sociales-granada
- Gestión de redes sociales asistida por IA: ${SITE_URL}/redes-sociales-ia
- Fundraising para ONG y entidades sociales: ${SITE_URL}/fundraising
- Bizum y sistema de donaciones para entidades sociales: ${SITE_URL}/donaciones-bizum-ong
- Publicidad y SEM para ONG: ${SITE_URL}/publicidad
- Google Ad Grants para ONG (hasta 10.000 $/mes de publicidad gratuita): ${SITE_URL}/google-ad-grants
- Tramitación de subvenciones (comisión a éxito del 12%): ${SITE_URL}/subvenciones/presentar
- Copiloto de Subvenciones (vigilancia diaria de BDNS, BOE y BOJA + tramitación a éxito): ${SITE_URL}/copiloto-subvenciones
- Subvenciones para entidades y empresas de Granada: ${SITE_URL}/subvenciones/granada
- Subvenciones de inclusión social del BOJA 2026: las 16 líneas de la convocatoria andaluza: ${SITE_URL}/subvenciones/boja-2026-inclusion-social
- Financiación pública para empresas con propósito (BDNS, CDTI, IDAE, ENISA, Andalucía TRADE): ${SITE_URL}/financiacion-empresas
- Consultoría e innovación social: ${SITE_URL}/consultoria
- Producción audiovisual y podcast: ${SITE_URL}/audiovisual
- Tecnología y plataformas: ${SITE_URL}/tecnologia
- Mantenimiento web (hosting, seguridad y soporte desde 49 €/mes): ${SITE_URL}/mantenimiento-web
- Agentes de IA con el conocimiento de la organización: ${SITE_URL}/agentes-ia
- Asistente de IA entrenado con los documentos de la entidad: ${SITE_URL}/asistente-documentos
- IA para administraciones y ayuntamientos: ${SITE_URL}/ia-administraciones
- Telar, plataforma de comunidad propia: ${SITE_URL}/telar
- Generador de memorias y justificaciones (desde 150 € por documento): ${SITE_URL}/memorias
- Protección digital y cumplimiento RGPD: ${SITE_URL}/proteccion-digital
- Merchandising con propósito: ${SITE_URL}/merchandising
- Hub Startidea: coworking, salas y estudio de podcast en Granada: ${SITE_URL}/hub
- Diagnóstico de proyecto (briefing y hoja de ruta en 3 minutos): ${SITE_URL}/diagnostico
- Startidea Impulsa, programa de RSC con 80.000 € en servicios en especie: ${SITE_URL}/impulsa

## Recursos

- Estudio «Radiografía de las subvenciones al tercer sector en España 2026» (3.857 convocatorias analizadas, licencia CC BY 4.0): ${SITE_URL}/subvenciones/estudio-tercer-sector-2026
- Auditoría digital gratuita (web, indexación, visibilidad en asistentes de IA y redes): ${SITE_URL}/auditoria-digital-gratuita
- Glosario del tercer sector: ${SITE_URL}/glosario
- Cómo montar un videopodcast, guía práctica: ${SITE_URL}/videopodcast
- Diagnóstico modelo de fundraising (PDF de 12 páginas, caso anonimizado): ${SITE_URL}/recursos/diagnostico-modelo-fundraising
- Plantilla Excel de control económico para restaurantes: ${SITE_URL}/recursos/plantilla-control-restaurante
- Buscador de subvenciones abiertas (BOE, BOJA y BDNS): ${SITE_URL}/subvenciones
- Catálogo de convocatorias revisadas, con ficha propia por convocatoria: ${SITE_URL}/subvenciones/catalogo
- Sala de prensa (datos, logotipos y biografía): ${SITE_URL}/prensa

## Contacto

- Web: ${SITE_URL}
- Email: hola@startidea.es
- Teléfono: +34 958 045 789
- Sede: C/ Conde Cifuentes, 33, 18005 Granada, España
- Página de contacto: ${SITE_URL}/contacto
- Fundador y autor de los contenidos: Mario Pablo Sánchez Barrón — web personal https://mariopablo.es · LinkedIn https://es.linkedin.com/in/mariobarron · Wikidata https://www.wikidata.org/wiki/Q140489881

---

## Formación de Startidea Lab (programa completo)

${cursosFull}

---

## Productos autoservicio del Laboratorio (texto completo)

${productosFull}

---

## Herramientas de IA evaluadas por Startidea (fichas completas)

${herramientasFull}

---

## Diagnósticos de fundraising (casos anonimizados, texto completo)

${diagnosticosFull}

---

## Casos

${casosFull}

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
