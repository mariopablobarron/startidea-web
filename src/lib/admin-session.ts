// Helpers de sesión admin para startidea.es
//
// Usa cookie HTTP-only con el SHA-256 del ADMIN_TOKEN como valor. La cookie
// nunca contiene el token plano; sniffearla equivale a sniffear el hash,
// que es lo único que el servidor compara. ADMIN_TOKEN sigue siendo el
// secret de alta entropía (43 chars base64) configurado en el .env del
// container (NUNCA en el repo).
//
// Pensado para 1 usuario admin (Mario). Si en el futuro hace falta
// multi-user, migrar a HUB auth real (NextAuth) con sesiones server-side.

import { createHash } from "node:crypto";
import type { AstroCookies } from "astro";

const COOKIE_NAME = "startidea_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getAdminToken(): string {
  // En Astro SSR los env vars del container están en process.env;
  // import.meta.env funciona en build-time y en algunos casos runtime.
  return (
    (import.meta as { env?: Record<string, string> }).env?.ADMIN_TOKEN ??
    process.env.ADMIN_TOKEN ??
    ""
  );
}

export function isAdminLoggedIn(cookies: AstroCookies): boolean {
  const sessionCookie = cookies.get(COOKIE_NAME)?.value;
  if (!sessionCookie) return false;
  const token = getAdminToken();
  if (!token) return false;
  const expected = tokenHash(token);
  // Comparación de tiempo constante (best-effort sin timingSafeEqual:
  // ambos hashes tienen longitud fija 64 hex chars)
  if (sessionCookie.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sessionCookie.length; i++) {
    diff |= sessionCookie.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function setAdminSession(cookies: AstroCookies, token: string): boolean {
  const expected = getAdminToken();
  if (!expected || token !== expected) return false;
  cookies.set(COOKIE_NAME, tokenHash(token), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return true;
}

export function clearAdminSession(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, { path: "/" });
}
