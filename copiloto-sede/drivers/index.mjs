/**
 * Registro de drivers por sede electrónica.
 *
 * Cada sede tiene su portal distinto → un driver bespoke. La detección de QUÉ
 * sede corresponde a cada expediente ya la hace el main (src/lib/sedes-map.ts);
 * aquí solo despachamos al driver correcto por su clave.
 */
import { tramitarJuntaAndalucia } from './junta-andalucia.mjs';

/**
 * Driver MOCK — no toca ninguna sede ni Playwright. Devuelve un handoff
 * realista para probar la cadena completa (admin → endpoint → container)
 * end-to-end antes de que el driver real esté listo.
 */
async function tramitarMock(job) {
  return {
    status: 'handoff_firma',
    message: 'MOCK: trámite preparado (simulado). La cadena de tramitación funciona end-to-end.',
    sedeUrl: 'https://ejemplo.sede/mock',
    prefill: {
      razonSocial: job.formData?.org_nombre ?? '',
      nif: job.formData?.org_cif ?? '',
      objeto: job.formData?.descripcion_proyecto ?? '',
    },
    checklist: (job.files ?? []).map((f) => ({ doc: f.name, adjunto: true })),
    siguientePaso: 'MOCK — el cliente firmaría aquí con su certificado.',
  };
}

// clave de sede → función driver. Añadir sedes nuevas aquí.
const DRIVERS = {
  'junta-andalucia': tramitarJuntaAndalucia,
  'mock': tramitarMock, // para smoke-tests de la cadena sin sede real
  // 'bdns':            tramitarBDNS,            // TODO V2
  // 'diputacion-granada': tramitarDipGranada,   // TODO V2
};

export function listSedes() {
  return Object.keys(DRIVERS);
}

export async function runDriver(job) {
  const driver = DRIVERS[job.sede];
  if (!driver) {
    return { ok: false, error: `sin driver para sede '${job.sede}'`, sedesDisponibles: listSedes() };
  }
  const t0 = Date.now();
  try {
    const out = await driver(job);
    return { ok: true, sede: job.sede, expedienteId: job.expedienteId, ms: Date.now() - t0, ...out };
  } catch (err) {
    return { ok: false, sede: job.sede, expedienteId: job.expedienteId, ms: Date.now() - t0, error: String(err?.message || err) };
  }
}
