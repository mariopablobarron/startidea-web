// Endpoint migrado a hub.startidea.tech (2026-05-15).
// Los crons del VPS ya apuntan al hub. Esta ruta devuelve 410 Gone
// para detectar si algo viejo aún la golpea.
import type { APIRoute } from "astro";

export const prerender = false;

const handler: APIRoute = () =>
  new Response(
    JSON.stringify({
      ok: false,
      error: "moved",
      newLocation: "https://hub.startidea.tech/api/admin/seo/sync",
      note: "El conector SEO se migró al hub. Actualiza tu cliente.",
    }),
    {
      status: 410,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );

export const GET = handler;
export const POST = handler;
