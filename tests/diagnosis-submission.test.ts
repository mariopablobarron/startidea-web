import { describe, expect, it, vi } from 'vitest';
import {
  createDiagnosisSubmission,
  consumeDiagnosisAcceptance,
  emitDiagnosisAcceptance,
  DIAGNOSIS_ACCEPTANCE_KEY,
  DIAGNOSIS_ACCEPTANCE_TTL_MS,
  type DiagnosisSubmissionEnvironment,
} from '../src/lib/diagnosis-submission';

function fixture() {
  const values = new Map<string, string>();
  const state = { consent: true, now: 1_800_000_000_000 };
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
  const env: DiagnosisSubmissionEnvironment = {
    getStorage: () => storage,
    hasConsent: () => state.consent,
    now: () => state.now,
  };
  return { values, state, storage, env };
}

function accept(env: DiagnosisSubmissionEnvironment) {
  const submission = createDiagnosisSubmission('diagnostico', env);
  submission.begin();
  expect(submission.complete(true, { ok: true, id: 'receipt-local-only' }, '')).toBe(true);
  return submission;
}

describe('aceptación diferida de diagnóstico y presupuesto', () => {
  it.each(['diagnostico', 'presupuesto'] as const)('guarda solo tipo y momento para %s; emite al consumir', (kind) => {
    const { values, storage, state, env } = fixture();
    const track = vi.fn(() => {
      expect(values.has(DIAGNOSIS_ACCEPTANCE_KEY)).toBe(false);
    });
    const submission = createDiagnosisSubmission(kind, env);
    expect(submission.begin()).toBe(true);
    expect(submission.complete(true, {
      ok: true, id: 'receipt-local-only', email: 'not-for-analytics@example.test',
    }, '')).toBe(true);
    expect(storage.setItem.mock.calls).toEqual([[DIAGNOSIS_ACCEPTANCE_KEY, JSON.stringify({
      form_type: kind, timestamp: state.now,
    })]]);
    expect(track).not.toHaveBeenCalled();
    expect(submission.isCompleted()).toBe(true);

    expect(emitDiagnosisAcceptance(env, track)).toBe(true);
    expect(track.mock.calls).toEqual([['form_submit', { form_type: kind }]]);
    expect(emitDiagnosisAcceptance(env, track)).toBe(false);
    expect(consumeDiagnosisAcceptance(env)).toBeNull();
    expect(track).toHaveBeenCalledTimes(1);
  });

  it.each([
    [false, { ok: true, id: 'receipt' }],
    [true, { ok: false, error: 'validation' }],
    [true, null],
    [true, { ok: 'true', id: 'receipt' }],
  ])('no prepara señal en errores y permite reintento (%s, %j)', (responseOk, body) => {
    const { env, values } = fixture();
    const submission = createDiagnosisSubmission('diagnostico', env);
    submission.begin();
    expect(submission.complete(responseOk as boolean, body, '')).toBe(false);
    expect(values.size).toBe(0);
    expect(submission.begin()).toBe(true);
    expect(submission.complete(true, { ok: true, id: 'receipt' }, '')).toBe(true);
    expect(consumeDiagnosisAcceptance(env)).toBe('diagnostico');
  });

  it.each([
    [{ ok: true, id: 'bot_silent' }, ''],
    [{ ok: true, id: ' bot_silent ' }, ''],
    [{ ok: true, id: 'receipt' }, 'bot'],
    [{ ok: true }, ''],
    [{ ok: true, id: '' }, ''],
    [{ ok: true, id: '   ' }, ''],
    [{ ok: true, id: 123 }, ''],
    [{ ok: true, id: 'receipt' }, null],
  ])('conserva confirmación silenciosa sin marcador si falta aceptación (%j)', (body, honeypot) => {
    const { env, values } = fixture();
    const submission = createDiagnosisSubmission('presupuesto', env);
    submission.begin();
    expect(submission.complete(true, body, honeypot)).toBe(true);
    expect(values.size).toBe(0);
    expect(submission.begin()).toBe(false);
  });

  it('bloquea doble clic durante la petición y tras completarla', async () => {
    const { env, storage } = fixture();
    const submission = createDiagnosisSubmission('diagnostico', env);
    let resolve!: (body: unknown) => void;
    const pending = new Promise((done) => { resolve = done; });
    const request = vi.fn(() => pending);
    const redirect = vi.fn();
    const send = async () => {
      if (!submission.begin()) return;
      if (submission.complete(true, await request(), '')) redirect('/diagnostico/gracias');
    };
    const first = send();
    await send();
    expect(request).toHaveBeenCalledTimes(1);
    resolve({ ok: true, id: 'receipt' });
    await first;
    await send();
    expect(request).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(submission.complete(true, { ok: true, id: 'receipt' }, '')).toBe(false);
  });

  it('libera el bloqueo por fallo de red y elimina marcas de un envío anterior', () => {
    const { env, values } = fixture();
    accept(env);
    const submission = createDiagnosisSubmission('presupuesto', env);
    expect(submission.begin()).toBe(true);
    expect(values.has(DIAGNOSIS_ACCEPTANCE_KEY)).toBe(false);
    submission.fail();
    expect(consumeDiagnosisAcceptance(env)).toBeNull();
    expect(submission.begin()).toBe(true);
  });

  it('no permite completar sin iniciar ni reabrir un envío completado tras fail', () => {
    const { env, values } = fixture();
    const submission = createDiagnosisSubmission('diagnostico', env);
    expect(submission.complete(true, { ok: true, id: 'receipt' }, '')).toBe(false);
    expect(values.size).toBe(0);
    submission.begin();
    submission.complete(true, { ok: true, id: 'receipt' }, '');
    submission.fail();
    expect(submission.isCompleted()).toBe(true);
    expect(submission.begin()).toBe(false);
  });

  it('sin consentimiento vigente al aceptar no crea marcador aunque se acepte después', () => {
    const { env, state, values } = fixture();
    const submission = createDiagnosisSubmission('diagnostico', env);
    submission.begin();
    state.consent = false;
    expect(submission.complete(true, { ok: true, id: 'receipt' }, '')).toBe(true);
    expect(values.size).toBe(0);
    state.consent = true;
    const track = vi.fn();
    expect(emitDiagnosisAcceptance(env, track)).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('retirar consentimiento entre formulario y gracias elimina la señal y no la recupera', () => {
    const { env, state, values } = fixture();
    accept(env);
    state.consent = false;
    const track = vi.fn();
    expect(emitDiagnosisAcceptance(env, track)).toBe(false);
    expect(values.size).toBe(0);
    state.consent = true;
    expect(emitDiagnosisAcceptance(env, track)).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('visitar gracias con datos de personalización antiguos no acredita una solicitud', () => {
    const { env, values } = fixture();
    values.set('st_diag_result', JSON.stringify({ kind: 'presupuesto', id: 'old-receipt' }));
    const track = vi.fn();
    expect(emitDiagnosisAcceptance(env, track)).toBe(false);
    expect(track).not.toHaveBeenCalled();
    expect(values.has('st_diag_result')).toBe(true);
  });

  it('admite hasta cinco minutos y consume una sola vez', () => {
    const { env, state } = fixture();
    accept(env);
    state.now += DIAGNOSIS_ACCEPTANCE_TTL_MS;
    expect(consumeDiagnosisAcceptance(env)).toBe('diagnostico');
    expect(consumeDiagnosisAcceptance(env)).toBeNull();
  });

  it.each([DIAGNOSIS_ACCEPTANCE_TTL_MS + 1, -1, Number.NaN])('descarta y elimina una edad inválida: %s', (elapsed) => {
    const { env, state, values } = fixture();
    accept(env);
    state.now += elapsed;
    expect(consumeDiagnosisAcceptance(env)).toBeNull();
    expect(values.size).toBe(0);
  });

  it.each([
    'not-json', 'null', '[]', '{}',
    JSON.stringify({ form_type: 'newsletter', timestamp: 1_800_000_000_000 }),
    JSON.stringify({ form_type: 'diagnostico', timestamp: '1800000000000' }),
    JSON.stringify({ form_type: 'diagnostico', timestamp: null }),
    JSON.stringify({ form_type: 'diagnostico', timestamp: 1_800_000_000_000, id: 'receipt' }),
  ])('elimina marcadores malformados o con campos adicionales: %s', (raw) => {
    const { env, values } = fixture();
    values.set(DIAGNOSIS_ACCEPTANCE_KEY, raw);
    const track = vi.fn();
    expect(emitDiagnosisAcceptance(env, track)).toBe(false);
    expect(values.size).toBe(0);
    expect(track).not.toHaveBeenCalled();
  });

  it.each(['getter', 'write', 'consent'] as const)('un fallo de %s no bloquea la solicitud aceptada', (failure) => {
    const { env, storage, values } = fixture();
    const unavailable = () => { throw new Error('unavailable'); };
    if (failure === 'getter') env.getStorage = unavailable;
    if (failure === 'write') storage.setItem.mockImplementation(unavailable);
    if (failure === 'consent') env.hasConsent = unavailable;
    const submission = accept(env);
    expect(submission.isCompleted()).toBe(true);
    expect(submission.begin()).toBe(false);
    expect(values.size).toBe(0);
  });

  it.each(['read', 'remove'] as const)('si no se puede %s el marcador no se emite', (failure) => {
    const { env, storage } = fixture();
    accept(env);
    const unavailable = () => { throw new Error('storage unavailable'); };
    if (failure === 'read') storage.getItem.mockImplementation(unavailable);
    else storage.removeItem.mockImplementation(unavailable);
    const track = vi.fn();
    expect(emitDiagnosisAcceptance(env, track)).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('no conserva la señal si falla la lectura de consentimiento al consumir', () => {
    const { env, values } = fixture();
    accept(env);
    env.hasConsent = () => { throw new Error('unavailable'); };
    expect(consumeDiagnosisAcceptance(env)).toBeNull();
    expect(values.size).toBe(0);
  });

  it.each(['missing', 'throw', 'reject', 'pending'] as const)('el transporte %s no bloquea gracias ni restaura la señal', async (failure) => {
    const { env, values } = fixture();
    accept(env);
    const track = failure === 'missing' ? undefined : vi.fn(() => {
      expect(values.has(DIAGNOSIS_ACCEPTANCE_KEY)).toBe(false);
      if (failure === 'throw') throw new Error('blocked');
      if (failure === 'reject') return Promise.reject(new Error('blocked'));
      return new Promise(() => {});
    });
    expect(emitDiagnosisAcceptance(env, track)).toBe(failure === 'reject' || failure === 'pending');
    await Promise.resolve();
    expect(values.size).toBe(0);
    expect(emitDiagnosisAcceptance(env, vi.fn())).toBe(false);
  });
});
