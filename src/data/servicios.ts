// Catálogo INTERNO de servicios con precio orientativo "desde X €".
// Solo se importa desde código server-side (frontmatter Astro + endpoints API).
// Los precios NUNCA llegan al cliente — el formulario público envía sólo los
// IDs seleccionados y el endpoint hace el lookup aquí para calcular el total
// que recibe el equipo por Telegram.
//
// "desde" es la base mínima razonable para arrancar el servicio. El precio
// formal siempre se cierra después del diagnóstico.

export interface Servicio {
  id: string;
  nombre: string;
  precio: number;
  unidad: '€' | '€/mes' | '€/h';
}

export interface GrupoServicios {
  nombre: string;
  href: string;
  items: Servicio[];
}

export const GRUPOS_SERVICIOS: GrupoServicios[] = [
  {
    nombre: 'Consultoría e Innovación Social',
    href: '/consultoria',
    items: [
      { id: 'diagnostico-estrategico', nombre: 'Diagnóstico estratégico de la entidad', precio: 2800, unidad: '€' },
      { id: 'diseno-proyecto', nombre: 'Diseño y formulación de proyecto social', precio: 1800, unidad: '€' },
      { id: 'plan-anual', nombre: 'Planificación estratégica anual', precio: 3200, unidad: '€' },
      { id: 'acompanamiento-direccion', nombre: 'Acompañamiento mensual a dirección', precio: 1200, unidad: '€/mes' },
    ],
  },
  {
    nombre: 'Comunicación Estratégica',
    href: '/comunicacion',
    items: [
      { id: 'plan-comunicacion', nombre: 'Plan de comunicación', precio: 2500, unidad: '€' },
      { id: 'plan-editorial-redes-3m', nombre: 'Plan editorial + redes (3 meses)', precio: 2400, unidad: '€' },
      { id: 'gestion-redes-mes', nombre: 'Gestión continua de redes (mensual)', precio: 800, unidad: '€/mes' },
      { id: 'campana-con-causa', nombre: 'Campaña con causa (3 meses)', precio: 6000, unidad: '€' },
      { id: 'memoria-editorial', nombre: 'Memoria editorial anual', precio: 3500, unidad: '€' },
      { id: 'identidad-marca', nombre: 'Identidad de marca', precio: 3500, unidad: '€' },
    ],
  },
  {
    nombre: 'Producción Audiovisual y Podcast',
    href: '/audiovisual',
    items: [
      { id: 'video-institucional', nombre: 'Vídeo institucional (3-5 min)', precio: 3500, unidad: '€' },
      { id: 'serie-podcast', nombre: 'Serie de podcast (4 episodios)', precio: 2800, unidad: '€' },
      { id: 'cobertura-evento', nombre: 'Cobertura audiovisual de evento', precio: 1800, unidad: '€' },
      { id: 'documental-corto', nombre: 'Documental corto', precio: 6000, unidad: '€' },
    ],
  },
  {
    nombre: 'Tecnología y Producto Digital',
    href: '/tecnologia',
    items: [
      { id: 'web-institucional', nombre: 'Web institucional', precio: 4500, unidad: '€' },
      { id: 'plataforma-ssr', nombre: 'Plataforma a medida con SSR', precio: 9000, unidad: '€' },
      { id: 'producto-ia', nombre: 'Producto digital con IA', precio: 12000, unidad: '€' },
      { id: 'migracion-seo', nombre: 'Migración con redirecciones y SEO', precio: 2800, unidad: '€' },
    ],
  },
  {
    nombre: 'Fundraising y Alianzas',
    href: '/fundraising',
    items: [
      { id: 'diagnostico-financiero', nombre: 'Diagnóstico financiero estratégico', precio: 2500, unidad: '€' },
      { id: 'plan-fundraising-12m', nombre: 'Plan de fundraising a 12 meses', precio: 5500, unidad: '€' },
      { id: 'materiales-captacion', nombre: 'Materiales de captación (dossier + propuestas)', precio: 3500, unidad: '€' },
      { id: 'mapeo-aliados', nombre: 'Mapeo de aliados estratégicos', precio: 1800, unidad: '€' },
      { id: 'acompanamiento-fundraising', nombre: 'Acompañamiento fundraising anual', precio: 1500, unidad: '€/mes' },
    ],
  },
  {
    nombre: 'Hub Startidea · espacios',
    href: '/hub',
    items: [
      { id: 'coworking-mes', nombre: 'Plaza coworking flexible', precio: 120, unidad: '€/mes' },
      { id: 'despacho-privado', nombre: 'Despacho privado', precio: 350, unidad: '€/mes' },
      { id: 'sala-hora', nombre: 'Sala de formación (hora)', precio: 25, unidad: '€/h' },
      { id: 'podcast-hora', nombre: 'Estudio de podcast (hora)', precio: 35, unidad: '€/h' },
    ],
  },
];

/** Versión pública sin precios — segura para serializar al cliente */
export interface ServicioPublico {
  id: string;
  nombre: string;
}
export interface GrupoPublico {
  nombre: string;
  href: string;
  items: ServicioPublico[];
}
export function gruposPublicos(): GrupoPublico[] {
  return GRUPOS_SERVICIOS.map((g) => ({
    nombre: g.nombre,
    href: g.href,
    items: g.items.map((it) => ({ id: it.id, nombre: it.nombre })),
  }));
}

/** Lookup server-side de un servicio por su ID. */
export function buscarServicio(id: string): { servicio: Servicio; grupo: string } | null {
  for (const g of GRUPOS_SERVICIOS) {
    const found = g.items.find((it) => it.id === id);
    if (found) return { servicio: found, grupo: g.nombre };
  }
  return null;
}

/** Suma precios server-side y formatea desglose para email/Telegram. */
export function calcularPresupuesto(ids: string[]): {
  lineas: string[];
  totalPuntual: number;
  totalMensual: number;
  totalHora: number;
  resumen: string;
} {
  const lineas: string[] = [];
  let totalPuntual = 0;
  let totalMensual = 0;
  let totalHora = 0;

  for (const id of ids) {
    const found = buscarServicio(id);
    if (!found) continue;
    const { servicio, grupo } = found;
    lineas.push(`• ${grupo} → ${servicio.nombre} (desde ${servicio.precio} ${servicio.unidad})`);
    if (servicio.unidad === '€/mes') totalMensual += servicio.precio;
    else if (servicio.unidad === '€/h') totalHora += servicio.precio;
    else totalPuntual += servicio.precio;
  }

  const partes: string[] = [];
  if (totalPuntual > 0) partes.push(`${totalPuntual.toLocaleString('es-ES')} €`);
  if (totalMensual > 0) partes.push(`${totalMensual.toLocaleString('es-ES')} €/mes`);
  if (totalHora > 0) partes.push(`${totalHora.toLocaleString('es-ES')} €/h`);
  const resumen = partes.length > 0 ? partes.join(' + ') : 'sin servicios marcados';

  return { lineas, totalPuntual, totalMensual, totalHora, resumen };
}
