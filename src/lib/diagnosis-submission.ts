export type DiagnosisFormType = 'diagnostico' | 'presupuesto';
export const DIAGNOSIS_ACCEPTANCE_KEY = 'startidea:accepted-submission:v1';
export const DIAGNOSIS_ACCEPTANCE_TTL_MS = 5 * 60 * 1000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface DiagnosisSubmissionEnvironment {
  getStorage(): StorageLike;
  hasConsent(): boolean;
  now?(): number;
}
type TrackSubmission = (event: 'form_submit', params: { form_type: DiagnosisFormType }) => unknown;

function clearAcceptance(env: DiagnosisSubmissionEnvironment): void {
  try { env.getStorage().removeItem(DIAGNOSIS_ACCEPTANCE_KEY); }
  catch { /* El formulario funciona aunque el almacenamiento esté bloqueado. */ }
}

/** Estado de envío. El recibo del servidor nunca se persiste ni se emite. */
export function createDiagnosisSubmission(formType: DiagnosisFormType, env: DiagnosisSubmissionEnvironment) {
  let inFlight = false;
  let completed = false;

  return {
    begin(): boolean {
      if (inFlight || completed) return false;
      inFlight = true;
      clearAcceptance(env);
      return true;
    },
    complete(responseOk: boolean, body: unknown, honeypot: unknown): boolean {
      if (!inFlight || completed) return false;
      const result = body && typeof body === 'object' ? body as Record<string, unknown> : null;
      if (!responseOk || result?.ok !== true) {
        inFlight = false;
        return false;
      }

      // Mantiene la confirmación silenciosa de bots, sin crear un marcador.
      completed = true;
      inFlight = false;
      const accepted = typeof result.id === 'string' && result.id.trim() !== '' &&
        result.id.trim() !== 'bot_silent' && typeof honeypot === 'string' && honeypot.trim() === '';
      if (accepted) {
        try {
          if (env.hasConsent()) {
            env.getStorage().setItem(DIAGNOSIS_ACCEPTANCE_KEY, JSON.stringify({
              form_type: formType,
              timestamp: (env.now ?? Date.now)(),
            }));
          }
        } catch { /* La solicitud aceptada no depende de esta señal opcional. */ }
      }
      return true;
    },
    fail(): void {
      if (!completed) inFlight = false;
    },
    isCompleted(): boolean { return completed; },
  };
}

/** Elimina primero: una recarga o vuelta atrás no puede reutilizar la señal. */
export function consumeDiagnosisAcceptance(env: DiagnosisSubmissionEnvironment): DiagnosisFormType | null {
  try {
    const storage = env.getStorage();
    const raw = storage.getItem(DIAGNOSIS_ACCEPTANCE_KEY);
    if (raw === null) return null;
    storage.removeItem(DIAGNOSIS_ACCEPTANCE_KEY);
    if (!env.hasConsent()) return null;
    const marker: unknown = JSON.parse(raw);
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return null;
    const value = marker as Record<string, unknown>;
    if (Object.keys(value).length !== 2 ||
        (value.form_type !== 'diagnostico' && value.form_type !== 'presupuesto') ||
        typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return null;
    const age = (env.now ?? Date.now)() - value.timestamp;
    if (!Number.isFinite(age) || age < 0 || age > DIAGNOSIS_ACCEPTANCE_TTL_MS) return null;
    return value.form_type;
  } catch { return null; }
}

/** Se invoca solo en gracias; no usa su URL ni la primera lectura del diagnóstico. */
export function emitDiagnosisAcceptance(env: DiagnosisSubmissionEnvironment, track?: TrackSubmission): boolean {
  const formType = consumeDiagnosisAcceptance(env);
  if (!formType || !track) return false;
  try {
    Promise.resolve(track('form_submit', { form_type: formType })).catch(() => undefined);
    return true;
  } catch { return false; }
}
