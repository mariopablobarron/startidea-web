import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const component = readFileSync(new URL('../src/components/AnalyticsTracker.astro', import.meta.url), 'utf8');
const script = component.match(/<script is:inline>([\s\S]*?)<\/script>/)![1];
const privacyComponent = readFileSync(new URL('../src/components/AnalyticsPrivacy.astro', import.meta.url), 'utf8');
const privacyScript = privacyComponent.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];

function tracker(path = '/notas/enisa-o-cdti-cual-pedir', withTransport = true, referrer = '') {
  const listeners: Record<string, ((event: any) => void)[]> = {};
  const send = vi.fn((_event: string, _params: Record<string, unknown>) => true);
  const legacyGtag = vi.fn();
  const window: any = { dataLayer: [], gtag: legacyGtag, ...(withTransport ? { stSendAnalyticsEvent: send } : {}) };
  const location = new URL(path, 'https://startidea.es');
  const stored = new Map([['startidea.cookieconsent.v2', 'all']]);
  const context = vm.createContext({
    window, location, URL, URLSearchParams, noindex: false,
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    },
    document: {
      referrer,
      addEventListener: (name: string, handler: (event: any) => void) => {
        (listeners[name] ??= []).push(handler);
      },
    },
  });
  vm.runInContext(privacyScript, context);
  vm.runInContext(script, context);
  function click(href: string, inMain = true, extra: Record<string, string> = {}) {
    const attrs = { href, ...extra };
    const link = {
      getAttribute: (name: string) => attrs[name as keyof typeof attrs] ?? null,
      closest: (selector: string) => selector === 'main' && inMain ? {} : null,
    };
    const target = { closest: (selector: string) => selector === 'a[href]' ? link : null };
    listeners.click.forEach(handler => handler({ target }));
  }
  return { window, send, legacyGtag, click, listeners };
}

describe('eventos de recorridos SEO', () => {
  it('envía una vez al transporte consentido sin duplicar por gtag ni dataLayer', () => {
    const { window, send, legacyGtag } = tracker();
    window.stTrack('cta_click', { cta_id: 'ver_servicio' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]).toEqual(['cta_click', {
      cta_id: 'ver_servicio', page_location: 'https://startidea.es/notas/enisa-o-cdti-cual-pedir', page_referrer: '',
    }]);
    expect(legacyGtag).not.toHaveBeenCalled();
    expect(window.dataLayer).toEqual([]);
  });

  it('falla cerrado si falta el transporte aunque existan gtag y dataLayer', () => {
    const { window, legacyGtag } = tracker(undefined, false);
    expect(window.stTrack('cta_click', { cta_id: 'ver_servicio' })).toBe(false);
    expect(window.dataLayer).toEqual([]);
    expect(legacyGtag).not.toHaveBeenCalled();
  });

  it('registra destino y origen públicos sin query, hash ni texto personal', () => {
    const { click, send } = tracker('/notas/enisa-o-cdti-cual-pedir?email=privado');
    click('/financiacion-empresas/?token=privado#contacto', true, { 'data-link-type': 'servicio' });
    expect(send.mock.calls).toEqual([['internal_link_click', {
      source_path: '/notas/enisa-o-cdti-cual-pedir', target_path: '/financiacion-empresas',
      source_type: 'nota', target_type: 'servicio', link_type: 'servicio',
      page_location: 'https://startidea.es/notas/enisa-o-cdti-cual-pedir', page_referrer: '',
    }]]);
  });

  it('omite menú, enlaces externos, utilidades y anclas de la misma página', () => {
    const { click, send } = tracker();
    click('/comunicacion', false);
    click('https://otro.example/comunicacion');
    click('/portal?token=privado');
    click('#resumen');
    expect(send).not.toHaveBeenCalled();
    const privatePage = tracker('/memorias/pedido?t=privado');
    privatePage.click('/comunicacion');
    expect(privatePage.send).not.toHaveBeenCalled();
  });

  it('mide el acceso público al formulario sin emitir sus parámetros ni seguir páginas privadas', () => {
    const t = tracker('/notas/como-conseguir-subvenciones-ong');
    t.click('/subvenciones/presentar/nuevo?ref=nota');
    expect(t.send.mock.calls[0][1]).toMatchObject({
      target_path: '/subvenciones/presentar/nuevo', target_type: 'solicitud',
    });
    const formPage = tracker('/subvenciones/presentar/nuevo?token=privado');
    formPage.click('/comunicacion');
    expect(formPage.send).not.toHaveBeenCalled();
  });

  it('separa vista, intención de reserva y consulta sin afirmar pago ni lead', () => {
    const t = tracker('/laboratorio/cursos/crea-tu-primer-agente-ia-sin-codigo');
    t.listeners.submit.forEach(handler => handler({
      target: { getAttribute: () => '/api/curso-checkout' },
    }));
    t.click('/contacto?curso=crea-tu-primer-agente-ia-sin-codigo', true, { 'data-course-intent': 'grupo' });
    expect(t.send.mock.calls.map(call => call[0])).toEqual([
      'view_course', 'course_checkout_intent', 'internal_link_click', 'course_contact_intent',
    ]);
    expect(t.send.mock.calls[3][1].intent_type).toBe('grupo');
  });

  it('no cuenta la confirmación como curso ni emite eventos desde enlaces personales', () => {
    for (const path of ['/laboratorio/cursos/gracias?session_id=privado', '/memorias/pedido?t=privado', '/contrato/privado']) {
      const t = tracker(path);
      t.window.stTrack('form_start', {});
      expect(t.send).not.toHaveBeenCalled();
    }
    for (const path of ['/diagnostico', '/presupuesto/nuevo', '/gracias']) {
      const t = tracker(path);
      expect(t.window.stTrack('form_submit', { form_type: 'diagnostico' })).toBe(false);
      expect(t.window.stTrack('form_submit', { form_type: 'presupuesto' })).toBe(false);
      expect(t.send).not.toHaveBeenCalled();
    }
    const thanks = tracker('/diagnostico/gracias?kind=presupuesto&token=privado');
    thanks.window.stTrack('form_submit', { form_type: 'presupuesto', lead_id: 'privado' });
    expect(thanks.send.mock.calls).toEqual([['form_submit', {
      form_type: 'presupuesto', page_location: 'https://startidea.es/diagnostico/gracias', page_referrer: '',
    }]]);
  });

  it('sobrescribe también la URL y el referente automáticos de GA4', () => {
    const t = tracker('/contacto?email=privado#token', true, 'https://startidea.es/portal/link/token?email=privado');
    t.window.stTrack('form_start', { page_location: 'dato-sin-sanear' });
    expect(t.send.mock.calls[0][1]).toEqual({
      page_location: 'https://startidea.es/contacto', page_referrer: 'https://startidea.es/',
    });
    const external = tracker(undefined, true, 'https://otro.example/privado?email=privado');
    external.click('/comunicacion');
    expect(external.send.mock.calls[0][1].page_referrer).toBe('https://otro.example/');
  });

  it('no interrumpe navegación si la etiqueta falla', () => {
    const { click, send } = tracker();
    send.mockImplementation(() => { throw new Error('tag unavailable'); });
    expect(() => click('/comunicacion')).not.toThrow();
  });
});
