import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const component = readFileSync(new URL('../src/components/AnalyticsTracker.astro', import.meta.url), 'utf8');
const script = component.match(/<script is:inline>([\s\S]*?)<\/script>/)![1];

function tracker(path = '/notas/enisa-o-cdti-cual-pedir', withGtag = true, referrer = '') {
  const listeners: Record<string, ((event: any) => void)[]> = {};
  const gtag = vi.fn();
  const window: any = { dataLayer: [], ...(withGtag ? { gtag } : {}) };
  const location = new URL(path, 'https://startidea.es');
  vm.runInNewContext(script, {
    window, location, URL, URLSearchParams,
    localStorage: { getItem: () => '{}', setItem: vi.fn() },
    document: {
      referrer,
      addEventListener: (name: string, handler: (event: any) => void) => {
        (listeners[name] ??= []).push(handler);
      },
    },
  });
  function click(href: string, inMain = true, extra: Record<string, string> = {}) {
    const attrs = { href, ...extra };
    const link = {
      getAttribute: (name: string) => attrs[name as keyof typeof attrs] ?? null,
      closest: (selector: string) => selector === 'main' && inMain ? {} : null,
    };
    const target = { closest: (selector: string) => selector === 'a[href]' ? link : null };
    listeners.click.forEach(handler => handler({ target }));
  }
  return { window, gtag, click, listeners };
}

describe('eventos de recorridos SEO', () => {
  it('envía a GA4 sin depender de GTM ni duplicar el evento', () => {
    const { window, gtag } = tracker();
    window.stTrack('cta_click', { cta_id: 'ver_servicio' });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0]).toEqual(['event', 'cta_click', {
      cta_id: 'ver_servicio', page_location: 'https://startidea.es/notas/enisa-o-cdti-cual-pedir', page_referrer: '',
    }]);
    expect(window.dataLayer).toEqual([]);
  });

  it('mantiene el respaldo cuando solo existe dataLayer', () => {
    const { window } = tracker(undefined, false);
    window.stTrack('cta_click', { cta_id: 'ver_servicio' });
    expect(window.dataLayer).toEqual([{
      event: 'cta_click', cta_id: 'ver_servicio',
      page_location: 'https://startidea.es/notas/enisa-o-cdti-cual-pedir', page_referrer: '',
    }]);
  });

  it('registra destino y origen públicos sin query, hash ni texto personal', () => {
    const { click, gtag } = tracker('/notas/enisa-o-cdti-cual-pedir?email=privado');
    click('/financiacion-empresas/?token=privado#contacto', true, { 'data-link-type': 'servicio' });
    expect(gtag.mock.calls).toEqual([['event', 'internal_link_click', {
      source_path: '/notas/enisa-o-cdti-cual-pedir', target_path: '/financiacion-empresas',
      source_type: 'nota', target_type: 'servicio', link_type: 'servicio',
      page_location: 'https://startidea.es/notas/enisa-o-cdti-cual-pedir', page_referrer: '',
    }]]);
  });

  it('omite menú, enlaces externos, utilidades y anclas de la misma página', () => {
    const { click, gtag } = tracker();
    click('/comunicacion', false);
    click('https://otro.example/comunicacion');
    click('/portal?token=privado');
    click('#resumen');
    expect(gtag).not.toHaveBeenCalled();
    const privatePage = tracker('/memorias/pedido?t=privado');
    privatePage.click('/comunicacion');
    expect(privatePage.gtag).not.toHaveBeenCalled();
  });

  it('mide el acceso público al formulario sin emitir sus parámetros ni seguir páginas privadas', () => {
    const t = tracker('/notas/como-conseguir-subvenciones-ong');
    t.click('/subvenciones/presentar/nuevo?ref=nota');
    expect(t.gtag.mock.calls[0][2]).toMatchObject({
      target_path: '/subvenciones/presentar/nuevo', target_type: 'solicitud',
    });
    const formPage = tracker('/subvenciones/presentar/nuevo?token=privado');
    formPage.click('/comunicacion');
    expect(formPage.gtag).not.toHaveBeenCalled();
  });

  it('separa vista, intención de reserva y consulta sin afirmar pago ni lead', () => {
    const t = tracker('/laboratorio/cursos/crea-tu-primer-agente-ia-sin-codigo');
    t.listeners.submit.forEach(handler => handler({
      target: { getAttribute: () => '/api/curso-checkout' },
    }));
    t.click('/contacto?curso=crea-tu-primer-agente-ia-sin-codigo', true, { 'data-course-intent': 'grupo' });
    expect(t.gtag.mock.calls.map(call => call[1])).toEqual([
      'view_course', 'course_checkout_intent', 'internal_link_click', 'course_contact_intent',
    ]);
    expect(t.gtag.mock.calls[3][2].intent_type).toBe('grupo');
  });

  it('no cuenta la confirmación como curso ni emite eventos desde enlaces personales', () => {
    for (const path of ['/laboratorio/cursos/gracias?session_id=privado', '/memorias/pedido?t=privado', '/contrato/privado']) {
      const t = tracker(path);
      t.window.stTrack('form_start', {});
      expect(t.gtag).not.toHaveBeenCalled();
    }
  });

  it('sobrescribe también la URL y el referente automáticos de GA4', () => {
    const t = tracker('/contacto?email=privado#token', true, 'https://startidea.es/portal/link/token?email=privado');
    t.window.stTrack('form_start', { page_location: 'dato-sin-sanear' });
    expect(t.gtag.mock.calls[0][2]).toEqual({
      page_location: 'https://startidea.es/contacto', page_referrer: 'https://startidea.es/',
    });
    const external = tracker(undefined, true, 'https://otro.example/privado?email=privado');
    external.click('/comunicacion');
    expect(external.gtag.mock.calls[0][2].page_referrer).toBe('https://otro.example/');
  });

  it('no interrumpe navegación si la etiqueta falla', () => {
    const { click, gtag } = tracker();
    gtag.mockImplementation(() => { throw new Error('tag unavailable'); });
    expect(() => click('/comunicacion')).not.toThrow();
  });
});
