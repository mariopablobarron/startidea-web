// GET /admin/logout — limpia la cookie de sesión admin y vuelve al home.

import type { APIRoute } from "astro";
import { clearAdminSession } from "@/lib/admin-session";

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect }) => {
  clearAdminSession(cookies);
  return redirect("/?admin=logged-out");
};
