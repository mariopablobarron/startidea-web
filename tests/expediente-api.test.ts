import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '../src/pages/api/expediente';

const previousDir = process.env.EXPEDIENTES_DIR;
const temporaryDirs: string[] = [];

afterEach(() => {
  if (previousDir === undefined) delete process.env.EXPEDIENTES_DIR;
  else process.env.EXPEDIENTES_DIR = previousDir;
  while (temporaryDirs.length) rmSync(temporaryDirs.pop()!, { recursive: true, force: true });
});

function makeInvalidCifRequest(cif: string, ipSuffix: number): Request {
  const form = new FormData();
  form.set('orgName', 'Entidad de prueba');
  form.set('cif', cif);
  form.set('representante', 'Persona de prueba');
  form.set('email', 'prueba@example.com');
  form.set('provincia', 'Granada');
  form.set('descripcionProyecto', 'Descripción suficiente para probar la validación.');
  return new Request('http://localhost/api/expediente', {
    method: 'POST',
    headers: { 'x-forwarded-for': `192.0.2.${ipSuffix}` },
    body: form,
  });
}

describe('POST /api/expediente', () => {
  it.each([
    ['../../fuera', 10],
    ['..\\..\\fuera', 11],
    ['/tmp/fuera', 12],
    ['B19583632/../../fuera', 13],
  ])('rechaza un CIF con traversal antes de tocar el filesystem: %s', async (cif, ipSuffix) => {
    const root = mkdtempSync(join(tmpdir(), 'startidea-expediente-api-'));
    temporaryDirs.push(root);
    const uploads = join(root, 'uploads');
    process.env.EXPEDIENTES_DIR = uploads;

    const response = await POST({
      request: makeInvalidCifRequest(cif, ipSuffix),
      clientAddress: `192.0.2.${ipSuffix}`,
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'cif' });
    expect(existsSync(uploads)).toBe(false);
  });
});
