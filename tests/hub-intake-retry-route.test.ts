import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ retry: vi.fn() }));
vi.mock('@/lib/hub-intake-outbox', () => ({ retryPendingHubIntake: mocks.retry }));

import { POST } from '../src/pages/api/internal/hub-intake-retry';

function request(secret?: string): Request {
  return new Request('https://startidea.es/api/internal/hub-intake-retry?limit=25', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe('POST /api/internal/hub-intake-retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HUB_INTAKE_SECRET = 'cron-secret-de-prueba-con-32-caracteres';
    mocks.retry.mockResolvedValue({ processed: 2, sent: 1, failed: 1, pending: 3 });
  });

  it('rechaza llamadas sin el bearer compartido', async () => {
    const response = await POST({ request: request() } as never);
    expect(response.status).toBe(401);
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it('rechaza configuración con un secreto menor de 32 caracteres', async () => {
    process.env.HUB_INTAKE_SECRET = 'demasiado-corto';
    const response = await POST({ request: request('demasiado-corto') } as never);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'config' });
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it('reprocesa con límite acotado cuando el bearer es válido', async () => {
    const response = await POST({ request: request('cron-secret-de-prueba-con-32-caracteres') } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, processed: 2, sent: 1, failed: 1, pending: 3 });
    expect(mocks.retry).toHaveBeenCalledWith(25);
  });
});
