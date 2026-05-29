// Helpers para llamar a /api/admin/* del HUB desde rutas admin del web.
//
// Requiere env var HUB_ADMIN_SECRET (mismo valor que ADMIN_SECRET del HUB).
// Si no está configurada, las funciones devuelven null y la página renderiza
// vacía con un mensaje claro (en lugar de crashear).

import { HUB_URL } from "@/lib/hub";

function getHubAdminSecret(): string {
  return (
    (import.meta as { env?: Record<string, string> }).env?.HUB_ADMIN_SECRET ??
    process.env.HUB_ADMIN_SECRET ??
    ""
  );
}

export type DiagnosisListItem = {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string | null;
  organizationName: string;
  role: string | null;
  website: string | null;
  audience: string;
  subType: string | null;
  stage: string;
  challenge: string;
  budgetRange: string | null;
  timeframe: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type DiagnosisDetail = DiagnosisListItem & {
  triedBefore: string | null;
  teamSize: string | null;
  source: string | null;
  mission: string | null;
  fundingMix: string | null;
  institutionType: string | null;
  audienceDetail: string | null;
  asePresent: boolean | null;
  briefingMd: string | null;
  briefingAiAt: string | null;
  internalNotes: string | null;
  assignedToId: string | null;
  answers: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
};

async function fetchHub<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T | null> {
  const secret = getHubAdminSecret();
  if (!secret) return null;
  const { timeoutMs = 6000, headers, ...rest } = init;
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${HUB_URL}${path}`, {
      ...rest,
      signal: ctl.signal,
      headers: {
        ...(headers ?? {}),
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

export type DiagnosisListResponse = {
  ok: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: DiagnosisListItem[];
};

export async function listDiagnosis(params: {
  kind?: string;
  audience?: string;
  status?: string;
  q?: string;
  sinceDays?: number;
  page?: number;
  pageSize?: number;
  sort?: string;
}): Promise<DiagnosisListResponse | null> {
  const qs = new URLSearchParams();
  if (params.kind) qs.set("kind", params.kind);
  if (params.audience) qs.set("audience", params.audience);
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  if (params.sinceDays) qs.set("since_days", String(params.sinceDays));
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.sort) qs.set("sort", params.sort);
  return fetchHub<DiagnosisListResponse>(`/api/admin/diagnosis?${qs.toString()}`);
}

export async function getDiagnosis(
  id: string,
): Promise<{ ok: boolean; item: DiagnosisDetail } | null> {
  return fetchHub<{ ok: boolean; item: DiagnosisDetail }>(
    `/api/admin/diagnosis/${encodeURIComponent(id)}`,
  );
}

export async function patchDiagnosis(
  id: string,
  body: { status?: string; internalNotes?: string; assignedToId?: string | null },
): Promise<{ ok: boolean } | null> {
  return fetchHub<{ ok: boolean }>(`/api/admin/diagnosis/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function isHubAdminConfigured(): boolean {
  return getHubAdminSecret().length > 0;
}
