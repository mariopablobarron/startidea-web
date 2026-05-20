// POST /admin/leads/[id]/notes — Actualiza internalNotes del lead vía HUB PATCH.

import type { APIRoute } from "astro";
import { isAdminLoggedIn } from "@/lib/admin-session";
import { patchDiagnosis } from "@/lib/hub-admin";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, params, request, redirect }) => {
  if (!isAdminLoggedIn(cookies)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const id = params.id;
  if (!id) return new Response("Bad request", { status: 400 });

  const fd = await request.formData();
  const internalNotes = String(fd.get("internalNotes") ?? "").slice(0, 4000);
  const res = await patchDiagnosis(id, { internalNotes });
  if (!res?.ok) {
    return new Response("Failed to update notes", { status: 502 });
  }
  return redirect(`/admin/leads/${id}`);
};
