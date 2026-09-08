import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const consentKey = 'startidea.cookieconsent.v2';
type Consent = 'all' | 'essential' | null;
const trackers = ['MicrosoftClarity', 'SpotifyPixel', 'UmamiAnalytics'];

function browser(initial: Consent = null, publicPage = true, path = '/comunicacion') {
  let consent = initial;
  const stored = new Map<string, string>(initial ? [[consentKey, initial]] : []);
  const listeners: Record<string, ((event: any) => void)[]> = {};
  const scripts: any[] = [];
  const pending: (() => void)[] = [];
  const reload = vi.fn();
  const location = Object.assign(new URL(path, 'https://startidea.es'), { reload });
  const element = () => ({
    hidden: true,
    classList: { add: vi.fn(), remove: vi.fn() },
    handlers: {} as Record<string, () => void>,
    addEventListener(event: string, fn: () => void) { this.handlers[event] = fn; },
  });
  const elements = {
    'cookie-banner': element(), 'cookie-accept': element(), 'cookie-reject': element(),
    'cookie-reload-notice': element(),
  };
  const window: any = {
    location,
    stPrivacy: {
      isAllowed: () => consent === 'all' && publicPage,
      hasConsent: () => consent === 'all',
      isPublicPage: publicPage,
      hasSensitiveContext: false,
      pageLocation: location.origin + location.pathname,
      pageReferrer: 'https://origen.example/',
    },
  };
  const document = {
    createElement: () => ({
      attrs: {} as Record<string, string>,
      setAttribute(name: string, value: string) { this.attrs[name] = value; },
    }),
    getElementsByTagName: () => [{ parentNode: { insertBefore: (node: unknown) => scripts.push(node) } }],
    getElementById: (id: string) => elements[id as keyof typeof elements] ?? scripts.find(script => script.id === id) ?? null,
    addEventListener(name: string, fn: (event: any) => void) { (listeners[name] ??= []).push(fn); },
    dispatchEvent(event: { type: string }) {
      if (event.type === 'cookieconsent:all') consent = 'all';
      if (event.type === 'cookieconsent:essential') consent = 'essential';
      listeners[event.type]?.forEach(fn => fn(event));
    },
  };
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  };
  const context = vm.createContext({
    window, document, location,
    localStorage: storage,
    setTimeout: (fn: () => void) => pending.push(fn),
    CustomEvent: class { constructor(public type: string) {} },
    clarityId: 'clarity-test', spotifyPixelId: 'spotify-test', websiteId: 'umami-test',
  });
  function load(name: string) {
    const content = readFileSync(new URL(`../src/components/${name}.astro`, import.meta.url), 'utf8');
    const script = content.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
    vm.runInContext(script, context);
  }
  return {
    window, scripts, stored, storage, reload, load,
    reloadNotice: elements['cookie-reload-notice'],
    emit: (value: Exclude<Consent, null>) => document.dispatchEvent({ type: `cookieconsent:${value}` }),
    accept: () => elements['cookie-accept'].handlers.click(),
    reject: () => elements['cookie-reject'].handlers.click(),
    runPending: () => pending.splice(0).forEach(fn => fn()),
  };
}

