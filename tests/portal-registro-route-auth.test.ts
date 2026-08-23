import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPendingPortalRegistration: vi.fn(),
  getPortalUser: vi.fn(),
  createMagicToken: vi.fn(),
  sendEmail: vi.fn(),
  sendTelegram: vi.fn(),
}));

vi.mock('@/lib/expedientes-db', () => ({
  createPendingPortalRegistration: mocks.createPendingPortalRegistration,
  getPortalUser: mocks.getPortalUser,
  createMagicToken: mocks.createMagicToken,
}));
vi.mock('@/lib/email-resend', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('@/lib/telegram', () => ({ sendTelegram: mocks.sendTelegram }));

import { POST } from '../src/pages/api/portal-registro';

function request(email: string, overrides: Record<string, unknown> = {}): Request {
  return new Request('https://startidea.es/api/portal-registro', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      nombre: 'Nombre enviado anónimamente',
      orgNombre: 'Organización enviada anónimamente',
      orgCif: 'G00000000',
      orgTipo: 'asociacion',
      telefono: '600000000',
      provincia: 'Granada',
      comoConocio: 'buscador',
      consentAt: 1,
      ...overrides,
    }),
  });
}

describe('POST /api/portal-registro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPendingPortalRegistration.mockReturnValue('pending-token-de-prueba');
    mocks.createMagicToken.mockReturnValue('magic-token-de-prueba');
    mocks.sendEmail.mockResolvedValue(true);
    mocks.sendTelegram.mockResolvedValue(true);
  });

  it('deja un usuario nuevo pendiente y no confía en el timestamp de consentimiento del cliente', async () => {
    mocks.getPortalUser.mockReturnValue(null);

    const response = await POST({ request: request('nueva@example.com') } as never);

    expect(response.status).toBe(200);
    expect(mocks.createPendingPortalRegistration).toHaveBeenCalledOnce();
    const pendingData = mocks.createPendingPortalRegistration.mock.calls[0][0];
    expect(pendingData).toMatchObject({
      email: 'nueva@example.com',
      nombre: 'Nombre enviado anónimamente',
      org_nombre: 'Organización enviada anónimamente',
    });
    expect(pendingData).not.toHaveProperty('consent_at');
    expect(mocks.createMagicToken).not.toHaveBeenCalled();
    expect(mocks.sendEmail.mock.calls[0][0].html).toContain('verificar el email, crear la cuenta');
  });

  it('no acepta cambios de perfil para un usuario existente ni invalida sus enlaces previos', async () => {
    mocks.getPortalUser.mockReturnValue({
      email: 'propietaria@example.com',
      nombre: 'Nombre Verificado',
      org_nombre: 'Organización Verificada',
    });

    const response = await POST({
      request: request('propietaria@example.com', {
        nombre: 'Nombre Atacante',
        orgNombre: 'Organización Atacante',
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(mocks.createPendingPortalRegistration).not.toHaveBeenCalled();
    expect(mocks.createMagicToken).toHaveBeenCalledWith(
      'propietaria@example.com',
      { invalidateExisting: false },
    );
    const email = mocks.sendEmail.mock.calls[0][0];
    expect(email.html).toContain('Hola de nuevo, Nombre');
    expect(email.html).toContain('Tu perfil no se ha modificado');
    expect(email.html).not.toContain('Nombre Atacante');
    expect(email.html).not.toContain('Organización Atacante');
  });
});
