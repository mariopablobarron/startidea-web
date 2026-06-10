/**
 * Custodia segura de certificados de firma.
 *
 * PRINCIPIOS (no negociables):
 *   - Los certificados NUNCA están en el repo, ni en la imagen Docker, ni en
 *     texto plano. Se guardan CIFRADOS (AES-256-GCM) en un volumen del host
 *     montado read-only en el container (CERT_STORE_DIR), con perms 0700 root.
 *   - La clave maestra (CERT_MASTER_KEY) vive SOLO en el entorno de runtime
 *     (secret de Coolify/Docker), nunca en disco ni en el repo.
 *   - El .pfx descifrado vive SOLO en memoria durante la firma; jamás se escribe.
 *   - Aislamiento por entidad: un fichero cifrado por CIF (+ el de Startidea).
 *
 * Formato del fichero cifrado `<name>.pfx.enc`:  iv(12) || authTag(16) || ciphertext
 * (cífralo con scripts/encrypt-cert.mjs, que usa el MISMO esquema.)
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDecipheriv, createHash } from 'node:crypto';

function sanitize(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Carga un certificado desde la custodia y lo devuelve EN MEMORIA.
 * @param {object} o
 * @param {'entidad'|'startidea'} o.kind
 * @param {string} [o.cif]  CIF de la entidad (requerido si kind='entidad')
 * @returns {Promise<{pfx: Buffer, passphrase: string, name: string}>}
 */
export async function loadCert({ kind, cif }) {
  const STORE_DIR = process.env.CERT_STORE_DIR || '/certs';
  const MASTER_KEY = process.env.CERT_MASTER_KEY || '';
  if (!MASTER_KEY) {
    throw new Error('CERT_MASTER_KEY no configurada — sin clave maestra no se descifra ningún certificado.');
  }

  const name = kind === 'startidea' ? 'STARTIDEA' : sanitize(cif);
  if (!name) throw new Error("falta CIF para cargar el certificado de la entidad ('entidad').");

  const file = join(STORE_DIR, `${name}.pfx.enc`);
  let blob;
  try {
    blob = await readFile(file);
  } catch {
    throw new Error(`certificado no encontrado en custodia: ${file} (¿lo cifraste y montaste el volumen CERT_STORE_DIR?).`);
  }
  if (blob.length < 29) throw new Error(`fichero de certificado corrupto: ${file}`);

  // Descifrado AES-256-GCM en memoria
  const key = createHash('sha256').update(MASTER_KEY).digest();
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let pfx;
  try {
    pfx = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('no se pudo descifrar el certificado (¿CERT_MASTER_KEY incorrecta o fichero alterado?).');
  }

  // La passphrase del .pfx va por entidad en env (CERT_PASS_<NAME>), nunca en disco.
  const passphrase = process.env[`CERT_PASS_${name}`] ?? '';

  return { pfx, passphrase, name };
}
