// GET /api/admin/bar-data — KPIs ligeros para la AdminBar
//
// Devuelve JSON con métricas que se muestran en la barra superior:
//   - subsidies_total: convocatorias abiertas en BDNS (cache 15 min en HUB)
//   - matches_new: matches detectados en los últimos 7 días para workspace startidea
//   - leads_today: leads del diagnóstico que cayeron hoy
//   - visits_today: visitas hoy (cuando se reactive sync de seo.db)
//
// Auth: cookie de admin. Sin cookie válida → 401.
// Las llamadas al HUB usan ADMIN_TOKEN del container, nunca expuesto al cliente.

import type { APIRoute } from "astro";
import { isAdminLoggedIn } from "@/lib/admin-session";
import { listDiagnosis, isHubAdminConfigured } from "@/lib/hub-admin";
import { HUB_URL } from "@/lib/hub";
import { getExpedientesRecibidosSinProcesar, statsContratos } from "@/lib/expedientes-db";
import { getAllSolicitudes } from "@/lib/impulsa-db";

interface Notif { icon: string; text: string; href: string; ts: number }

// Construye las notificaciones accionables desde las BDs locales (rápido).
function buildNotifications(): Notif[] {
  const out: Notif[] = [];
  try {
    for (const e of getExpedientesRecibidosSinProcesar().slice(0, 12)) {
      out.push({ icon: "📋", text: `Expediente sin procesar · ${e.org_nombre}`, href: `/admin/expedientes/${e.id}`, ts: (e.created_at ?? 0) * 1000 });
    }
  } catch { /* sin tabla */ }
  try {
    const imp = getAllSolicitudes().filter((s) => s.estado === "recibida").slice(0, 12);
    for (const s of imp) {
      out.push({ icon: "🚀", text: `Solicitud Impulsa · ${s.org_nombre}`, href: "/admin/impulsa?estado=recibida", ts: s.created_at });
    }
  } catch { /* sin solicitudes */ }
  try {
    const c = statsContratos();
    if (c.sinEnviar > 0) {
      out.push({ icon: "📄", text: `${c.sinEnviar} contrato${c.sinEnviar !== 1 ? "s" : ""} sin enviar`, href: "/admin/expedientes", ts: Date.now() });
    }
  } catch { /* sin contratos */ }
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

export const prerender = false;

async function fetchWithTimeout<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T | null> {
  const { timeoutMs = 3000, ...rest } = init;
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...rest, signal: ctl.signal });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminLoggedIn(cookies)) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Subvenciones públicas: ligero, no requiere auth
  const statsPublic = await fetchWithTimeout<{
    ok: boolean;
    total: number;
  }>(`${HUB_URL}/api/public/subsidies/stats`);

  // Leads: solo si HUB_ADMIN_SECRET está configurado
  let leadsLast7 = null;
  let leadsNew = null;
  if (isHubAdminConfigured()) {
    const [last7, neueva] = await Promise.all([
      listDiagnosis({ sinceDays: 7, pageSize: 1 }),
      listDiagnosis({ status: "NEW", pageSize: 1 }),
    ]);
    leadsLast7 = last7?.total ?? null;
    leadsNew = neueva?.total ?? null;
  }

  const notifications = buildNotifications();

  return new Response(
    JSON.stringify({
      ok: true,
      subsidies_total: statsPublic?.total ?? null,
      leads_7d: leadsLast7,
      leads_new: leadsNew,
      notif_count: notifications.length,
      notifications,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    },
  );
};
