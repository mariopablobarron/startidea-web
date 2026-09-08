import { describe, expect, it } from 'vitest';
import { parseProfileUpdate } from './copiloto-perfil';

const base = {
  org_nombre: 'Asociación Ejemplo',
  org_tipo: 'asociacion',
  org_descripcion: 'Acompañamos a familias con hijos con discapacidad en Granada desde 2018.',
  representante: 'Ana Pérez',
  ccaa: 'Andalucia',
  keywords: 'discapacidad, familias',
  finalidades: ['servicios-sociales', 'Servicios Sociales', 'x'],
  importe_min: '5000',
  importe_max: '',
  anos_activos: '7',
  auto_generar: true,
};

describe('Copiloto · edición de perfil', () => {
  it('normaliza un perfil válido', () => {
    const r = parseProfileUpdate(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.ccaa).toBe('andalucia');
    expect(r.data.territorios).toEqual(['andalucia']);
    expect(r.data.finalidades).toEqual(['servicios-sociales']);
    expect(r.data.importe_min).toBe(5000);
    expect(r.data.importe_max).toBeNull();
    expect(r.data.anos_activos).toBe(7);
    expect(r.data.auto_generar).toBe(true);
  });

  it('sin CCAA el territorio por defecto es nacional y respeta territorios explícitos', () => {
    const r = parseProfileUpdate({ ...base, ccaa: '' });
    expect(r.ok && r.data.territorios).toEqual(['nacional']);
    const r2 = parseProfileUpdate({ ...base, territorios: ['andalucia', 'europa'] });
    expect(r2.ok && r2.data.territorios).toEqual(['andalucia', 'europa']);
  });

  it('rechaza descripción corta, tipo inválido, sin representante e importes cruzados', () => {
    expect(parseProfileUpdate({ ...base, org_descripcion: 'corta' }).ok).toBe(false);
    expect(parseProfileUpdate({ ...base, org_tipo: 'ayuntamiento' }).ok).toBe(false);
    expect(parseProfileUpdate({ ...base, representante: '' }).ok).toBe(false);
    expect(parseProfileUpdate({ ...base, importe_min: 10000, importe_max: 5000 }).ok).toBe(false);
  });

  it('auto_generar acepta false en texto y recorta números fuera de rango', () => {
    const r = parseProfileUpdate({ ...base, auto_generar: 'false', anos_activos: 999, beneficiarios_anuales: -3 });
    expect(r.ok && r.data.auto_generar).toBe(false);
    expect(r.ok && r.data.anos_activos).toBe(200);
    expect(r.ok && r.data.beneficiarios_anuales).toBe(0);
  });
});
