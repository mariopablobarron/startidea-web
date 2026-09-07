/**
 * plano.ts — Datos del «Plano Startidea»: el mapa de servicios en forma de
 * plano de metro que usa el hero del prototipo `/lab/home-plano`.
 *
 * Origen de la taxonomía: las «cuatro puertas de entrada» del Plan 5.0
 * (Consultoría, Comunicación, Audiovisual, Tecnología) + el Laboratorio como
 * terminal común. SOLO usa lo que ya es público en la web: nada de capas,
 * motores de valor ni niveles del plan estratégico (confidencial).
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

export const LINEAS: Linea[] = [
  { id: 'l1', nombre: 'Consultoría', color: '#E6356B', y: 110 },
  { id: 'l4', nombre: 'Tecnología', color: '#2E9A6C', y: 200 },
  { id: 'l2', nombre: 'Comunicación', color: '#2F6FD6', y: 290 },
  { id: 'l3', nombre: 'Audiovisual', color: '#D98A1C', y: 380 },
  { id: 'l5', nombre: 'Lab · Formación', color: '#6E6C7C' },
];

export const ESTACIONES: Estacion[] = [
  // L1 Consultoría
  { id: 'diagnostico', label: 'Diagnóstico', url: '/diagnostico', lineas: ['l1'], x: 120, y1: 110, y2: 110, labelPos: 'top', pistas: 'no sé por dónde empezar, análisis, auditoría' },
  { id: 'estrategia', label: 'Estrategia', url: '/consultoria', lineas: ['l1'], x: 260, y1: 110, y2: 110, labelPos: 'top', pistas: 'plan estratégico, organización, patronato' },
  { id: 'fundraising', label: 'Fundraising', url: '/fundraising', lineas: ['l1'], x: 420, y1: 110, y2: 110, labelPos: 'top', pistas: 'captar fondos, donantes, socios, campañas de captación' },
  { id: 'impacto', label: 'Medición de impacto', url: '/consultoria', lineas: ['l1'], x: 720, y1: 110, y2: 110, labelPos: 'top', pistas: 'memoria, indicadores, evaluación, ESG' },
  // L4 Tecnología
  { id: 'web', label: 'Web editorial', url: '/tecnologia', lineas: ['l4'], x: 120, y1: 200, y2: 200, labelPos: 'bottom', pistas: 'página web, rediseño, migración WordPress, intranet, plataforma' },
  { id: 'agentes', label: 'Agentes de IA', url: '/agentes-ia', lineas: ['l4'], x: 440, y1: 200, y2: 200, labelPos: 'bottom', pistas: 'chatbot, asistente con documentos, automatización' },
  { id: 'proteccion', label: 'Protección digital', url: '/proteccion-digital', lineas: ['l4'], x: 720, y1: 200, y2: 200, labelPos: 'bottom', pistas: 'seguridad, copias, dominio, hackeo' },
  // L2 Comunicación
  { id: 'marca', label: 'Marca y estrategia', url: '/comunicacion', lineas: ['l2'], x: 120, y1: 290, y2: 290, labelPos: 'top', pistas: 'identidad, plan de comunicación, mensajes, portavoces' },
  { id: 'campanas', label: 'Campañas', url: '/comunicacion', lineas: ['l2'], x: 440, y1: 290, y2: 290, labelPos: 'top', pistas: 'campaña de sensibilización, publicidad, Ad Grants' },
  { id: 'eclesial', label: 'Comunicación eclesial', url: '/comunicacion-eclesial', lineas: ['l2'], x: 580, y1: 290, y2: 290, labelPos: 'top', pistas: 'parroquia, diócesis, congregación, colegio religioso' },
  // L3 Audiovisual
  { id: 'estudio', label: 'Estudio en el Hub', url: '/hub', lineas: ['l3'], x: 120, y1: 380, y2: 380, labelPos: 'bottom', pistas: 'grabar, estudio de podcast, radio, alquiler' },
  { id: 'video', label: 'Vídeo', url: '/audiovisual', lineas: ['l3'], x: 300, y1: 380, y2: 380, labelPos: 'bottom', pistas: 'vídeo institucional, reels, memoria en vídeo' },
  { id: 'streaming', label: 'Streaming y eventos', url: '/audiovisual', lineas: ['l3'], x: 480, y1: 380, y2: 380, labelPos: 'bottom', pistas: 'directo, gala, jornada, retransmisión' },
  // Transbordos
  { id: 'subvenciones', label: 'Subvenciones · Copiloto', url: '/subvenciones', lineas: ['l1', 'l4'], x: 560, y1: 110, y2: 200, labelPos: 'right', pistas: 'convocatoria, ayuda pública, BDNS, Junta, presentar solicitud, tramitar' },
  { id: 'redes', label: 'Redes sociales con IA', url: '/redes-sociales-ia', lineas: ['l4', 'l2'], x: 300, y1: 200, y2: 290, labelPos: 'right', pistas: 'Instagram, LinkedIn, community manager, contenidos' },
  { id: 'videopodcast', label: 'Videopódcast', url: '/videopodcast', lineas: ['l2', 'l3'], x: 720, y1: 290, y2: 380, labelPos: 'right', pistas: 'podcast institucional, entrevistas, programa' },
  { id: 'lab', label: 'Startidea Lab · cursos', url: '/laboratorio/cursos', lineas: ['l1', 'l4', 'l2', 'l3', 'l5'], x: 900, y1: 110, y2: 380, labelPos: 'below-term', pistas: 'curso, taller, formación, masterclass, aprender, herramientas de IA' },
];

export const INTENCIONES: Intencion[] = [
  { id: 'subvenciones', label: 'Subvenciones', linea: 'l1', chip: true, patron: 'subvenc|convocatoria|ayuda p|bdns|junta de|tramitar|financiaci', say: 'Subvenciones es un transbordo: consultoría para formular y tecnología para localizar y preparar la solicitud. Startidea tramita a éxito.', estaciones: ['subvenciones', 'fundraising', 'lab'] },
  { id: 'fundraising', label: 'Captar fondos', linea: 'l1', patron: 'fondo|donante|captar|fundrais|socios|cuota', say: 'Captar fondos empieza en consultoría, con un plan de captación, y se apoya en campañas y subvenciones.', estaciones: ['fundraising', 'subvenciones', 'campanas'] },
  { id: 'eclesial', label: 'Eclesial', linea: 'l2', patron: 'parroqu|di[oó]ces|congrega|iglesia|eclesi|religios', say: 'Para diócesis, congregaciones y parroquias hay una estación propia en Comunicación, con web y vídeo cuando hacen falta.', estaciones: ['eclesial', 'web', 'videopodcast'] },
  { id: 'video', label: 'Vídeo y pódcast', linea: 'l3', chip: true, patron: 'v[ií]deo|p[oó]dcast|grabar|estudio|streaming|directo|gala', say: 'Vídeo y pódcast es la línea 3, con estudio propio en el Hub. El videopódcast institucional es el transbordo con Comunicación.', estaciones: ['video', 'videopodcast', 'estudio'] },
  { id: 'formacion', label: 'Formación', linea: 'l5', chip: true, patron: 'curso|formaci|taller|aprend|masterclass|capacit', say: 'Formación es la terminal común: todas las líneas acaban en el Lab. Talleres presenciales y masterclasses online, con precio para entidades sin ánimo de lucro.', estaciones: ['lab'] },
  { id: 'ia', label: 'IA', linea: 'l4', chip: true, patron: '\\bia\\b|inteligencia artificial|agente|chatbot|automatiz|gpt|claude', say: 'IA aparece en varias líneas: agentes con tus documentos, redes con IA y el Lab con cursos y herramientas evaluadas.', estaciones: ['agentes', 'redes', 'lab'] },
  { id: 'web', label: 'Web o plataforma', linea: 'l4', chip: true, patron: 'web|plataforma|intranet|p[aá]gina|app|wordpress|tienda', say: 'Web o plataforma es la línea 4. Web editorial si es contar; plataforma a medida si es operar. Ambas con mantenimiento después.', estaciones: ['web', 'agentes', 'proteccion'] },
  { id: 'comunicacion', label: 'Comunicación', linea: 'l2', chip: true, patron: 'comunic|redes|instagram|linkedin|campa[nñ]a|marca|prensa|difusi', say: 'Comunicación es la línea 2. Suele empezar por marca y estrategia y, si el equipo es pequeño, por redes con IA.', estaciones: ['marca', 'redes', 'campanas'] },
  { id: 'consultoria', label: 'Estrategia', linea: 'l1', patron: 'estrateg|diagn[oó]stico|impacto|evaluaci|patronato|plan ', say: 'Estrategia es la línea 1: diagnóstico primero, plan después, medición al final.', estaciones: ['diagnostico', 'estrategia', 'impacto'] },
];

export const CHIPS = INTENCIONES.filter((i) => i.chip);

export function getEstacion(id: string): Estacion | undefined {
  return ESTACIONES.find((e) => e.id === id);
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
