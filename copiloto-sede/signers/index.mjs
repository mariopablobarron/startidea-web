/**
 * Firmantes — el módulo que pone la firma electrónica en la presentación.
 *
 * DOS OPCIONES (elegibles por expediente según `signMode`):
 *
 *   'entidad'   → se firma con el CERTIFICADO DE LA PROPIA ENTIDAD cliente
 *                 (Certificado de Representante de Persona Jurídica de la ONG/
 *                 fundación). La entidad lo aporta/autoriza para ese trámite.
 *
 *   'apoderado' → firma STARTIDEA como representante, con SU certificado, en
 *                 virtud de un apoderamiento inscrito en el REA/Cl@ve para esa
 *                 entidad y ese procedimiento.
 *
 *   'mock'      → firma simulada, para probar el flujo autónomo sin certificado.
 *
 * ⚠️ Los dos modos reales requieren CUSTODIA SEGURA del certificado (HSM o
 * cifrado en reposo) y NUNCA el .pfx en texto plano. Aquí solo está el esqueleto
 * pluggable; la firma real (AutoFirma batch / @firma / PKCS#11) es TODO.
 */

/**
 * @param {object} job
 * @param {'entidad'|'apoderado'|'mock'} job.signMode
 * @param {string} job.expedienteId
 * @param {Buffer|string} [job.document]  documento/solicitud a firmar
 * @param {object} [job.certRef]          referencia al certificado (NO el .pfx):
 *        { kind:'entidad'|'startidea', alias?, hsmSlot?, vaultPath? }
 * @returns {Promise<{signed:boolean, csv?:string, registro?:string, detail:string}>}
 */
export async function sign(job) {
  const mode = job.signMode || 'mock';
  const signer = SIGNERS[mode];
  if (!signer) throw new Error(`signMode desconocido: ${mode}`);
  return signer(job);
}

const SIGNERS = {
  mock: signMock,
  entidad: signEntidad,
  apoderado: signApoderado,
};

export function listSigners() {
  return Object.keys(SIGNERS);
}

// ── Mock: simula firma + presentación para probar la cadena autónoma ──────────
async function signMock(job) {
  return {
    signed: true,
    csv: `MOCK-CSV-${job.expedienteId}`,
    registro: `MOCK-RE-${Date.now().toString().slice(-6)}`,
    detail: 'MOCK: firma y presentación simuladas (sin certificado real).',
  };
}

// ── Opción 1: certificado de la ENTIDAD cliente ──────────────────────────────
async function signEntidad(job) {
  // TODO(real): cargar el certificado de representante de la entidad desde
  // custodia segura (HSM/vault) usando job.certRef, firmar la solicitud
  // (XAdES/PAdES vía @firma o AutoFirma batch) y completar la presentación.
  // Requiere: la entidad ha aportado/autorizado su certificado para este trámite.
  throw new Error("signer 'entidad' no implementado: requiere certificado de la entidad en custodia segura + integración de firma real.");
}

// ── Opción 2: certificado de STARTIDEA como apoderado ────────────────────────
async function signApoderado(job) {
  // TODO(real): firmar con el certificado de Startidea (HSM/vault), válido solo
  // si existe APODERAMIENTO inscrito en el REA/Cl@ve para esta entidad y este
  // procedimiento. Verificar el apoderamiento antes de firmar.
  throw new Error("signer 'apoderado' no implementado: requiere certificado de Startidea + apoderamiento REA registrado para la entidad.");
}
