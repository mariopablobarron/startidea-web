// OAuth disconnect migrado a hub.startidea.tech (2026-05-15).
import type { APIRoute } from "astro";

export const prerender = false;

const handler: APIRoute = () =>
  new Response(null, {
    status: 301,
    headers: {
      location: "https://hub.startidea.tech/startidea/admin/seo/connect",
      "cache-control": "no-store",
    },
  });

export const GET = handler;
export const POST = handler;
