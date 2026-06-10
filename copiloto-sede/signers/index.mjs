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
 * cifrado en reposo) y NUNCA el .pfx en texto plano. El certificado se carga
 * cifrado vía lib/cert-store.mjs; la firma real (AutoFirma batch / @firma /
 * PKCS#11) es el único TODO restante.
 */
import { loadCert } from '../lib/cert-store.mjs';

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
  // 1) Carga el certificado de la entidad desde la custodia segura (en memoria).
  const cert = await loadCert({ kind: 'entidad', cif: job.cif ?? job.certRef?.cif });
  // 2) TODO(real): firmar la solicitud (XAdES/PAdES) con `cert.pfx` + `cert.passphrase`
  //    vía AutoFirma batch / @firma / PKCS#11, y completar la presentación.
  return notImplemented('entidad', cert);
}

// ── Opción 2: certificado de STARTIDEA como apoderado ────────────────────────
async function signApoderado(job) {
  // 0) TODO(real): verificar que existe APODERAMIENTO inscrito en REA/Cl@ve para
  //    esta entidad + procedimiento ANTES de firmar (si no, abortar).
  // 1) Carga el certificado de Startidea desde la custodia segura.
  const cert = await loadCert({ kind: 'startidea' });
  // 2) TODO(real): firmar con `cert.pfx` como representante apoderado.
  return notImplemented('apoderado', cert);
}

function notImplemented(mode, cert) {
  // El certificado SÍ se cargó de custodia (cert.name); falta solo la firma real.
  throw new Error(`signer '${mode}': certificado '${cert.name}' cargado de custodia OK; falta integrar la firma real (XAdES/PAdES con AutoFirma batch / @firma / PKCS#11).`);
}
