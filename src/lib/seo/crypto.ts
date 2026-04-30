/**
 * Cifrado AES-GCM para `refresh_token` y `access_token`.
 *
 * - Clave: APP_ENCRYPTION_KEY (32 bytes en base64). Generar con:
 *     openssl rand -base64 32
 * - Algoritmo: AES-256-GCM (authenticated encryption).
 * - Formato output: base64(iv || tag || ciphertext)
 *
 * Si la clave cambia, los tokens existentes pasan a ser ilegibles → forzar
 * desconexión y reconexión OAuth manual.
 */

import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const k = process.env.APP_ENCRYPTION_KEY;
  if (!k) {
    throw new Error('APP_ENCRYPTION_KEY no está definida — genera con `openssl rand -base64 32`');
  }
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY debe ser 32 bytes (base64). Usa `openssl rand -base64 32`');
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decrypt(payload: string): string {
  const key = getKey();
  const data = Buffer.from(payload, 'base64');
  if (data.length < IV_LEN + TAG_LEN) {
    throw new Error('payload cifrado inválido');
  }
  const iv = data.subarray(0, IV_LEN);
  const tag = data.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = data.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
