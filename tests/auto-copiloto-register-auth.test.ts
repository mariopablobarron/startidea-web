import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createProfile: vi.fn(),
  getProfileByEmail: vi.fn(),
  sendEmail: vi.fn(),
  sendTelegram: vi.fn(),
}));

vi.mock('@/lib/auto-copiloto-db', () => ({
  createProfile: mocks.createProfile,
  getProfileByEmail: mocks.getProfileByEmail,
}));
vi.mock('@/lib/email-resend', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('@/lib/telegram', () => ({ sendTelegram: mocks.sendTelegram }));

import { POST } from '../src/pages/api/auto-copiloto/register';

function registrationRequest(email: string, ip: string, origin = 'https://startidea.es'): Request {
  return new Request(`${origin}/api/auto-copiloto/register`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({
      email,
      org_nombre: 'Entidad de prueba',
      org_tipo: 'asociacion',
      org_descripcion: 'Descripción suficientemente extensa para superar la validación mínima.',
      representante: 'Persona de prueba',
    }),
  });
}

describe('POST /api/auto-copiloto/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue(true);
    mocks.sendTelegram.mockResolvedValue(true);
  });

  it('no devuelve el bearer de gestión de un perfil existente y lo envía solo al buzón registrado', async () => {
    const manageToken = 'manage-token-solo-para-el-email-de-prueba';
    mocks.getProfileByEmail.mockReturnValue({
      email: 'propietaria@example.com',
      org_nombre: 'Entidad Propietaria',
      manage_token: manageToken,
    });

    const response = await POST({
      request: registrationRequest(
        'propietaria@example.com',
        '198.51.100.31',
        'https://origen-controlado-por-atacante.example',
      ),
    } as never);
    const responseText = await response.text();

    expect(response.status).toBe(202);
    expect(responseText).not.toContain(manageToken);
    expect(responseText).not.toContain('manage_url');
    expect(JSON.parse(responseText)).toMatchObject({ ok: true });
    expect(mocks.createProfile).not.toHaveBeenCalled();
    expect(mocks.sendEmail).toHaveBeenCalledOnce();

    const email = mocks.sendEmail.mock.calls[0][0];
    expect(email.to).toBe('propietaria@example.com');
    expect(email.html).toContain(`https://startidea.es/subvenciones/mi-copiloto?t=${manageToken}`);
    expect(email.html).not.toContain('origen-controlado-por-atacante.example');
  });

  it('conserva el alta legítima de un perfil nuevo y usa enlaces canónicos', async () => {
    mocks.getProfileByEmail.mockReturnValue(null);
    mocks.createProfile.mockReturnValue({
      id: 'ACP-TEST',
      confirm_token: 'confirm-token-de-prueba',
      manage_token: 'manage-token-de-prueba',
    });

    const response = await POST({
      request: registrationRequest('nueva@example.com', '198.51.100.32'),
    } as never);

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      ok: true,
      detail: 'Revisa ese buzón para confirmar el alta o recuperar el acceso de gestión.',
    });
    expect(mocks.createProfile).toHaveBeenCalledOnce();
    const email = mocks.sendEmail.mock.calls[0][0];
    expect(email.to).toBe('nueva@example.com');
    expect(email.html).toContain('https://startidea.es/api/auto-copiloto/confirm?token=confirm-token-de-prueba');
  });
});
