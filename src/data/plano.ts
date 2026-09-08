/**
 * plano.ts — Datos del «Plano Startidea»: el mapa de servicios en forma de
 * plano de metro que usa el hero del prototipo `/lab/home-plano`.
 *
 * Origen de la taxonomía: las cuatro puertas de entrada públicas de Startidea
 * (Consultoría, Comunicación, Audiovisual, Tecnología) + el Laboratorio como
 * terminal común. SOLO usa lo que ya es público en la web; nada de documentación
 * interna de estrategia.
 *
 * Lo comparten: el componente (render + atajos sin IA), el endpoint
 * `/api/plano` (clasificación por palabras clave y catálogo para el modelo)
 * y la vista `/admin/plano` (etiquetas legibles).
 */

export type LineaId = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';

export interface Linea {
  id: LineaId;
  nombre: string;
  /** Color Tailwind/CSS de la línea (hex, para SVG). */
  color: string;
  y?: number;
}

export interface Estacion {
  id: string;
  label: string;
  url: string;
  /** Líneas que pasan por la estación. Más de una = transbordo. */
  lineas: LineaId[];
  x: number;
  /** Para estaciones simples: y de la línea. Para transbordos: y1/y2. */
  y1: number;
  y2: number;
  labelPos: 'top' | 'bottom' | 'right' | 'below-term';
  /** Palabras que ayudan al modelo a elegirla (no se muestran). */
  pistas?: string;
}

export interface Intencion {
  id: string;
  /** Etiqueta del atajo (chip). */
  label: string;
  linea: LineaId;
  /** Frase corta que acompaña la ruta. */
  say: string;
  estaciones: string[];
  /** Regex (fuente) para clasificar texto libre sin modelo. Orden = prioridad. */
  patron: string;
  /** Si es false no sale como chip, solo como intención clasificable. */
  chip?: boolean;
}

/**
 * Audiencias: las mismas cuatro del formulario de diagnóstico (/diagnostico).
 * Cada una trae un ejemplo de pregunta para el placeholder, para que el hero
 * no parezca solo para entidades sociales ni gire siempre en torno al
 * fundraising (feedback Mario 2026-09-07).
 */
export interface Audiencia {
  id: string;
  label: string;
  ejemplo: string;
}

export const AUDIENCIAS: Audiencia[] = [
  { id: 'empresa', label: 'Empresa', ejemplo: 'Somos una pyme y queremos que la web traiga clientes, no solo visitas' },
  { id: 'institucion', label: 'Institución', ejemplo: 'Un ayuntamiento que necesita contar bien lo que hace, con vídeo y redes' },
  { id: 'entidad-social', label: 'Entidad social', ejemplo: 'Una asociación que quiere presentar una subvención sin volverse loca' },
  { id: 'emprendedor', label: 'Emprendedor/a', ejemplo: 'Tengo una idea con propósito y no sé si empezar por la marca, la web o la financiación' },
];

export const LINEAS: Linea[] = [
  { id: 'l1', nombre: 'Consultoría', color: '#E6356B', y: 110 },
  { id: 'l4', nombre: 'Tecnología', color: '#2E9A6C', y: 200 },
  { id: 'l2', nombre: 'Comunicación', color: '#2F6FD6', y: 290 },
  { id: 'l3', nombre: 'Audiovisual', color: '#D98A1C', y: 380 },
  { id: 'l5', nombre: 'Lab · Formación', color: '#6E6C7C' },
];

