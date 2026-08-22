import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

// IDs generados por el wizard público (8 hex) y por los flujos internos
// Auto-Copiloto/Campañas. Nunca se usa un dato aportado por el cliente como
// componente de la ruta nueva.
const EXPEDIENTE_ID_RE = /^(?:[A-F0-9]{8}|(?:AC|CM)-[A-Z0-9]{6,16}-[A-F0-9]{4})$/;

// Formatos españoles de NIF/NIE/CIF. Se admiten espacios y guiones de
// presentación, pero se eliminan antes de persistir. Barras, puntos y
// caracteres de control se rechazan expresamente.
const SPANISH_TAX_ID_RE = /^(?:\d{8}[A-Z]|[KLMXYZ]\d{7}[A-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J])$/;

export function normalizeSpanishTaxId(value: string): string | null {
  const candidate = value.trim().toUpperCase();
  if (!candidate || /[./\\\u0000-\u001F\u007F]/.test(candidate)) return null;

  const compact = candidate.replace(/[\s-]/g, '');
  return SPANISH_TAX_ID_RE.test(compact) ? compact : null;
}

export function isValidExpedienteId(value: string): boolean {
  return EXPEDIENTE_ID_RE.test(value);
}

function resolveChild(root: string, child: string): string {
  const base = resolve(root);
  const target = resolve(base, child);
  if (target === base || !target.startsWith(base + sep)) {
    throw new Error('expediente_path_outside_root');
  }
  return target;
}

/** Ruta canónica para expedientes nuevos: solo depende del ID interno. */
export function getExpedienteStorageDir(root: string, id: string): string {
  if (!isValidExpedienteId(id)) throw new Error('invalid_expediente_id');
  return resolveChild(root, id);
}

/**
 * Compatibilidad de lectura con las carpetas históricas `<id>-<cif>`.
 * El fallback solo se construye tras validar ambos componentes y contención.
 */
export function getLegacyExpedienteStorageDir(
  root: string,
  id: string,
  orgCif: string,
): string | null {
  if (!isValidExpedienteId(id)) return null;
  const cif = normalizeSpanishTaxId(orgCif);
  if (!cif) return null;
  return resolveChild(root, `${id}-${cif}`);
}

/** Prefiere la ruta canónica y conserva lectura segura de expedientes previos. */
export function findExpedienteStorageDir(root: string, id: string, orgCif: string): string {
  const current = getExpedienteStorageDir(root, id);
  if (existsSync(current)) return current;

  const legacy = getLegacyExpedienteStorageDir(root, id, orgCif);
  return legacy && existsSync(legacy) ? legacy : current;
}

/** Resuelve un adjunto y garantiza que permanece dentro de su expediente. */
export function resolveExpedienteFile(dir: string, diskName: string): string {
  if (!diskName) throw new Error('invalid_expediente_file');
  return resolveChild(dir, diskName);
}
