// Endpoint migrado a hub.startidea.tech (2026-05-15).
import type { APIRoute } from "astro";

export const prerender = false;

const handler: APIRoute = () =>
  new Response(
    JSON.stringify({
      ok: false,
      error: "moved",
      newLocation: "https://hub.startidea.tech/api/admin/seo/agent-analyst",
    }),
    {
      status: 410,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    },
  );

export const GET = handler;
export const POST = handler;