export const ESTACIONES: Estacion[] = [
  // L1 Consultoría
  { id: 'diagnostico', label: 'Diagnóstico', url: '/diagnostico', lineas: ['l1'], x: 120, y1: 110, y2: 110, labelPos: 'top', pistas: 'no sé por dónde empezar, análisis, auditoría, segunda opinión' },
  { id: 'estrategia', label: 'Estrategia', url: '/consultoria', lineas: ['l1'], x: 260, y1: 110, y2: 110, labelPos: 'top', pistas: 'plan estratégico, organización, patronato, dirección, propósito de empresa, RSC' },
  { id: 'fundraising', label: 'Fundraising', url: '/fundraising', lineas: ['l1'], x: 420, y1: 110, y2: 110, labelPos: 'top', pistas: 'captar fondos, donantes, socios, campañas de captación' },
  { id: 'impacto', label: 'Impacto y RSC', url: '/consultoria', lineas: ['l1'], x: 720, y1: 110, y2: 110, labelPos: 'top', pistas: 'memoria, indicadores, evaluación, ESG, RSC, sostenibilidad, reporting' },
  // L4 Tecnología
  { id: 'web', label: 'Web editorial', url: '/tecnologia', lineas: ['l4'], x: 120, y1: 200, y2: 200, labelPos: 'bottom', pistas: 'página web, rediseño, migración WordPress, intranet, plataforma, tienda online, app, captar clientes o pacientes' },
  { id: 'agentes', label: 'Agentes de IA', url: '/agentes-ia', lineas: ['l4'], x: 440, y1: 200, y2: 200, labelPos: 'bottom', pistas: 'chatbot, asistente con documentos, automatización' },
  { id: 'proteccion', label: 'Protección digital', url: '/proteccion-digital', lineas: ['l4'], x: 720, y1: 200, y2: 200, labelPos: 'bottom', pistas: 'seguridad, copias, dominio, hackeo' },
  // L2 Comunicación
  { id: 'marca', label: 'Marca y estrategia', url: '/comunicacion', lineas: ['l2'], x: 120, y1: 290, y2: 290, labelPos: 'top', pistas: 'identidad, logo, naming, plan de comunicación, mensajes, portavoces, marca personal' },
  { id: 'campanas', label: 'Campañas', url: '/comunicacion', lineas: ['l2'], x: 440, y1: 290, y2: 290, labelPos: 'top', pistas: 'campaña, lanzamiento, publicidad, anuncios, Ad Grants, prensa' },
  { id: 'eclesial', label: 'Comunicación eclesial', url: '/comunicacion-eclesial', lineas: ['l2'], x: 580, y1: 290, y2: 290, labelPos: 'top', pistas: 'parroquia, diócesis, congregación, colegio religioso' },
  // L3 Audiovisual
  { id: 'estudio', label: 'Estudio en el Hub', url: '/hub', lineas: ['l3'], x: 120, y1: 380, y2: 380, labelPos: 'bottom', pistas: 'grabar, estudio de podcast, radio, alquiler' },
  { id: 'video', label: 'Vídeo', url: '/audiovisual', lineas: ['l3'], x: 300, y1: 380, y2: 380, labelPos: 'bottom', pistas: 'vídeo corporativo o institucional, reels, testimonios, producto' },
  { id: 'streaming', label: 'Streaming y eventos', url: '/audiovisual', lineas: ['l3'], x: 480, y1: 380, y2: 380, labelPos: 'bottom', pistas: 'directo, gala, jornada, retransmisión' },
  // Transbordos
  { id: 'subvenciones', label: 'Financiación pública · Copiloto', url: '/subvenciones', lineas: ['l1', 'l4'], x: 560, y1: 110, y2: 200, labelPos: 'right', pistas: 'convocatoria, ayuda pública, BDNS, Junta, CDTI, ENISA, Kit Digital, presentar solicitud, tramitar' },
  { id: 'redes', label: 'Redes sociales con IA', url: '/redes-sociales-ia', lineas: ['l4', 'l2'], x: 300, y1: 200, y2: 290, labelPos: 'right', pistas: 'Instagram, LinkedIn, TikTok, community manager, contenidos, reels' },
  { id: 'videopodcast', label: 'Videopódcast', url: '/videopodcast', lineas: ['l2', 'l3'], x: 720, y1: 290, y2: 380, labelPos: 'right', pistas: 'podcast institucional, entrevistas, programa' },
  { id: 'lab', label: 'Startidea Lab · cursos', url: '/laboratorio/cursos', lineas: ['l1', 'l4', 'l2', 'l3', 'l5'], x: 900, y1: 110, y2: 380, labelPos: 'below-term', pistas: 'curso, taller, formación, masterclass, aprender, herramientas de IA' },
];

