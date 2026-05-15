// OAuth callback migrado a hub.startidea.tech (2026-05-15).
// Si Google redirige aquí, reenviamos al callback nuevo conservando los
// params (?code=…&state=…) para no perder el authorization code.
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const incoming = new URL(request.url);
  const target = new URL(
    "https://hub.startidea.tech/api/admin/google/callback",
  );
  incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  return new Response(null, {
    status: 302,
    headers: { location: target.toString(), "cache-control": "no-store" },
  });
};
