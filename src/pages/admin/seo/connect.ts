// /admin/seo/connect — alias legacy. La gestión de cuentas Google vive en el hub.
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(null, {
    status: 301,
    headers: {
      location: "https://hub.startidea.tech/startidea/admin/seo/connect",
      "cache-control": "no-store",
    },
  });