export const INTENCIONES: Intencion[] = [
  { id: 'web', label: 'Web o plataforma', linea: 'l4', chip: true, patron: 'web|plataforma|intranet|p[aá]gina|app|wordpress|tienda|clientes|pacientes', say: 'Web o plataforma es la línea 4. Web editorial si es contar; plataforma a medida si es operar. Vale igual para una clínica, un ayuntamiento o una fundación.', estaciones: ['web', 'agentes', 'proteccion'] },
  { id: 'comunicacion', label: 'Comunicación', linea: 'l2', chip: true, patron: 'comunic|redes|instagram|linkedin|tiktok|campa[nñ]a|marca|logo|prensa|difusi|lanzam', say: 'Comunicación es la línea 2. Suele empezar por marca y estrategia y, si el equipo es pequeño, por redes con IA. Sirve para una empresa, una institución o un proyecto que arranca.', estaciones: ['marca', 'redes', 'campanas'] },
  { id: 'video', label: 'Vídeo y pódcast', linea: 'l3', chip: true, patron: 'v[ií]deo|p[oó]dcast|grabar|estudio|streaming|directo|gala|evento', say: 'Vídeo y pódcast es la línea 3, con estudio propio en el Hub. Del vídeo corporativo al videopódcast institucional, que es el transbordo con Comunicación.', estaciones: ['video', 'videopodcast', 'estudio'] },
  { id: 'ia', label: 'IA', linea: 'l4', chip: true, patron: '\\bia\\b|inteligencia artificial|agente|chatbot|automatiz|gpt|claude', say: 'IA aparece en varias líneas: agentes que responden con tus documentos, redes con IA y el Lab con cursos y herramientas evaluadas.', estaciones: ['agentes', 'redes', 'lab'] },
  { id: 'subvenciones', label: 'Financiación pública', linea: 'l1', chip: true, patron: 'subvenc|convocatoria|ayuda p|bdns|junta de|cdti|enisa|kit digital|tramitar|financiaci', say: 'Financiación pública es un transbordo: consultoría para formular y tecnología para localizar la convocatoria. Para pymes, ayuntamientos y asociaciones; Startidea tramita a éxito.', estaciones: ['subvenciones', 'estrategia', 'lab'] },
  { id: 'formacion', label: 'Formación', linea: 'l5', chip: true, patron: 'curso|formaci|taller|aprend|masterclass|capacit|equipo', say: 'Formación es la terminal común: todas las líneas acaban en el Lab. Talleres presenciales y masterclasses online para equipos de empresas, instituciones y entidades.', estaciones: ['lab'] },
  { id: 'fundraising', label: 'Captar fondos', linea: 'l1', patron: 'fondo|donante|captar|fundrais|socios|cuota|mecenazgo|patrocin', say: 'Captar fondos empieza en consultoría, con un plan de captación, y se apoya en campañas y financiación pública.', estaciones: ['fundraising', 'subvenciones', 'campanas'] },
  { id: 'eclesial', label: 'Eclesial', linea: 'l2', patron: 'parroqu|di[oó]ces|congrega|iglesia|eclesi|religios', say: 'Para diócesis, congregaciones y parroquias hay una estación propia en Comunicación, con web y vídeo cuando hacen falta.', estaciones: ['eclesial', 'web', 'videopodcast'] },
  { id: 'consultoria', label: 'Estrategia', linea: 'l1', patron: 'estrateg|diagn[oó]stico|impacto|evaluaci|patronato|rsc|sostenib|prop[oó]sito|plan ', say: 'Estrategia es la línea 1: diagnóstico primero, plan después, medición al final. Igual para una empresa con propósito que para una fundación.', estaciones: ['diagnostico', 'estrategia', 'impacto'] },
];

export const CHIPS = INTENCIONES.filter((i) => i.chip);

export function getEstacion(id: string): Estacion | undefined {
  return ESTACIONES.find((e) => e.id === id);
}

export function getAudiencia(id: string): Audiencia | undefined {
  return AUDIENCIAS.find((a) => a.id === id);
}

export function getIntencion(id: string): Intencion | undefined {
  return INTENCIONES.find((i) => i.id === id);
}

/** Clasificación sin modelo: primera intención cuyo patrón casa. */
export function clasificarPorPatron(texto: string): Intencion | null {
  const t = texto.toLowerCase();
  for (const i of INTENCIONES) {
    if (new RegExp(i.patron, 'i').test(t)) return i;
  }
  return null;
}

/** Catálogo compacto para el prompt del modelo. */
export function catalogoParaModelo(): string {
  return ESTACIONES.map((e) => `- ${e.id}: ${e.label} (${e.lineas.map((l) => LINEAS.find((x) => x.id === l)?.nombre).join(' + ')}). ${e.pistas ?? ''}`).join('\n');
}
