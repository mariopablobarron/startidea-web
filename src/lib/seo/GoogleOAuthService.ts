/**
 * GoogleOAuthService — flujo OAuth 2.0 (Authorization Code) con Google.
 *
 * Scopes:
 *   - https://www.googleapis.com/auth/analytics.readonly
 *   - https://www.googleapis.com/auth/webmasters.readonly
 *
 * Flujo:
 *   1. authUrl()        → URL a la que redirige /admin/google/connect
 *   2. exchange(code)   → intercambia code por refresh+access token
 *   3. getOAuthClient() → construye OAuth2Client autenticado para llamadas API
 *   4. revoke(email)    → revoca tokens en Google y borra fila local
 *
 * Tokens almacenados cifrados con AES-256-GCM en `google_connections`.
 * Refresh automático: el OAuth2Client de googleapis lo gestiona internamente
 * cuando access_token expira; persistimos cada nuevo access_token.
 */

import { google } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import { getDb } from './db';
import { encrypt, decrypt } from './crypto';

export const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'openid',
  'email',
];

function clientId() {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error('GOOGLE_CLIENT_ID no está definida');
  return v;
}
function clientSecret() {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error('GOOGLE_CLIENT_SECRET no está definida');
  return v;
}
function redirectUri() {
  const v = process.env.GOOGLE_REDIRECT_URI;
  if (!v) throw new Error('GOOGLE_REDIRECT_URI no está definida');
  return v;
}

function newClient(): OAuth2Client {
  return new google.auth.OAuth2(clientId(), clientSecret(), redirectUri());
}

/** URL a la que redirigir al admin para iniciar OAuth. */
export function authUrl(state?: string): string {
  const client = newClient();
  return client.generateAuthUrl({
    access_type: 'offline',     // imprescindible para recibir refresh_token
    prompt: 'consent',          // fuerza siempre devolver refresh_token
    scope: SCOPES,
    include_granted_scopes: true,
    state,
  });
}

/**
 * Intercambia el authorization code recibido en /callback por tokens y
 * persiste la conexión cifrada. Devuelve el email de la cuenta conectada.
 */
export async function exchange(code: string): Promise<{ email: string; connectionId: number }> {
  const client = newClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error('Google no devolvió refresh_token. Revoca el acceso desde https://myaccount.google.com/permissions y reintenta.');
  }

  client.setCredentials(tokens);

  // Identificamos al usuario via id_token o /userinfo
  const email = await fetchUserEmail(client, tokens);

  const db = getDb();
  const refreshEnc = encrypt(tokens.refresh_token);
  const accessEnc = tokens.access_token ? encrypt(tokens.access_token) : null;
  const accessExp = tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null;

  // upsert por email
  const existing = db
    .prepare('SELECT id FROM google_connections WHERE google_account_email = ?')
    .get(email) as { id: number } | undefined;

  let connectionId: number;
  if (existing) {
    db.prepare(
      `UPDATE google_connections
       SET refresh_token_encrypted = ?, access_token_encrypted = ?, access_token_expires_at = ?,
           scopes = ?, updated_at = strftime('%s','now'), revoked_at = NULL
       WHERE id = ?`,
    ).run(refreshEnc, accessEnc, accessExp, SCOPES.join(' '), existing.id);
    connectionId = existing.id;
  } else {
    const r = db.prepare(
      `INSERT INTO google_connections
       (google_account_email, refresh_token_encrypted, access_token_encrypted, access_token_expires_at, scopes)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(email, refreshEnc, accessEnc, accessExp, SCOPES.join(' '));
    connectionId = Number(r.lastInsertRowid);
  }

  return { email, connectionId };
}

async function fetchUserEmail(client: OAuth2Client, tokens: Credentials): Promise<string> {
  // Si vino id_token podemos parsear sin llamada extra
  if (tokens.id_token) {
    try {
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId() });
      const email = ticket.getPayload()?.email;
      if (email) return email;
    } catch {
      // continuamos con userinfo
    }
  }
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const me = await oauth2.userinfo.get();
  if (!me.data.email) throw new Error('No se pudo obtener email del usuario Google');
  return me.data.email;
}

export type ConnectionRow = {
  id: number;
  google_account_email: string;
  refresh_token_encrypted: string;
  access_token_encrypted: string | null;
  access_token_expires_at: number | null;
  scopes: string;
  created_at: number;
  updated_at: number;
  revoked_at: number | null;
};

export function listActiveConnections(): ConnectionRow[] {
  return getDb()
    .prepare('SELECT * FROM google_connections WHERE revoked_at IS NULL ORDER BY id ASC')
    .all() as ConnectionRow[];
}

export function getConnection(id: number): ConnectionRow | null {
  const r = getDb().prepare('SELECT * FROM google_connections WHERE id = ?').get(id);
  return (r as ConnectionRow) || null;
}

/**
 * Construye un OAuth2Client autenticado a partir de la fila de DB.
 * Persiste automáticamente cualquier access_token nuevo (refresh implícito).
 */
export function getOAuthClient(connection: ConnectionRow): OAuth2Client {
  const client = newClient();
  const credentials: Credentials = {
    refresh_token: decrypt(connection.refresh_token_encrypted),
  };
  if (connection.access_token_encrypted) {
    credentials.access_token = decrypt(connection.access_token_encrypted);
  }
  if (connection.access_token_expires_at) {
    credentials.expiry_date = connection.access_token_expires_at * 1000;
  }
  client.setCredentials(credentials);

  // Persistir refresh automático
  client.on('tokens', (tokens) => {
    try {
      const db = getDb();
      const updates: string[] = [];
      const args: any[] = [];
      if (tokens.access_token) {
        updates.push('access_token_encrypted = ?');
        args.push(encrypt(tokens.access_token));
      }
      if (tokens.expiry_date) {
        updates.push('access_token_expires_at = ?');
        args.push(Math.floor(tokens.expiry_date / 1000));
      }
      if (tokens.refresh_token) {
        updates.push('refresh_token_encrypted = ?');
        args.push(encrypt(tokens.refresh_token));
      }
      if (updates.length === 0) return;
      updates.push("updated_at = strftime('%s','now')");
      args.push(connection.id);
      db.prepare(`UPDATE google_connections SET ${updates.join(', ')} WHERE id = ?`).run(...args);
    } catch (err) {
      console.error('[GoogleOAuth] persist refresh failed', (err as Error).message);
    }
  });
  return client;
}

/**
 * Revoca el refresh_token en Google y marca la conexión como revocada.
 * No borra histórico de métricas — solo desactiva acceso futuro.
 */
export async function revoke(connectionId: number): Promise<void> {
  const conn = getConnection(connectionId);
  if (!conn) return;
  try {
    const client = getOAuthClient(conn);
    const rt = decrypt(conn.refresh_token_encrypted);
    await client.revokeToken(rt);
  } catch (err) {
    // Si el token ya estaba revocado, ignoramos
    console.warn('[GoogleOAuth] revoke remote falló (ignorado):', (err as Error).message);
  }
  getDb().prepare(
    `UPDATE google_connections
     SET revoked_at = strftime('%s','now'), refresh_token_encrypted = '', access_token_encrypted = NULL
     WHERE id = ?`,
  ).run(connectionId);
}
