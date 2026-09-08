/**
 * copiloto-perfil.ts — validación del perfil de organización del Copiloto
 * (alta y edición). Pura: sin BD ni red, para poder probarla.
 *
 * El plan de negocio del Copiloto Pro promete «el perfil se rellena una vez y
 * se mantiene»: la organización lo edita desde /subvenciones/mi-copiloto/perfil
 * sin escribir a nadie. Cambiar el email NO se permite aquí (es la identidad
 * del perfil y del manage_token); se hace por soporte.
 */

export const ORG_TIPOS: Record<string, string> = {
  asociacion: 'Asociación',
  fundacion: 'Fundación',
  cooperativa: 'Cooperativa / Empresa social',
  empresa: 'Empresa con propósito',
  otro: 'Otra entidad',
};

export interface ProfileUpdateData {
  org_nombre: string;
  org_cif: string;
  org_tipo: string;
  org_descripcion: string;
  representante: string;
  telefono: string;
  web: string;
  ccaa: string;
  keywords: string;
  finalidades: string[];
  territorios: string[];
  importe_min: number;
  importe_max: number | null;
  auto_generar: boolean;
  anos_activos: number;
  beneficiarios_anuales: number;
  presupuesto_anual: string;
  proyectos_anteriores: string;
  logros_principales: string;
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function slugList(v: unknown, max = 10): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const s = x.trim().toLowerCase();
    if (/^[a-z0-9-]{2,40}$/.test(s) && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function nonNegInt(v: unknown, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.floor(n));
}

/**
 * Valida y normaliza el cuerpo de una edición de perfil. Devuelve un error
 * legible para el formulario si algo obligatorio falta.
 */
export function parseProfileUpdate(body: Record<string, unknown>): { ok: true; data: ProfileUpdateData } | { ok: false; error: string } {
  const org_nombre = text(body.org_nombre, 200);
  const org_tipo = text(body.org_tipo, 30) || 'asociacion';
  const org_descripcion = text(body.org_descripcion, 800);
  const representante = text(body.representante, 150);
  if (!org_nombre) return { ok: false, error: 'El nombre de la organización es obligatorio.' };
  if (!ORG_TIPOS[org_tipo]) return { ok: false, error: 'Tipo de organización no válido.' };
  if (org_descripcion.length < 40) return { ok: false, error: 'La descripción de actividades es demasiado corta (mínimo 40 caracteres).' };
  if (!representante) return { ok: false, error: 'El nombre del representante es obligatorio.' };

  const ccaa = text(body.ccaa, 40).toLowerCase();
  let territorios = slugList(body.territorios);
  if (territorios.length === 0) territorios = ccaa ? [ccaa] : ['nacional'];

  const importe_min = nonNegInt(body.importe_min, 100_000_000);
  const rawMax = body.importe_max === '' || body.importe_max === null || body.importe_max === undefined ? null : Number(body.importe_max);
  const importe_max = rawMax !== null && Number.isFinite(rawMax) && rawMax > 0 ? Math.floor(rawMax) : null;
  if (importe_max !== null && importe_max < importe_min) return { ok: false, error: 'El importe máximo no puede ser menor que el mínimo.' };

  return {
    ok: true,
    data: {
      org_nombre,
      org_cif: text(body.org_cif, 20).toUpperCase(),
      org_tipo,
      org_descripcion,
      representante,
      telefono: text(body.telefono, 30),
      web: text(body.web, 200),
      ccaa,
      keywords: text(body.keywords, 300),
      finalidades: slugList(body.finalidades),
      territorios,
      importe_min,
      importe_max,
      auto_generar: body.auto_generar !== false && body.auto_generar !== 'false' && body.auto_generar !== 0,
      anos_activos: nonNegInt(body.anos_activos, 200),
      beneficiarios_anuales: nonNegInt(body.beneficiarios_anuales, 10_000_000),
      presupuesto_anual: text(body.presupuesto_anual, 50),
      proyectos_anteriores: text(body.proyectos_anteriores, 600),
      logros_principales: text(body.logros_principales, 400),
    },
  };
}
