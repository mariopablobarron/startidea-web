#!/usr/bin/env node
/**
 * Cifra un certificado .pfx/.p12 para la custodia (AES-256-GCM), con el MISMO
 * esquema que lib/cert-store.mjs espera. Ejecútalo EN LOCAL; el .pfx en claro
 * nunca debe subir al repo ni al VPS.
 *
 * Uso:
 *   CERT_MASTER_KEY="<clave-maestra>" node scripts/encrypt-cert.mjs entidad.pfx G12345678.pfx.enc
 *   CERT_MASTER_KEY="<clave-maestra>" node scripts/encrypt-cert.mjs startidea.pfx STARTIDEA.pfx.enc
 *
 * Luego sube SOLO el .pfx.enc al volumen del host (CERT_STORE_DIR) con perms
 * 0700 root, y define CERT_MASTER_KEY + CERT_PASS_<NAME> en el entorno del container.
 *
 * Formato de salida:  iv(12) || authTag(16) || ciphertext
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

const [, , inPath, outPath] = process.argv;
const MASTER_KEY = process.env.CERT_MASTER_KEY || '';

if (!inPath || !outPath) {
  console.error('Uso: CERT_MASTER_KEY=... node scripts/encrypt-cert.mjs <entrada.pfx> <salida.pfx.enc>');
  process.exit(1);
}
if (!MASTER_KEY) {
  console.error('Falta CERT_MASTER_KEY en el entorno.');
  process.exit(1);
}

const plain = readFileSync(inPath);
const key = createHash('sha256').update(MASTER_KEY).digest();
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
const tag = cipher.getAuthTag();

writeFileSync(outPath, Buffer.concat([iv, tag, ct]));
console.log(`OK → ${outPath} (${(ct.length / 1024).toFixed(1)} KB cifrados). Sube SOLO este fichero al volumen de certs.`);
