/**
 * env.ts — Helper único para leer variables de entorno en SSR.
 *
 * En Astro + adapter Node SSR:
 * - `process.env` contiene las vars runtime (las que pasa Docker/Coolify)
 * - `import.meta.env` solo expone vars build-time o PUBLIC_*
 *
 * Si lees solo `import.meta.env.X` en un endpoint SSR, X estará vacío en
 * producción aunque sí esté en el .env del container. Por eso priorizamos
 * process.env y caemos a import.meta.env como fallback (útil para preview
 * local con .env de Astro).
 *
 * Reemplaza los 8 helpers locales duplicados que vivían en cada endpoint.
 *
 * Uso:
 *   import { getEnv } from '@/lib/env';
 *   const TOKEN = getEnv('TELEGRAM_BOT_TOKEN');
 *   if (!TOKEN) { ... }
 */
export function getEnv(key: string): string {
  return process.env[key] ?? (import.meta as any).env?.[key] ?? '';
}
