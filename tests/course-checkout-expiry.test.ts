import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCollection: vi.fn(),
  hasStripe: vi.fn(),
  getStripe: vi.fn(),
  sessionCreate: vi.fn(),
  createReserva: vi.fn(),
  rateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock('astro:content', () => ({ getCollection: mocks.getCollection }));
vi.mock('@/lib/stripe', () => ({ hasStripe: mocks.hasStripe, getStripe: mocks.getStripe }));
vi.mock('@/lib/cursos-db', () => ({ createReserva: mocks.createReserva }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit, getClientIp: mocks.getClientIp }));

import { POST } from '../src/pages/api/curso-checkout';

const slug = 'comunicacion-estrategica-tercer-sector';
const title = 'Comunicación estratégica';

function course(proxima_edicion?: string) {
  mocks.getCollection.mockResolvedValue([{
    slug,
    data: {
      title,
      draft: false,
      estado: proxima_edicion ? 'proximo' : 'a-demanda',
      proxima_edicion: proxima_edicion ? new Date(proxima_edicion) : undefined,
      precio: 320,
      precio_esfl: 240,
    },
  }]);
}

async function post() {
  return POST({
    request: new Request('https://startidea.es/api/curso-checkout', {
      method: 'POST',
      body: new URLSearchParams({ slug, esfl: 'true', senal: '1', precio: '1' }),
    }),
    clientAddress: '198.51.100.18',
    redirect: (location: string, status = 302) => new Response(null, {
      status,
      headers: { location },
    }),
  } as never);
}

describe('POST /api/curso-checkout: vigencia de la edición', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    mocks.hasStripe.mockReturnValue(true);
    mocks.getStripe.mockReturnValue({ checkout: { sessions: { create: mocks.sessionCreate } } });
    mocks.sessionCreate.mockResolvedValue({
      id: 'cs_test_local',
      url: 'https://checkout.example.test/sesion-local',
    });
    mocks.rateLimit.mockReturnValue({ ok: true });
    mocks.getClientIp.mockReturnValue('198.51.100.18');
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    ['verano', '2026-09-19', '2026-09-19T22:00:00.000Z'],
    ['invierno', '2026-01-19', '2026-01-19T23:00:00.000Z'],
  ])('bloquea desde medianoche en Madrid (%s), antes de Stripe y la reserva', async (_season, edition, now) => {
    vi.setSystemTime(new Date(now));
    course(edition);

    const response = await post();

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`/laboratorio/cursos/${slug}`);
    expect(mocks.getCollection).toHaveBeenCalledWith('cursos', expect.any(Function));
    expect(mocks.getStripe).not.toHaveBeenCalled();
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
    expect(mocks.createReserva).not.toHaveBeenCalled();
  });

  it.each([
    ['último instante del día en Madrid', '2026-09-19', '2026-09-19T21:59:59.999Z'],
    ['fecha futura', '2026-09-21', '2026-09-19T22:00:00.000Z'],
    ['curso a demanda sin fecha', undefined, '2026-09-19T22:00:00.000Z'],
  ])('conserva la señal de 50 € para %s', async (_scenario, edition, now) => {
    vi.setSystemTime(new Date(now));
    course(edition);

    const response = await post();

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://checkout.example.test/sesion-local');
    expect(mocks.getStripe).toHaveBeenCalledOnce();
    expect(mocks.sessionCreate).toHaveBeenCalledOnce();
    expect(mocks.sessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      line_items: [expect.objectContaining({
        quantity: 1,
        price_data: expect.objectContaining({ currency: 'eur', unit_amount: 5000 }),
      })],
      metadata: { slug, title, esfl: '1' },
    }));
    expect(mocks.createReserva).toHaveBeenCalledOnce();
    expect(mocks.createReserva).toHaveBeenCalledWith(expect.objectContaining({
      curso_slug: slug,
      curso_title: title,
      esfl: 1,
      senal_cents: 5000,
      stripe_session_id: 'cs_test_local',
    }));
  });
});
