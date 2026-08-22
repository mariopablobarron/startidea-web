import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  findExpedienteStorageDir,
  getExpedienteStorageDir,
  normalizeSpanishTaxId,
  resolveExpedienteFile,
} from './expediente-storage';

const temporaryDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'startidea-expediente-'));
  temporaryDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (temporaryDirs.length) rmSync(temporaryDirs.pop()!, { recursive: true, force: true });
});

describe('normalizeSpanishTaxId', () => {
  it.each([
    ['B19583632', 'B19583632'],
    ['b-19583632', 'B19583632'],
    ['12345678z', '12345678Z'],
    ['X 1234567 L', 'X1234567L'],
  ])('normaliza un CIF/NIF/NIE válido', (input, expected) => {
    expect(normalizeSpanishTaxId(input)).toBe(expected);
  });

  it.each([
    '../B19583632',
    '..\\B19583632',
    '/tmp/B19583632',
    'B19583632/otro',
    'B19583632.txt',
    'no-es-un-cif',
  ])('rechaza separadores, puntos y formatos no permitidos: %s', (input) => {
    expect(normalizeSpanishTaxId(input)).toBeNull();
  });
});

describe('rutas de expedientes', () => {
  it('crea la ruta canónica usando solo el ID interno', () => {
    const root = makeTempDir();
    const dir = getExpedienteStorageDir(root, 'ABCDEF12');
    expect(dir).toBe(resolve(root, 'ABCDEF12'));
    expect(dir).not.toContain('B19583632');
  });

  it.each(['../outside', '/tmp/outside', 'ABC/DEF12', 'ABCDEF12/..'])(
    'rechaza un ID que pueda salir de la raíz: %s',
    (id) => {
      const root = makeTempDir();
      expect(() => getExpedienteStorageDir(root, id)).toThrow('invalid_expediente_id');
    },
  );

  it('prefiere la ruta canónica y conserva un fallback legacy validado', () => {
    const root = makeTempDir();
    const legacy = join(root, 'ABCDEF12-B19583632');
    mkdirSync(legacy);
    expect(findExpedienteStorageDir(root, 'ABCDEF12', 'B19583632')).toBe(resolve(legacy));

    const current = join(root, 'ABCDEF12');
    mkdirSync(current);
    expect(findExpedienteStorageDir(root, 'ABCDEF12', 'B19583632')).toBe(resolve(current));
  });

  it('no reconstruye una ruta legacy desde un CIF malicioso', () => {
    const root = makeTempDir();
    const expected = resolve(root, 'ABCDEF12');
    const result = findExpedienteStorageDir(root, 'ABCDEF12', '../../outside');
    expect(result).toBe(expected);
    expect(existsSync(resolve(root, '..', 'outside'))).toBe(false);
  });

  it('mantiene cada adjunto dentro de la carpeta del expediente', () => {
    const root = makeTempDir();
    const dir = getExpedienteStorageDir(root, 'ABCDEF12');
    expect(resolveExpedienteFile(dir, 'docMemoria_memoria.pdf')).toBe(
      resolve(dir, 'docMemoria_memoria.pdf'),
    );
    expect(() => resolveExpedienteFile(dir, '../outside.pdf')).toThrow(
      'expediente_path_outside_root',
    );
    expect(() => resolveExpedienteFile(dir, '/tmp/outside.pdf')).toThrow(
      'expediente_path_outside_root',
    );
  });
});
