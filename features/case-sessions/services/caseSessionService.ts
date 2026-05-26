import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import type { CaseSession, SessionAttemptRow } from "../models/caseSession";
import type { Attempt } from "@/features/attempts/models/attempt";

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON response");
  }
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  const baseHeaders = await buildAuthHeaders(
    {
      Accept: "application/json",
      ...(init.headers as Record<string, string>),
    },
    token
  );
  return fetch(path, {
    ...init,
    headers: baseHeaders,
  });
}

export type ListSessionsParams = {
  caseId?: string;
  status?: "scheduled" | "active" | "completed" | "all";
  q?: string;
  /** When true, only sessions created by the current user */
  mine?: boolean;
};

export async function listSessions(
  params: ListSessionsParams = {}
): Promise<CaseSession[]> {
  const sp = new URLSearchParams();
  if (params.caseId) sp.set("caseId", params.caseId);
  if (params.status) sp.set("status", params.status);
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.mine) sp.set("mine", "true");
  const q = sp.toString();
  const url = q ? `/api/case-sessions?${q}` : "/api/case-sessions";
  const res = await authFetch(url);
  const body = await parseJson<{ sessions?: CaseSession[]; error?: string }>(
    res
  );
  if (!res.ok) {
    throw new Error(body.error || res.statusText);
  }
  return body.sessions ?? [];
}

export type CreateSessionPayload = {
  caseId: string;
  name: string;
  friendlyName: string;
  description?: string;
  accessCode?: string | null;
  startAt: string;
  endAt: string;
  attemptLimitPerStudent?: number | null;
};

export async function createSession(
  payload: CreateSessionPayload
): Promise<CaseSession> {
  const res = await authFetch("/api/case-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: payload.caseId,
      name: payload.name,
      friendlyName: payload.friendlyName,
      description: payload.description ?? "",
      accessCode: payload.accessCode ?? null,
      startAt: payload.startAt,
      endAt: payload.endAt,
      attemptLimitPerStudent: payload.attemptLimitPerStudent ?? null,
    }),
  });
  const body = await parseJson<{ session?: CaseSession; error?: string }>(res);
  if (!res.ok) {
    throw new Error(body.error || res.statusText);
  }
  if (!body.session) throw new Error("Missing session in response");
  return body.session;
}

export async function getSession(sessionId: string): Promise<CaseSession> {
  const res = await authFetch(`/api/case-sessions/${sessionId}`);
  const body = await parseJson<{ session?: CaseSession; error?: string }>(res);
  if (!res.ok) {
    throw new Error(body.error || res.statusText);
  }
  if (!body.session) throw new Error("Missing session in response");
  return body.session;
}

export async function joinSessionCreateAttempt(
  sessionId: string,
  accessCode?: string
): Promise<Attempt> {
  const res = await authFetch(
    `/api/case-sessions/${encodeURIComponent(sessionId)}/attempts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        accessCode !== undefined ? { accessCode } : {}
      ),
    }
  );
  const body = await parseJson<{ attempt?: Attempt; error?: string }>(res);
  if (!res.ok) {
    throw new Error(body.error || res.statusText);
  }
  if (!body.attempt) throw new Error("Missing attempt in response");
  return body.attempt;
}

export async function getSessionAttempts(
  sessionId: string
): Promise<SessionAttemptRow[]> {
  const res = await authFetch(
    `/api/case-sessions/${encodeURIComponent(sessionId)}/attempts`
  );
  const body = await parseJson<{
    attempts?: SessionAttemptRow[];
    error?: string;
  }>(res);
  if (!res.ok) {
    throw new Error(body.error || res.statusText);
  }
  return body.attempts ?? [];
}

export async function updateSession(
  sessionId: string,
  patch: Partial<{
    name: string;
    friendlyName: string;
    description: string;
    accessCode: string | null;
    startAt: string;
    endAt: string;
    attemptLimitPerStudent: number | null;
  }>
): Promise<CaseSession> {
  const res = await authFetch(
    `/api/case-sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }
  );
  const body = await parseJson<{ session?: CaseSession; error?: string }>(res);
  if (!res.ok) {
    throw new Error(body.error || res.statusText);
  }
  if (!body.session) throw new Error("Missing session in response");
  return body.session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await authFetch(
    `/api/case-sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" }
  );
  const body = await parseJson<{ error?: string }>(res);
  if (!res.ok) {
    throw new Error(body.error || res.statusText);
  }
}
