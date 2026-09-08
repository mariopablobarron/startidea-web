import { describe, expect, it } from 'vitest';
import {
  MEMORIA_TIPOS,
  buildDocumentoPrompt,
  buildGuionPrompt,
  cifrasLista,
  cifrasNoRespaldadas,
  generarDocumento,
  generarGuion,
  mdToHtml,
  parseCarga,
  parseGuion,
} from './memorias-engine';

const body = {
  tipo: 'justificacion',
  org_nombre: 'Asociación Ejemplo',
  org_tipo: 'asociacion',
  email: 'ana@ejemplo.org',
  representante: 'Ana Pérez',
  periodo: '2025',
  financiador: 'Junta de Andalucía',
  convocatoria: 'Programa de inclusión social 2025',
  importe: '18.000 €',
  que_hace: 'Acompañamos a familias con hijos con discapacidad en Granada con apoyo educativo y respiro familiar.',
  actividades: '- 24 talleres de respiro familiar\n- 3 campamentos de verano\n- Atención psicológica individual a familias',
  cifras: '120 familias atendidas\n312 sesiones de atención\n24 talleres',
  testimonios: '"Por primera vez pudimos descansar un fin de semana" (madre participante)',
  objetivos: 'Atender a 100 familias',
  dificultades: '',
  tono: 'cercano',
};

describe('Generador de memorias · carga guiada', () => {
  it('acepta una carga completa y normaliza', () => {
    const r = parseCarga(body);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.carga.tipo).toBe('justificacion');
    expect(r.carga.email).toBe('ana@ejemplo.org');
    expect(r.carga.tono).toBe('cercano');
  });

  it('exige financiador en justificación e informe, no en memoria anual', () => {
    expect(parseCarga({ ...body, financiador: '' }).ok).toBe(false);
    expect(parseCarga({ ...body, tipo: 'informe_impacto', financiador: '' }).ok).toBe(false);
    expect(parseCarga({ ...body, tipo: 'memoria_anual', financiador: '' }).ok).toBe(true);
  });

  it('rechaza tipo desconocido, email inválido, descripción corta y sin cifras', () => {
    expect(parseCarga({ ...body, tipo: 'otro' }).ok).toBe(false);
    expect(parseCarga({ ...body, email: 'no' }).ok).toBe(false);
    expect(parseCarga({ ...body, que_hace: 'corto' }).ok).toBe(false);
    expect(parseCarga({ ...body, cifras: '' }).ok).toBe(false);
  });

  it('cifrasLista se queda con las líneas que llevan número', () => {
    expect(cifrasLista('- 120 familias\nsin cifra\n• 24 talleres')).toEqual(['120 familias', '24 talleres']);
  });

  it('los precios coinciden con el plan de negocio', () => {
    expect(MEMORIA_TIPOS.justificacion.precioEur).toBe(150);
    expect(MEMORIA_TIPOS.informe_impacto.precioEur).toBe(250);
    expect(MEMORIA_TIPOS.memoria_anual.precioEur).toBe(400);
  });
});

describe('Generador de memorias · guion', () => {
  it('parsea el guion y completa las secciones obligatorias que falten', () => {
    const def = MEMORIA_TIPOS.justificacion;
    const g = parseGuion(
      'Aquí va:\n{"titulo":"Justificación 2025","mensajes_clave":["120 familias, 20 más de las previstas"],"secciones":[{"titulo":"Resumen de la ejecución","contenido":"qué se hizo"}],"datos_destacados":["120 familias atendidas"],"preguntas":[]}',
      def,
    );
    expect(g?.titulo).toBe('Justificación 2025');
    expect(g?.secciones.length).toBe(def.secciones.length);
    expect(g?.secciones[0].titulo).toBe('Resumen de la ejecución');
    expect(parseGuion('nada', def)).toBeNull();
  });

  it('el prompt del guion lleva secciones, datos y la regla de no inventar', () => {
    const r = parseCarga(body);
    if (!r.ok) throw new Error();
    const p = buildGuionPrompt(r.carga);
    expect(p.user).toMatch(/Desviaciones y medidas adoptadas/);
    expect(p.user).toMatch(/120 familias atendidas/);
    expect(p.system).toMatch(/No inventas cifras/);
  });
});

describe('Generador de memorias · documento', () => {
  it('detecta cifras que no están en lo cargado', () => {
    const r = parseCarga(body);
    if (!r.ok) throw new Error();
    const doc = '# Memoria\nAtendimos a 120 familias en 312 sesiones y llegamos a 5.000 personas con 18.000 € de la Junta.';
    expect(cifrasNoRespaldadas(doc, r.carga)).toEqual(['5.000']);
  });

  it('mdToHtml convierte títulos, listas y marca los COMPLETAR', () => {
    const html = mdToHtml('# Título\n\n## Sección\nTexto **fuerte** [COMPLETAR: fecha]\n- uno\n- dos');
    expect(html).toContain('<h1>Título</h1>');
    expect(html).toContain('<h2>Sección</h2>');
    expect(html).toContain('<strong>fuerte</strong>');
    expect(html).toContain('<mark>[COMPLETAR: fecha]</mark>');
    expect(html).toContain('<ul>\n<li>uno</li>\n<li>dos</li>\n</ul>');
  });

  it('generarGuion y generarDocumento usan el LLM inyectado y validan la salida', async () => {
    const r = parseCarga(body);
    if (!r.ok) throw new Error();
    const guion = await generarGuion(r.carga, async () => '{"titulo":"T","mensajes_clave":["m"],"secciones":[],"datos_destacados":["120 familias"],"preguntas":["¿fecha de inicio?"]}');
    expect(guion.preguntas).toEqual(['¿fecha de inicio?']);
    const p = buildDocumentoPrompt(r.carga, guion);
    expect(p.user).toMatch(/SECCIONES \(en este orden\)/);
    await expect(generarDocumento(r.carga, guion, async () => 'corto')).rejects.toThrow('documento_corto');
    const largo = '# T\n' + '## S\n' + 'Atendimos a 120 familias. '.repeat(30);
    const d = await generarDocumento(r.carga, guion, async () => largo);
    expect(d.avisos).toEqual([]);
  });
});
