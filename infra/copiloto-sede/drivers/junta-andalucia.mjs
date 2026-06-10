// Driver Junta de Andalucía (key: 'junta-andalucia').
//
// MVP Fase 2a: parte de la URL de la sede de la Junta y reutiliza la captura
// genérica (acceso + búsqueda del trámite). Los selectores específicos del
// buscador de trámites de la Junta se afinan en vivo en una iteración posterior
// (el HTML de la sede no es estable y conviene ajustarlo contra el sitio real).
//
// Recordatorio de alcance: NO autofirma, NO presenta. La firma con certificado
// y la presentación las hace siempre la persona usuaria.

import { capturarGuia as generic } from './generic.mjs';

// Catálogo de Procedimientos y Servicios de la Junta: es el punto de entrada
// real para localizar un trámite/convocatoria (verificado 2026-06-09; la URL
// antigua .../haciendayadministracionpublica/sede/ devolvía 404).
const URL_SEDE_JUNTA =
  'https://www.juntadeandalucia.es/servicios/procedimientos.html';

export async function capturarGuia(page, opts) {
  const sedeUrl = opts.sedeUrl || URL_SEDE_JUNTA;
  return generic(page, { ...opts, sedeUrl });
}
