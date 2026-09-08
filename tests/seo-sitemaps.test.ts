import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sitemap: vi.fn(),
  listConvocatoriasActivas: vi.fn(),
}));

vi.mock('@astrojs/sitemap', () => ({
  default: (options: unknown) => {
    mocks.sitemap(options);
    return { name: '@astrojs/sitemap' };
  },
}));
vi.mock('@/lib/expedientes-db', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/lib/expedientes-db')>(),
  listConvocatoriasActivas: mocks.listConvocatoriasActivas,
}));

import '../astro.config.mjs';
import { GET } from '../src/pages/sitemap-catalogo.xml';

const { filter, serialize, customPages } = mocks.sitemap.mock.calls[0][0] as {
  customPages: string[];
  filter: (page: string) => boolean;
  serialize: (item: { url: string; lastmod?: string }) => { url: string; lastmod?: string };
};

describe('sitemap público', () => {
  it('conserva las cuatro fichas publicadas aunque se rendericen por petición', () => {
    expect(customPages).toEqual(expect.arrayContaining([
      'https://startidea.es/laboratorio/cursos/comunicacion-estrategica-tercer-sector',
      'https://startidea.es/laboratorio/cursos/crea-tu-primer-agente-ia-sin-codigo',
      'https://startidea.es/laboratorio/cursos/email-marketing-segmentado-tercer-sector',
      'https://startidea.es/laboratorio/cursos/subvenciones-como-presentar-solicitud',
    ]));
    expect(customPages).not.toContain('https://startidea.es/laboratorio/cursos/gracias');
    expect(customPages.every(filter)).toBe(true);
  });
  it.each([
    '/portal', '/portal/', '/portal/registro', '/portal/enviado', '/portal/dashboard',
    '/portal/link/enlace-personal', '/portal/docs/expediente/memoria',
    '/memorias/pedido', '/memorias/pedido/', '/memorias/pedido?t=enlace-personal',
    '/contrato/enlace-personal', '/admin', '/admin/login', '/api/contacto', '/404', '/500',
    '/diagnostico/gracias', '/presupuesto/nuevo', '/recursos/gracias',
    '/laboratorio/cursos/gracias', '/subvenciones/presentar/nuevo', '/subvenciones/presentar/gracias',
    '/subvenciones/mi-copiloto', '/subvenciones/mi-copiloto/perfil',
  ])('excluye la utilidad %s', (path) => {
    expect(filter(`https://startidea.es${path}`)).toBe(false);
  });

  it.each([
    '/', '/memorias', '/precios', '/diagnostico', '/contacto', '/comunicacion',
    '/redes-sociales-ia', '/laboratorio/cursos', '/laboratorio/productos',
    '/subvenciones', '/subvenciones/presentar', '/subvenciones/granada',
    '/subvenciones/boja-2026-inclusion-social', '/subvenciones/mapa',
  ])('conserva la página pública %s', (path) => {
    expect(filter(`https://startidea.es${path}`)).toBe(true);
  });

  it('mantiene fuera las fichas BDNS y las landings territoriales pendientes de validación', () => {
    expect(filter('https://startidea.es/subvenciones/bdns-123456')).toBe(false);
    expect(filter('https://startidea.es/subvenciones/territorio/andalucia')).toBe(false);
  });

  it('normaliza las URL sin asignar fechas de build a las landings', () => {
    expect(serialize({ url: 'https://startidea.es/memorias/' }))
      .toEqual({ url: 'https://startidea.es/memorias' });
    expect(serialize({ url: 'https://startidea.es/' }).url).toBe('https://startidea.es/');
  });
});

describe('sitemap del catálogo SSR', () => {
  afterEach(() => vi.useRealTimers());

  it('no inventa cambios diarios y solo anuncia convocatorias vigentes', async () => {
    mocks.listConvocatoriasActivas.mockReturnValue([
      { slug: 'convocatoria-abierta', activa: true, deadlineIso: null },
      { slug: 'convocatoria-caducada', activa: true, deadlineIso: '2020-01-01' },
      { slug: 'convocatoria-inactiva', activa: false, deadlineIso: null },
    ]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'));
    const first = await GET({} as never);
    const xml = await first.text();
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
    const second = await GET({} as never);

    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toContain('application/xml');
    expect(xml).toContain('<loc>https://startidea.es/precios</loc>');
    expect(xml).toContain('<loc>https://startidea.es/subvenciones/catalogo</loc>');
    expect(xml).toContain('/subvenciones/catalogo/convocatoria-abierta</loc>');
    expect(xml).not.toContain('convocatoria-caducada');
    expect(xml).not.toContain('convocatoria-inactiva');
    expect(xml).not.toContain('<lastmod>');
    expect(xml).not.toMatch(/<loc>[^<]*(?:\/portal|\/pedido|\/gracias)/);
    expect(await second.text()).toBe(xml);
  });
});
