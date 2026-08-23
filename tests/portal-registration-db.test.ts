import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const previousDir = process.env.EXPEDIENTES_DIR;
const databaseDir = mkdtempSync(join(tmpdir(), 'startidea-portal-registration-'));
process.env.EXPEDIENTES_DIR = databaseDir;

const {
  createMagicToken,
  createPendingPortalRegistration,
  createPortalUser,
  getPortalUser,
  validateMagicToken,
} = await import('../src/lib/expedientes-db');

afterAll(() => {
  if (previousDir === undefined) delete process.env.EXPEDIENTES_DIR;
  else process.env.EXPEDIENTES_DIR = previousDir;
  rmSync(databaseDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function userData(email: string, nombre: string) {
  return {
    email,
    nombre,
    org_nombre: `Organización de ${nombre}`,
    org_cif: 'G00000000',
    org_tipo: 'asociacion',
    telefono: '600000000',
    provincia: 'Granada',
    como_conocio: 'test',
  };
}

describe('persistencia segura del registro del portal', () => {
  it('no reemplaza un portal_user existente', () => {
    const email = 'existente-db@example.com';
    expect(createPortalUser({ ...userData(email, 'Original'), consent_at: 100 })).toBe(true);
    expect(createPortalUser({ ...userData(email, 'Atacante'), consent_at: 1 })).toBe(false);

    const stored = getPortalUser(email);
    expect(stored).toMatchObject({ nombre: 'Original', consent_at: 100 });
  });

  it('crea el usuario solo al consumir el token pendiente y sella el consentimiento en servidor', () => {
    const email = 'pendiente-db@example.com';
    const before = Math.floor(Date.now() / 1000);
    const token = createPendingPortalRegistration(userData(email, 'Pendiente'));

    expect(getPortalUser(email)).toBeFalsy();
    expect(validateMagicToken(token)).toBe(email);

    const stored = getPortalUser(email);
    const after = Math.floor(Date.now() / 1000);
    expect(stored).toMatchObject({ nombre: 'Pendiente', email });
    expect(stored!.consent_at).toBeGreaterThanOrEqual(before);
    expect(stored!.consent_at).toBeLessThanOrEqual(after);
    expect(validateMagicToken(token)).toBeNull();
  });

  it('mantiene separadas dos solicitudes pendientes y activa solo la que se verifica', () => {
    const email = 'repetida-db@example.com';
    const firstToken = createPendingPortalRegistration(userData(email, 'Primera'));
    const secondToken = createPendingPortalRegistration(userData(email, 'Atacante'));

    expect(secondToken).not.toBe(firstToken);
    expect(validateMagicToken(firstToken)).toBe(email);
    expect(getPortalUser(email)).toMatchObject({ nombre: 'Primera' });
    expect(validateMagicToken(secondToken)).toBeNull();
  });

  it('no activa un registro pendiente después de caducar', () => {
    const email = 'caducada-db@example.com';
    const issuedAt = new Date('2026-08-23T10:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(issuedAt);
    const token = createPendingPortalRegistration(userData(email, 'Caducada'));

    vi.setSystemTime(new Date(issuedAt.getTime() + 3601 * 1000));
    expect(validateMagicToken(token)).toBeNull();
    expect(getPortalUser(email)).toBeFalsy();
  });

  it('puede emitir un acceso sin invalidar otro enlace vigente del mismo usuario', () => {
    const email = 'enlaces-db@example.com';
    expect(createPortalUser({ ...userData(email, 'Enlaces'), consent_at: 200 })).toBe(true);
    const firstToken = createMagicToken(email);
    const secondToken = createMagicToken(email, { invalidateExisting: false });

    expect(validateMagicToken(firstToken)).toBe(email);
    expect(validateMagicToken(secondToken)).toBe(email);
  });
});
