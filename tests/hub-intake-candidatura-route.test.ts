import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveCandidatura: vi.fn(),
  countCandidaturas: vi.fn(),
  sendTelegram: vi.fn(),
  sendOwnerLeadEmail: vi.fn(),
  sendEmail: vi.fn(),
  replicateHubIntake: vi.fn(),
}));

vi.mock('@/lib/candidaturas-db', () => ({
  saveCandidatura: mocks.saveCandidatura,
  countCandidaturas: mocks.countCandidaturas,
  getCandidaturasDir: () => '/tmp/startidea-candidaturas-test',
  TIPOS_CANDIDATURA: ['empleo', 'freelance', 'colaboracion'],
  AREAS_CANDIDATURA: ['Comunicación', 'Otro'],
}));
vi.mock('@/lib/telegram', () => ({ sendTelegram: mocks.sendTelegram }));
vi.mock('@/lib/email-resend', () => ({
  sendOwnerLeadEmail: mocks.sendOwnerLeadEmail,
  sendEmail: mocks.sendEmail,
}));
vi.mock('@/lib/attribution', () => ({ formatAttribution: () => '' }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({ ok: true, retryAfter: 0 }),
  getClientIp: () => '198.51.100.77',
}));
vi.mock('@/lib/hub-intake-outbox', () => ({ replicateHubIntake: mocks.replicateHubIntake }));

import { POST } from '../src/pages/api/candidatura';

describe('réplica HUB de candidatura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.countCandidaturas.mockReturnValue(1);
    mocks.sendTelegram.mockResolvedValue(true);
    mocks.sendOwnerLeadEmail.mockResolvedValue(true);
    mocks.sendEmail.mockResolvedValue(true);
    mocks.replicateHubIntake.mockResolvedValue(undefined);
  });

  it('usa el ID local y no replica IP, textos libres, enlaces ni adjuntos', async () => {
    const form = new FormData();
    form.set('consent', 'on');
    form.set('tipo', 'empleo');
    form.set('area', 'Comunicación');
    form.set('nombre', 'Persona Candidata');
    form.set('email', 'candidata@example.com');
    form.set('telefono', '600000000');
    form.set('ubicacion', 'Granada');
    form.set('linkedin', 'https://linkedin.example/persona');
    form.set('web', 'https://portfolio.example');
    form.set('mensaje', 'Texto privado de candidatura');

    const response = await POST({
      request: new Request('https://startidea.es/api/candidatura', { method: 'POST', body: form }),
      clientAddress: '198.51.100.77',
    } as never);

    expect(response.status).toBe(200);
    const primary = await response.json();
    expect(primary).toMatchObject({ ok: true });
    expect(mocks.saveCandidatura).toHaveBeenCalledOnce();
    expect(mocks.replicateHubIntake).toHaveBeenCalledOnce();
    expect(mocks.saveCandidatura.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.replicateHubIntake.mock.invocationCallOrder[0],
    );
    expect(mocks.replicateHubIntake.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendTelegram.mock.invocationCallOrder[0],
    );

    const replicated = mocks.replicateHubIntake.mock.calls[0][0];
    expect(replicated).toMatchObject({
      schemaVersion: 1,
      submissionId: primary.id,
      kind: 'application',
      form: 'candidatura',
      contact: { email: 'candidata@example.com', name: 'Persona Candidata', phone: '600000000' },
      details: { type: 'empleo', area: 'Comunicación', location: 'Granada' },
      consents: { privacy: true },
    });
    const serialized = JSON.stringify(replicated);
    expect(serialized).not.toContain('198.51.100.77');
    expect(serialized).not.toContain('linkedin.example');
    expect(serialized).not.toContain('portfolio.example');
    expect(serialized).not.toContain('Texto privado de candidatura');
    expect(serialized).not.toContain('adjunt');
  });

  it('no llama a proveedores cuando falla la persistencia de la outbox', async () => {
    mocks.replicateHubIntake.mockRejectedValueOnce(new Error('disco lleno'));
    const form = new FormData();
    form.set('consent', 'on');
    form.set('tipo', 'empleo');
    form.set('area', 'Comunicación');
    form.set('nombre', 'Persona Candidata');
    form.set('email', 'persistencia@example.com');

    const response = await POST({
      request: new Request('https://startidea.es/api/candidatura', { method: 'POST', body: form }),
      clientAddress: '198.51.100.78',
    } as never);

    expect(response.status).toBe(500);
    expect(mocks.saveCandidatura).toHaveBeenCalledOnce();
    expect(mocks.sendTelegram).not.toHaveBeenCalled();
    expect(mocks.sendOwnerLeadEmail).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
