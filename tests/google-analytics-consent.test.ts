import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDiagnosisSubmission, emitDiagnosisAcceptance,
  DIAGNOSIS_ACCEPTANCE_KEY, DIAGNOSIS_ACCEPTANCE_TTL_MS,
} from '../src/lib/diagnosis-submission';

const consentKey = 'startidea.cookieconsent.v2';
type Consent = 'all' | 'essential' | null;
type Options = {
  consent?: Consent; path?: string; referrer?: string; noindex?: boolean;
  storedAttribution?: Record<string, unknown>; storageFails?: boolean;
  scriptInsertionFails?: boolean; legacyGtm?: string;
  session?: Map<string, string>;
};

// Execute the three actual inline scripts in their layout order. No Google SDK
// or network is loaded: a queued event does not prove Google receipt.
function browser(options: Options = {}) {
  const stored = new Map<string, string>();
  if (options.consent) stored.set(consentKey, options.consent);
  if (options.storedAttribution) stored.set('st_attribution', JSON.stringify(options.storedAttribution));
  const location = new URL(options.path ?? '/notas/enisa-o-cdti-cual-pedir', 'https://startidea.es');
  const listeners: Record<string, ((event: any) => void)[]> = {};
  const scripts: any[] = [];
  const session = options.session ?? new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => { session.set(key, value); },
    removeItem: (key: string) => { session.delete(key); },
  };
  const cookies = new Map([['_ga', 'old'], ['_gid', 'old'], ['functional_session', 'keep']]);
  const window: any = { location, dataLayer: [] };
  const localStorage = {
    getItem: vi.fn((key: string) => {
      if (options.storageFails) throw new Error('storage unavailable');
      return stored.get(key) ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (options.storageFails) throw new Error('storage unavailable');
      stored.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      if (options.storageFails) throw new Error('storage unavailable');
      stored.delete(key);
    }),
  };
  const document = {
    title: 'Página de Startidea',
    referrer: options.referrer ?? '',
    get cookie() { return [...cookies].map(([key, value]) => `${key}=${value}`).join('; '); },
    set cookie(value: string) {
      if (/max-age=0/.test(value)) cookies.delete(value.split('=')[0]);
    },
    createElement: () => ({}),
    head: { appendChild: vi.fn((script: unknown) => {
      if (options.scriptInsertionFails) throw new Error('script blocked');
      scripts.push(script);
    }) },
    addEventListener(name: string, fn: (event: any) => void) { (listeners[name] ??= []).push(fn); },
  };
  const context = vm.createContext({
    window, document, location, localStorage, sessionStorage, URL, URLSearchParams,
    setTimeout, clearTimeout, Date, Promise,
    noindex: options.noindex ?? false, ga4Id: 'G-TEST', gtmId: options.legacyGtm ?? '',
  });
  for (const name of ['AnalyticsPrivacy', 'GoogleTagManager', 'AnalyticsTracker']) {
    const component = readFileSync(new URL(`../src/components/${name}.astro`, import.meta.url), 'utf8');
    const script = component.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
    vm.runInContext(script, context);
  }
  function emit(consent: Exclude<Consent, null>) {
    stored.set(consentKey, consent);
    listeners[`cookieconsent:${consent}`]?.forEach(fn => fn({ type: `cookieconsent:${consent}` }));
  }
  const commands = () => window.dataLayer.filter((item: any) => typeof item?.length === 'number').map((item: any) => Array.from(item) as any[]);
  const events = (name?: string) => commands().filter((item: any[]) => item[0] === 'event' && (!name || item[1] === name));
  const acceptanceEnv = {
    getStorage: () => sessionStorage,
    hasConsent: () => window.stPrivacy.hasConsent(),
    now: () => Date.now(),
  };
  return { window, document, stored, localStorage, scripts, cookies, session, acceptanceEnv, emit, commands, events };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-08T15:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('Privacy + Google + Tracker: consentimiento y contexto público', () => {
  it.each([null, 'essential'] as const)('con consentimiento %s no carga, no emite ni conserva atribución', (consent) => {
    const page = browser({ consent, path: '/comunicacion?utm_source=campaign', storedAttribution: { landing_page: '/portal/private' } });
    expect(page.scripts).toEqual([]);
    expect(page.window.stTrack('cta_click', { cta_id: 'servicio' })).toBe(false);
    expect(page.window.gtag('event', 'generate_lead', {})).toBe(false);
    expect(page.commands()).toEqual([]);
    expect(page.window.stAttribution()).toEqual({});
    expect(page.stored.has('st_attribution')).toBe(false);
    expect(page.localStorage.setItem).not.toHaveBeenCalled();
  });

  it.each([null, 'essential', 'all'] as const)('la aceptación carga una vez desde %s y emite una sola visita y contexto', (consent) => {
    const page = browser({ consent, path: '/comunicacion' });
    page.emit('all');
    page.emit('all');
    expect(page.scripts).toHaveLength(1);
    expect(page.scripts[0]).toMatchObject({ src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST', referrerPolicy: 'no-referrer' });
    expect(page.events('page_view')).toHaveLength(1);
    expect(page.events('view_service')).toHaveLength(1);
    expect(page.commands().find(item => item[0] === 'config')?.[2]).toMatchObject({ send_page_view: false });
    expect(page.window['ga-disable-G-TEST']).toBe(false);
  });

  it('revocar bloquea el transporte y la compatibilidad gtag y elimina solo cookies analíticas', () => {
    const page = browser({ consent: 'all', path: '/comunicacion' });
    const before = page.events().length;
    page.emit('essential');
    expect(page.window.stTrack('cta_click', {})).toBe(false);
    expect(page.window.stSendAnalyticsEvent('page_view', {})).toBe(false);
    expect(page.window.gtag('event', 'purchase', {})).toBe(false);
    expect(page.events()).toHaveLength(before);
    expect(page.window['ga-disable-G-TEST']).toBe(true);
    expect(page.cookies.has('_ga')).toBe(false);
    expect(page.cookies.has('_gid')).toBe(false);
    expect(page.cookies.get('functional_session')).toBe('keep');
    expect(page.stored.has('st_attribution')).toBe(false);
    expect(page.window.stAttribution()).toEqual({});
  });

  it('sanea pageview, configuración, eventos y atribución sin filtrar query, hash ni referente privado', () => {
    const page = browser({
      consent: 'all', path: '/contacto?email=PRIVATE_EMAIL#PRIVATE_HASH',
      referrer: 'https://startidea.es/portal/PRIVATE_TOKEN?email=PRIVATE_EMAIL',
      storedAttribution: { landing_page: '/portal/PRIVATE_TOKEN', referrer: 'https://otro.example/PRIVATE_PATH?email=PRIVATE_EMAIL', utm_source: 'newsletter', utm_campaign: 'person@example.org' },
    });
    page.window.stTrack('cta_click', {
      cta_id: 'contacto', page_location: 'PRIVATE_URL', page_referrer: 'PRIVATE_REFERRER',
      cta_text: 'PRIVATE_TEXT', link_url: 'PRIVATE_LINK', file_name: 'PRIVATE_FILE',
    });
    for (const command of page.commands().filter(item => ['event', 'config'].includes(item[0]))) {
      expect(command[2]).toMatchObject({ page_location: 'https://startidea.es/contacto', page_referrer: 'https://startidea.es/' });
    }
    expect(JSON.stringify(page.commands())).not.toContain('PRIVATE_');
    expect(page.window.stAttribution()).toEqual({ utm_source: 'newsletter', utm_medium: '', utm_campaign: '', landing_page: '/', referrer: 'https://otro.example/' });
    expect(JSON.stringify(page.window.stAttribution())).not.toMatch(/[?#]|person@example/);
  });

  it('si el almacenamiento falla, mantiene la navegación y la política sin consentimiento', () => {
    const page = browser({ consent: 'all', storageFails: true });
    expect(page.scripts).toEqual([]);
    expect(page.window.stTrack('cta_click', {})).toBe(false);
    expect(page.window.stAttribution()).toEqual({});
  });

  it('un transporte síncrono roto devuelve false sin interrumpir al cliente', () => {
    const page = browser({ consent: 'all' });
    page.window.stSendAnalyticsEvent = () => { throw new Error('client unavailable'); };
    expect(() => page.window.stTrack('cta_click', {})).not.toThrow();
    expect(page.window.stTrack('cta_click', {})).toBe(false);
  });

  it('un bloqueo al insertar el SDK no rompe la inicialización ni la navegación', () => {
    const page = browser({ consent: 'all', scriptInsertionFails: true });
    expect(page.scripts).toEqual([]);
    expect(page.events()).toEqual([]);
    expect(page.window.stTrack('cta_click', {})).toBe(false);
  });
});

// This is the confirmation-page handoff: consume and remove the marker before
// dispatch. The same helper is used by the real confirmation page.
function consumeAndTrack(page: ReturnType<typeof browser>) {
  let queued = false;
  emitDiagnosisAcceptance(page.acceptanceEnv, (event, fields) => {
    expect(page.session.has(DIAGNOSIS_ACCEPTANCE_KEY)).toBe(false);
    queued = page.window.stTrack(event, fields);
    return queued;
  });
  return queued;
}

function acceptedMarker(form_type: 'diagnostico' | 'presupuesto' = 'diagnostico', timestamp = Date.now()) {
  return new Map([[DIAGNOSIS_ACCEPTANCE_KEY, JSON.stringify({ form_type, timestamp })]]);
}

describe('utilidades y señal diferida de solicitud aceptada', () => {
  it.each([
    '/portal/link/PRIVATE_TOKEN', '/admin', '/api/private', '/contrato/PRIVATE_TOKEN',
    '/memorias/pedido?t=PRIVATE_TOKEN', '/subvenciones/mi-copiloto?t=PRIVATE_TOKEN',
    '/subvenciones/presentar/nuevo?token=PRIVATE_TOKEN', '/presupuesto/nuevo?email=PRIVATE_EMAIL',
    '/gracias', '/diagnostico/gracias?id=PRIVATE_TOKEN', '/laboratorio/cursos/gracias?session_id=PRIVATE_TOKEN',
  ])('%s no carga scripts ni genera visitas o señales genéricas aun con all', (path) => {
    const page = browser({ consent: 'all', path });
    page.emit('all');
    expect(page.window.stTrack('form_start', {})).toBe(false);
    expect(page.window.gtag('event', 'page_view', {})).toBe(false);
    expect(page.scripts).toEqual([]);
    expect(page.events()).toEqual([]);
    expect(page.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('noindex también excluye páginas sin un prefijo de utilidad conocido', () => {
    const page = browser({ consent: 'all', path: '/comunicacion', noindex: true });
    expect(page.scripts).toEqual([]);
    expect(page.events()).toEqual([]);
    expect(page.window.stTrack('cta_click', {})).toBe(false);
  });

  it.each(['/diagnostico', '/presupuesto/nuevo', '/gracias', '/laboratorio/cursos/gracias'])('%s no es un punto de emisión de form_submit', (path) => {
    const page = browser({ consent: 'all', path });
    for (const form_type of ['diagnostico', 'presupuesto']) {
      expect(page.window.stTrack('form_submit', { form_type })).toBe(false);
    }
    expect(page.events('form_submit')).toEqual([]);
  });

  it('una visita directa a gracias, aunque lleve kind o id, no crea una solicitud', () => {
    const page = browser({ consent: 'all', path: '/diagnostico/gracias?kind=presupuesto&id=PRIVATE_ID' });
    expect(consumeAndTrack(page)).toBe(false);
    expect(page.scripts).toEqual([]);
    expect(page.events()).toEqual([]);
  });

  it.each(['diagnostico', 'presupuesto'] as const)('aceptar %s guarda solo una marca mínima y la confirmación emite una vez sin pageview', (formType) => {
    const session = new Map<string, string>();
    const source = browser({ consent: 'all', path: formType === 'diagnostico' ? '/diagnostico' : '/presupuesto/nuevo', session });
    const submission = createDiagnosisSubmission(formType, source.acceptanceEnv);
    expect(submission.begin()).toBe(true);
    expect(submission.complete(true, { ok: true, id: 'PRIVATE_ID', email: 'person@example.org' }, '')).toBe(true);
    expect(source.events('form_submit')).toEqual([]);
    expect(JSON.parse(session.get(DIAGNOSIS_ACCEPTANCE_KEY)!)).toEqual({ form_type: formType, timestamp: Date.now() });
    expect(submission.begin()).toBe(false);

    const confirmation = browser({ consent: 'all', path: '/diagnostico/gracias?kind=presupuesto&token=PRIVATE_TOKEN#PRIVATE_HASH', referrer: 'https://startidea.es/presupuesto/nuevo?email=person@example.org', session });
    expect(confirmation.scripts).toEqual([]);
    expect(consumeAndTrack(confirmation)).toBe(true);
    expect(session.has(DIAGNOSIS_ACCEPTANCE_KEY)).toBe(false);
    expect(confirmation.scripts).toHaveLength(1);
    expect(confirmation.events('page_view')).toEqual([]);
    expect(confirmation.events()).toEqual([['event', 'form_submit', {
      form_type: formType, page_location: 'https://startidea.es/diagnostico/gracias',
      page_referrer: 'https://startidea.es/', page_title: 'Solicitud recibida',
    }]]);
    expect(JSON.stringify(confirmation.commands())).not.toMatch(/PRIVATE_|person@example/);
    expect(vi.getTimerCount()).toBe(0);
    expect(consumeAndTrack(confirmation)).toBe(false);
    expect(confirmation.events('form_submit')).toHaveLength(1);
    const reloaded = browser({ consent: 'all', path: '/diagnostico/gracias', session });
    expect(consumeAndTrack(reloaded)).toBe(false);
    expect(reloaded.scripts).toEqual([]);
    expect(reloaded.events()).toEqual([]);
  });

  it.each([null, 'essential'] as const)('sin consentimiento (%s) consume la marca sin emitir ni recuperarla al aceptar más tarde', (consent) => {
    const page = browser({ consent, path: '/diagnostico/gracias', session: acceptedMarker() });
    expect(consumeAndTrack(page)).toBe(false);
    expect(page.session.has(DIAGNOSIS_ACCEPTANCE_KEY)).toBe(false);
    expect(page.scripts).toEqual([]);
    page.emit('all');
    expect(consumeAndTrack(page)).toBe(false);
    expect(page.scripts).toEqual([]);
    expect(page.events()).toEqual([]);
  });

  it.each(['expired', 'future', 'extra_fields'] as const)('una marca %s se elimina sin cargar SDK ni emitir', (kind) => {
    const timestamp = kind === 'expired' ? Date.now() - DIAGNOSIS_ACCEPTANCE_TTL_MS - 1 : kind === 'future' ? Date.now() + 1 : Date.now();
    const session = acceptedMarker('diagnostico', timestamp);
    if (kind === 'extra_fields') session.set(DIAGNOSIS_ACCEPTANCE_KEY, JSON.stringify({ form_type: 'diagnostico', timestamp, lead_id: 'PRIVATE_ID' }));
    const page = browser({ consent: 'all', path: '/diagnostico/gracias', session });
    expect(consumeAndTrack(page)).toBe(false);
    expect(session.has(DIAGNOSIS_ACCEPTANCE_KEY)).toBe(false);
    expect(page.scripts).toEqual([]);
    expect(page.events()).toEqual([]);
  });

  it.each(['stTrack', 'gtag'])('la excepción de gracias filtra parámetros adicionales incluso mediante %s', (transport) => {
    const page = browser({ consent: 'all', path: '/diagnostico/gracias?token=PRIVATE_TOKEN' });
    const fields = { form_type: 'presupuesto', lead_id: 'PRIVATE_ID', email: 'person@example.org', arbitrary: 'PRIVATE_TEXT' };
    const queued = transport === 'gtag' ? page.window.gtag('event', 'form_submit', fields) : page.window.stTrack('form_submit', fields);
    expect(queued).toBe(true);
    expect(page.events()).toEqual([['event', 'form_submit', {
      form_type: 'presupuesto', page_location: 'https://startidea.es/diagnostico/gracias',
      page_referrer: '', page_title: 'Solicitud recibida',
    }]]);
    expect(vi.getTimerCount()).toBe(0);
    for (const form_type of [undefined, '', 'otro']) {
      expect(page.window.stTrack('form_submit', { form_type })).toBe(false);
      expect(page.window.gtag('event', 'form_submit', { form_type })).toBe(false);
    }
    expect(page.events()).toHaveLength(1);
  });

  it('si falla el SDK, la marca permanece consumida y el cliente sigue funcionando', () => {
    const page = browser({ consent: 'all', path: '/diagnostico/gracias', session: acceptedMarker(), scriptInsertionFails: true });
    expect(consumeAndTrack(page)).toBe(false);
    expect(page.session.has(DIAGNOSIS_ACCEPTANCE_KEY)).toBe(false);
    expect(page.scripts).toEqual([]);
    expect(page.events()).toEqual([]);
    expect(consumeAndTrack(page)).toBe(false);
  });

  it('si falla la cola del SDK, devuelve false sin promesas rechazadas ni restaurar la marca', () => {
    const page = browser({ consent: 'all', path: '/diagnostico/gracias', session: acceptedMarker() });
    const push = page.window.dataLayer.push;
    page.window.dataLayer.push = function (item: any) {
      if (item?.[0] === 'event') throw new Error('SDK queue unavailable');
      return push.call(this, item);
    };
    expect(consumeAndTrack(page)).toBe(false);
    expect(page.session.has(DIAGNOSIS_ACCEPTANCE_KEY)).toBe(false);
    expect(page.events()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
