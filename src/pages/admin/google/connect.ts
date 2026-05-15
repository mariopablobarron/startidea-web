// OAuth Google migrado a hub.startidea.tech (2026-05-15).
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(null, {
    status: 301,
    headers: {
      location: "https://hub.startidea.tech/api/admin/google/connect",
      "cache-control": "no-store",
    },
  });