describe('SDK de terceros y consentimiento', () => {
  it.each(trackers)('%s no se inserta sin consentimiento, con esenciales o en una página privada', (name) => {
    for (const [consent, publicPage] of [[null, true], ['essential', true], ['all', false]] as const) {
      const page = browser(consent, publicPage);
      page.load(name);
      expect(page.scripts).toHaveLength(0);
      if (!publicPage) {
        page.emit('all');
        expect(page.scripts).toHaveLength(0);
      }
      expect(page.window.stNonessentialLoaded).not.toBe(true);
    }
  });

  it.each(trackers)('%s espera all y se inserta una sola vez al repetir el evento', (name) => {
    const page = browser('essential');
    page.load(name);
    page.emit('all');
    page.emit('all');
    expect(page.scripts).toHaveLength(1);
    expect(page.window.stNonessentialLoaded).toBe(true);
  });

  it.each(trackers)('%s respeta el consentimiento all ya guardado', (name) => {
    const page = browser('all');
    page.load(name);
    expect(page.scripts).toHaveLength(1);
    expect(page.scripts[0].referrerPolicy).toBe('no-referrer');
  });

  it.each(['MicrosoftClarity', 'SpotifyPixel'])('%s omite URL con query o hash aunque haya all', (name) => {
    for (const path of ['/comunicacion?email=privado', '/comunicacion#dato-privado']) {
      const page = browser('all', true, path);
      page.load(name);
      page.emit('all');
      expect(page.scripts).toHaveLength(0);
    }
  });

  it.each(['MicrosoftClarity', 'SpotifyPixel'])('%s omite un referrer sensible aunque la URL actual esté limpia', (name) => {
    const page = browser('all');
    page.window.stPrivacy.hasSensitiveContext = true;
    page.load(name);
    page.emit('all');
    expect(page.scripts).toHaveLength(0);
  });

  it('Umami sanea su auto-pageview y bloquea envíos después de revocar', () => {
    const page = browser('all', true, '/contacto?email=privado#secreto');
    page.load('UmamiAnalytics');
    expect(page.scripts[0].attrs).toMatchObject({
      'data-exclude-search': 'true', 'data-exclude-hash': 'true', 'data-before-send': 'stUmamiBeforeSend',
    });
    const payload = { url: '/contacto?email=privado', referrer: 'https://origen.example/?token=privado', title: 'Contacto' };
    expect(page.window.stUmamiBeforeSend('event', payload)).toEqual({
      url: 'https://startidea.es/contacto', referrer: 'https://origen.example/', title: 'Contacto',
    });
    expect(payload.url).toContain('privado');
    page.emit('essential');
    expect(page.window.stUmamiBeforeSend('event', payload)).toBe(false);
  });

  it('el hook de Umami bloquea una página privada incluso si alguien lo invoca directamente', () => {
    const page = browser('all', false, '/memorias/pedido?t=privado');
    page.load('UmamiAnalytics');
    expect(page.window.stUmamiBeforeSend('event', { url: '/memorias/pedido?t=privado' })).toBe(false);
  });
});

describe('revocación de SDK ya ejecutados', () => {
  it('avisa al reabrir solo si revocar recargaría la página', () => {
    const active = browser('all');
    active.load('SpotifyPixel');
    active.load('CookieBanner');
    expect(active.reloadNotice.hidden).toBe(true);
    active.window.startideaConsent.reopen();
    expect(active.reloadNotice.hidden).toBe(false);
    expect(active.reload).not.toHaveBeenCalled();

    for (const consent of [null, 'essential', 'all'] as const) {
      const page = browser(consent);
      page.load('CookieBanner');
      page.window.startideaConsent.reopen();
      expect(page.reloadNotice.hidden).toBe(true);
    }
  });

  it('guarda esenciales y recarga después de aceptar, cargar SDK y revocar', () => {
    const page = browser();
    trackers.forEach(page.load);
    page.load('CookieBanner');
    page.accept();
    expect(page.scripts).toHaveLength(3);
    page.reject();
    expect(page.stored.get(consentKey)).toBe('essential');
    expect(page.window.stPrivacy.isAllowed()).toBe(false);
    expect(page.reload).toHaveBeenCalledOnce();
  });

  it('revoca también después de reabrir cookies, aunque esa pantalla haya borrado la clave guardada', () => {
    const page = browser('all');
    page.load('SpotifyPixel');
    page.load('CookieBanner');
    page.runPending();
    page.stored.delete(consentKey);
    page.window.startideaConsent.reopen();
    page.reject();
    expect(page.stored.get(consentKey)).toBe('essential');
    expect(page.reload).toHaveBeenCalledOnce();
  });

  it('no recarga por rechazar inicialmente ni por revocar cuando ningún SDK se cargó', () => {
    const initial = browser();
    initial.load('CookieBanner');
    initial.reject();
    expect(initial.reload).not.toHaveBeenCalled();
    const privatePage = browser('all', false);
    trackers.forEach(privatePage.load);
    privatePage.load('CookieBanner');
    privatePage.reject();
    expect(privatePage.reload).not.toHaveBeenCalled();
  });

  it('elimina el all antiguo si guardar esenciales falla antes de recargar', () => {
    const page = browser('all');
    page.load('SpotifyPixel');
    page.load('CookieBanner');
    vi.spyOn(page.storage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    page.reject();
    expect(page.stored.has(consentKey)).toBe(false);
    expect(page.reload).toHaveBeenCalledOnce();
    const reloaded = browser((page.storage.getItem(consentKey) as Consent) ?? null);
    trackers.forEach(reloaded.load);
    expect(reloaded.scripts).toHaveLength(0);
  });
});
