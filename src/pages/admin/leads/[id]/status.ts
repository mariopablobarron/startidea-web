// POST /admin/leads/[id]/status — Actualiza el status del lead vía HUB PATCH.
//
// Auth: cookie startidea_admin. Sin cookie → 401.
// Body: form-encoded con campo `status` (NEW|REVIEWED|CONTACTED|MEETING|WON|LOST).

import type { APIRoute } from "astro";
import { isAdminLoggedIn } from "@/lib/admin-session";
import { patchDiagnosis } from "@/lib/hub-admin";

export const prerender = false;

const VALID = new Set(["NEW", "REVIEWED", "CONTACTED", "MEETING", "WON", "LOST"]);

export const POST: APIRoute = async ({ cookies, params, request, redirect }) => {
  if (!isAdminLoggedIn(cookies)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const id = params.id;
  if (!id) return new Response("Bad request", { status: 400 });

  const fd = await request.formData();
  const status = String(fd.get("status") ?? "");
  if (!VALID.has(status)) return new Response("Invalid status", { status: 400 });

  const res = await patchDiagnosis(id, { status });
  if (!res?.ok) {
    return new Response("Failed to update", { status: 502 });
  }
  return redirect(`/admin/leads/${id}`);
};
