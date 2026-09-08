import { afterEach, describe, expect, it, vi } from 'vitest';
import { edicionFinalizada, edicionVigente, estadoCursoPublico } from '../src/lib/cursos';

afterEach(() => vi.useRealTimers());

describe('vigencia de las ediciones de cursos', () => {
  const fecha = new Date('2026-09-19T00:00:00.000Z');

  it.each([
    { momento: 'antes del día publicado', ahora: '2026-09-18T12:00:00.000Z', vigente: true },
    { momento: 'durante el día publicado', ahora: '2026-09-19T12:00:00.000Z', vigente: true },
    { momento: 'después del día publicado', ahora: '2026-09-20T12:00:00.000Z', vigente: false },
  ])('$momento', ({ ahora, vigente }) => {
    expect(edicionVigente(fecha, new Date(ahora))).toBe(vigente);
    expect(edicionFinalizada(fecha, new Date(ahora))).toBe(!vigente);
  });

  it.each([
    {
      estacion: 'verano', fecha: '2026-09-19',
      ultimoInstante: '2026-09-19T21:59:59.999Z', siguienteDia: '2026-09-19T22:00:00.000Z',
    },
    {
      estacion: 'invierno', fecha: '2026-12-19',
      ultimoInstante: '2026-12-19T22:59:59.999Z', siguienteDia: '2026-12-19T23:00:00.000Z',
    },
  ])('finaliza a medianoche de Madrid en $estacion, aunque UTC siga en el mismo día', ({ fecha, ultimoInstante, siguienteDia }) => {
    const edicion = new Date(`${fecha}T00:00:00.000Z`);
    const antesDelCorte = new Date(ultimoInstante);
    const despuesDelCorte = new Date(siguienteDia);

    expect(edicionVigente(edicion, antesDelCorte)).toBe(true);
    expect(edicionFinalizada(edicion, antesDelCorte)).toBe(false);
    expect(estadoCursoPublico('abierto', edicion, antesDelCorte)).toBe('abierto');
    expect(edicionVigente(edicion, despuesDelCorte)).toBe(false);
    expect(edicionFinalizada(edicion, despuesDelCorte)).toBe(true);
    expect(estadoCursoPublico('abierto', edicion, despuesDelCorte)).toBe('edicion-finalizada');
  });

  it.each([
    { caso: 'sin fecha', fecha: undefined },
    { caso: 'con fecha inválida', fecha: new Date(Number.NaN) },
  ])('$caso no inventa una edición vigente ni finalizada', ({ fecha }) => {
    const ahora = new Date('2026-09-20T12:00:00.000Z');

    expect(edicionVigente(fecha, ahora)).toBe(false);
    expect(edicionFinalizada(fecha, ahora)).toBe(false);
    for (const estado of ['abierto', 'proximo', 'a-demanda', 'agotado'] as const) {
      expect(estadoCursoPublico(estado, fecha, ahora)).toBe(estado);
    }
  });

  it.each(['abierto', 'proximo', 'a-demanda', 'agotado'] as const)('conserva %s mientras la fecha está vigente y lo reemplaza al finalizar', (estado) => {
    expect(estadoCursoPublico(estado, fecha, new Date('2026-09-18T12:00:00.000Z'))).toBe(estado);
    expect(estadoCursoPublico(estado, fecha, new Date('2026-09-19T12:00:00.000Z'))).toBe(estado);
    expect(estadoCursoPublico(estado, fecha, new Date('2026-09-20T12:00:00.000Z'))).toBe('edicion-finalizada');
  });

  it('un curso a demanda sin fecha continúa disponible al avanzar el tiempo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'));
    expect(estadoCursoPublico('a-demanda', undefined)).toBe('a-demanda');
    expect(edicionFinalizada(undefined)).toBe(false);

    vi.setSystemTime(new Date('2027-09-19T12:00:00.000Z'));
    expect(estadoCursoPublico('a-demanda', undefined)).toBe('a-demanda');
    expect(edicionFinalizada(undefined)).toBe(false);
  });

  it('lee la hora actual en cada llamada sin recargar el módulo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T21:59:59.999Z'));
    expect(edicionVigente(fecha)).toBe(true);
    expect(edicionFinalizada(fecha)).toBe(false);
    expect(estadoCursoPublico('abierto', fecha)).toBe('abierto');

    vi.setSystemTime(new Date('2026-09-19T22:00:00.000Z'));
    expect(edicionVigente(fecha)).toBe(false);
    expect(edicionFinalizada(fecha)).toBe(true);
    expect(estadoCursoPublico('abierto', fecha)).toBe('edicion-finalizada');
  });
});
