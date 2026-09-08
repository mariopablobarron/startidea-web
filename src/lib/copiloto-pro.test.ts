import { describe, expect, it } from 'vitest';
import {
  COPILOTO_PLANS,
  buildEncajePrompt,
  encajeHeuristico,
  encajeReal,
  esPro,
  parseEncaje,
  planEfectivo,
  scoreDesdeVeredicto,
} from './copiloto-pro';
import type { AutoCopilotoProfile } from './auto-copiloto-db';

const perfil = {
  id: 'p1',
  manage_token: 't',
  confirm_token: null,
  confirmed: 1,
  active: 1,
  email: 'a@b.es',
  org_nombre: 'Asociación Ejemplo',
  org_cif: '',
  org_tipo: 'asociacion',
  org_descripcion: 'Acompañamos a familias con hijos con discapacidad en Granada.',
  representante: 'Ana',
  telefono: '',
  web: '',
  ccaa: 'andalucia',
  keywords: 'discapacidad, familias',
  finalidades: '[]',
  territorios: '["andalucia","nacional"]',
  importe_min: 0,
  importe_max: null,
  auto_generar: 1,
  created_at: 0,
  last_run_at: null,
  anos_activos: 6,
  beneficiarios_anuales: 120,
  presupuesto_anual: '50.000-100.000',
  proyectos_anteriores: '',
  logros_principales: '',
  plan: 'pro',
  plan_until: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
} satisfies AutoCopilotoProfile;

const conv = {
  slug: 'conv-1',
  title: 'Subvenciones a entidades de atención a personas con discapacidad',
  organization: 'Junta de Andalucía',
  ccaa: 'Andalucía',
  geo_level: 'autonomico',
  finalidades: ['discapacidad'],
  amount_eur: 30000,
  deadline: '2026-10-15',
};

describe('Copiloto Pro · planes', () => {
  it('precios y límites según el plan de negocio', () => {
    expect(COPILOTO_PLANS.pro.precioEur).toBe(19);
    expect(COPILOTO_PLANS.pro_memoria.precioEur).toBe(39);
    expect(COPILOTO_PLANS.free.maxPorCiclo).toBe(2);
    expect(COPILOTO_PLANS.pro.maxPorCiclo).toBe(5);
    expect(COPILOTO_PLANS.free.encajeReal).toBe(false);
  });

  it('el plan de pago caduca por plan_until y los valores raros son free', () => {
    const ahora = 1_800_000_000_000;
    expect(planEfectivo({ plan: 'pro', plan_until: null }, ahora)).toBe('pro');
    expect(planEfectivo({ plan: 'pro', plan_until: ahora / 1000 - 10 }, ahora)).toBe('free');
    expect(planEfectivo({ plan: 'pro_memoria', plan_until: ahora / 1000 + 10 }, ahora)).toBe('pro_memoria');
    expect(planEfectivo({ plan: 'vip', plan_until: null }, ahora)).toBe('free');
    expect(esPro({ plan: 'free', plan_until: null })).toBe(false);
  });
});

describe('Copiloto Pro · encaje real', () => {
  it('parsea el JSON del modelo aunque venga con prosa y calcula el score aquí', () => {
    const text = 'Claro:\n{"veredicto":"encaja","motivo":"La línea financia exactamente tu actividad en Andalucía.","motivos_a_favor":["territorio","finalidad"],"avisos":[],"requisitos_clave":["inscripción en el registro de entidades"]}\nSaludos.';
    const r = parseEncaje(text);
    expect(r?.veredicto).toBe('encaja');
    expect(r?.score).toBe(90);
    expect(r?.requisitosClave).toEqual(['inscripción en el registro de entidades']);
    expect(r?.llm).toBe(true);
  });

  it('un no_encaja con avisos puntúa bajo y JSON roto devuelve null', () => {
    const r = parseEncaje('{"veredicto":"no encaja","motivo":"Solo para ayuntamientos.","avisos":["tipo de entidad","territorio"]}');
    expect(r?.veredicto).toBe('no_encaja');
    expect(r?.score).toBe(4);
    expect(parseEncaje('sin json')).toBeNull();
    expect(parseEncaje('{"veredicto":"encaja"}')).toBeNull();
  });

  it('scoreDesdeVeredicto se mantiene en 0-100', () => {
    expect(scoreDesdeVeredicto('encaja', 10, 0)).toBe(95);
    expect(scoreDesdeVeredicto('no_encaja', 0, 10)).toBe(0);
    expect(scoreDesdeVeredicto('parcial', 1, 1)).toBe(52);
  });

  it('el heurístico explica territorio e importe sin modelo', () => {
    const r = encajeHeuristico(45, conv, perfil);
    expect(r.llm).toBe(false);
    expect(r.veredicto).toBe('encaja');
    expect(r.motivo).toMatch(/Andalucía/);
    expect(r.motivo).toMatch(/30\.000/);
  });

  it('encajeReal cae al heurístico si el modelo falla', async () => {
    const r = await encajeReal(perfil, conv, 30, async () => {
      throw new Error('boom');
    });
    expect(r.llm).toBe(false);
    expect(r.score).toBe(30);
    const ok = await encajeReal(perfil, conv, 30, async () => '{"veredicto":"parcial","motivo":"Depende del registro.","motivos_a_favor":["x"],"avisos":["y"]}');
    expect(ok.llm).toBe(true);
    expect(ok.score).toBe(52);
  });

  it('el prompt lleva perfil y convocatoria y pide JSON', () => {
    const p = buildEncajePrompt(perfil, conv);
    expect(p.user).toMatch(/Asociación Ejemplo/);
    expect(p.user).toMatch(/Junta de Andalucía/);
    expect(p.user).toMatch(/Beneficiarios al año: 120/);
    expect(p.system).toMatch(/SOLO con un objeto JSON/);
  });
});
