import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const previousDir = process.env.EXPEDIENTES_DIR;
const previousUrl = process.env.HUB_INTAKE_URL;
const previousSecret = process.env.HUB_INTAKE_SECRET;
const databaseDir = mkdtempSync(join(tmpdir(), 'startidea-hub-intake-'));
process.env.EXPEDIENTES_DIR = databaseDir;
process.env.HUB_INTAKE_URL = 'https://hub.example.test/';
process.env.HUB_INTAKE_SECRET = 'test-secret';

const {
  attemptHubIntakeDelivery,
  closeHubIntakeOutbox,
  enqueueHubIntake,
  getHubIntakeOutboxRow,
  HUB_INTAKE_MAX_BYTES,
  normalizeHubIntakePayload,
  replicateHubIntake,
  retryPendingHubIntake,
} = await import('../src/lib/hub-intake-outbox');

const payload = {
  schemaVersion: 1 as const,
  submissionId: 'LOCAL-123',
  kind: 'contact' as const,
  form: 'contacto',
  occurredAt: '2026-08-30T10:00:00.000Z',
  contact: { email: 'persona@example.com', name: 'Persona' },
  subject: 'Consulta',
  message: 'Necesito información',
  details: { path: '/contacto' },
  consents: { privacy: true },
};

beforeEach(() => {
  process.env.HUB_INTAKE_SECRET = 'test-secret';
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

afterAll(() => {
  closeHubIntakeOutbox();
  if (previousDir === undefined) delete process.env.EXPEDIENTES_DIR;
  else process.env.EXPEDIENTES_DIR = previousDir;
  if (previousUrl === undefined) delete process.env.HUB_INTAKE_URL;
  else process.env.HUB_INTAKE_URL = previousUrl;
  if (previousSecret === undefined) delete process.env.HUB_INTAKE_SECRET;
  else process.env.HUB_INTAKE_SECRET = previousSecret;
  rmSync(databaseDir, { recursive: true, force: true });
});

describe('outbox durable del intake del HUB', () => {
  it('normaliza campos variables al contrato estricto del HUB', () => {
    const normalized = normalizeHubIntakePayload({
      ...payload,
      submissionId: 'NORMALIZE-1',
      subject: 'S'.repeat(250),
      message: 'M'.repeat(5_100),
      contact: {
        email: '  PERSONA@EXAMPLE.COM  ',
        name: 'N'.repeat(250),
        phone: '1'.repeat(60),
      },
      organization: { website: 'startidea.es/contacto' },
      details: {
        list: Array.from({ length: 25 }, (_, index) => `${index}-${'x'.repeat(220)}`),
        long: 'y'.repeat(2_100),
      },
    });

    expect(normalized.contact.email).toBe('persona@example.com');
    expect(normalized.contact.name).toHaveLength(200);
    expect(normalized.contact.phone).toHaveLength(50);
    expect(normalized.organization?.website).toBe('https://startidea.es/contacto');
    expect(normalized.subject).toHaveLength(200);
    expect(normalized.message).toHaveLength(5_000);
    expect(normalized.details?.long).toHaveLength(2_000);
    expect(normalized.details?.list).toHaveLength(20);
    expect((normalized.details?.list as string[])[0]).toHaveLength(200);
  });

  it('rechaza identidad y fecha fuera del contrato antes de insertar', () => {
    const invalidPayloads = [
      [{ ...payload, submissionId: 'corto' }, /submissionId/],
      [{ ...payload, submissionId: 'ID no permitido' }, /submissionId/],
      [{ ...payload, submissionId: 'VALIDATE-1', kind: 'unknown' }, /kind/],
      [{ ...payload, submissionId: 'VALIDATE-1', form: '' }, /form/],
      [{ ...payload, submissionId: 'VALIDATE-1', form: 'Contacto' }, /form/],
      [{ ...payload, submissionId: 'VALIDATE-1', contact: { email: 'correo-invalido' } }, /email/],
      [{ ...payload, submissionId: 'VALIDATE-1', contact: { email: `${'a'.repeat(190)}@example.com` } }, /email/],
      [{ ...payload, submissionId: 'VALIDATE-1', occurredAt: '2026-02-30T10:00:00Z' }, /occurredAt/],
      [{ ...payload, submissionId: 'VALIDATE-1', occurredAt: '2026-08-30T10:00:00' }, /occurredAt/],
    ] as const;

    for (const [invalid, expectedError] of invalidPayloads) {
      expect(() => enqueueHubIntake(invalid as typeof payload)).toThrow(expectedError);
    }

    // Si cualquiera de los rechazos con VALIDATE-1 hubiese llegado al INSERT,
    // esta alta válida chocaría con la restricción UNIQUE de submission_id.
    const id = enqueueHubIntake({ ...payload, submissionId: 'VALIDATE-1' });
    expect(getHubIntakeOutboxRow(id)?.submissionId).toBe('VALIDATE-1');
  });

  it('garantiza 32 KiB UTF-8 en un payload agregado sin descartar contacto ni asunto', () => {
    const largePayload = {
      ...payload,
      submissionId: 'AGGREGATE-1',
      contact: { email: 'persona@example.com', name: 'Contacto imprescindible' },
      subject: 'Asunto imprescindible',
      message: '🔥'.repeat(5_000),
      details: Object.fromEntries(
        Array.from({ length: 40 }, (_, index) => [`campo-${index}`, '🧩'.repeat(2_000)]),
      ),
    };

    const id = enqueueHubIntake(largePayload);
    const stored = getHubIntakeOutboxRow(id)!;
    expect(Buffer.byteLength(JSON.stringify(stored.payload), 'utf8')).toBeLessThanOrEqual(HUB_INTAKE_MAX_BYTES);
    expect(stored.payload.contact).toEqual(largePayload.contact);
    expect(stored.payload.subject).toBe(largePayload.subject);
    expect(Object.keys(stored.payload.details ?? {}).length).toBeLessThan(40);
  });

  it('propaga el fallo de persistencia antes de intentar la entrega', async () => {
    const blockedDir = join(databaseDir, 'no-es-directorio');
    writeFileSync(blockedDir, 'bloqueo intencional de test');
    closeHubIntakeOutbox();
    process.env.EXPEDIENTES_DIR = blockedDir;

    try {
      await expect(replicateHubIntake({ ...payload, submissionId: 'PERSIST-FAIL-1' })).rejects.toThrow();
    } finally {
      closeHubIntakeOutbox();
      process.env.EXPEDIENTES_DIR = databaseDir;
    }
  });

  it('persiste antes de enviar y conserva pendiente un fallo con backoff', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('HUB no disponible')));
    const id = enqueueHubIntake({ ...payload, submissionId: 'FAILURE-1' });

    expect(getHubIntakeOutboxRow(id)).toMatchObject({
      submissionId: 'FAILURE-1',
      status: 'pending',
      attempts: 0,
      lastError: null,
    });
    await expect(attemptHubIntakeDelivery(id)).resolves.toBe(false);

    const stored = getHubIntakeOutboxRow(id)!;
    expect(stored.status).toBe('pending');
    expect(stored.attempts).toBe(1);
    expect(stored.nextAttemptAt).toBeGreaterThan(stored.createdAt);
    expect(stored.lastError).toBe('HUB no disponible');
    expect(stored.payload).toEqual({ ...payload, submissionId: 'FAILURE-1' });
  });

  it('absorbe un fallo de entrega una vez persistida la fila', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('caída de red')));
    await expect(replicateHubIntake({ ...payload, submissionId: 'DELIVERY-FAIL-1' })).resolves.toBeUndefined();
  });

  it('envía al contrato exacto y marca el evento como entregado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const event = { ...payload, submissionId: 'SUCCESS-1' };
    const id = enqueueHubIntake(event);

    await expect(attemptHubIntakeDelivery(id)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hub.example.test/api/public/intake/startidea-web');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'content-type': 'application/json',
      Authorization: 'Bearer test-secret',
    });
    expect(JSON.parse(String(init.body))).toEqual(event);
    expect(getHubIntakeOutboxRow(id)).toMatchObject({ status: 'sent', attempts: 0, lastError: null });
  });

  it('reprocesa un pendiente vencido sin crear otra fila', async () => {
    vi.useFakeTimers();
    // Fecha anterior a las filas de otros tests para que solo venza esta fila.
    vi.setSystemTime(new Date('2020-08-30T10:00:00.000Z'));
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('temporal'));
    vi.stubGlobal('fetch', fetchMock);
    const id = enqueueHubIntake({ ...payload, submissionId: 'RETRY-01' });
    expect(await attemptHubIntakeDelivery(id)).toBe(false);

    vi.setSystemTime(new Date('2020-08-30T10:01:01.000Z'));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(retryPendingHubIntake()).resolves.toMatchObject({ processed: 1, sent: 1, failed: 0 });
    expect(getHubIntakeOutboxRow(id)).toMatchObject({ status: 'sent', attempts: 1 });
  });
});
