import type { IdeaFilters, ModelId, Startup, SiteCheck, Credits } from "./types";

export class ApiError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

export interface ChatTurn { from: "ai" | "me"; text: string }

export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown; timeout?: number } = {}): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeout ?? 60000);
  try {
    const res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: opts.body === undefined ? undefined : { "content-type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: "same-origin",
      signal: ctl.signal,
    });
    const text = await res.text();
    let data: unknown = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON error page */ }
    if (!res.ok) throw new ApiError((data as { error?: string }).error ?? (res.status >= 500 ? "server_error" : "bad_request"), res.status);
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("network", 0);
  } finally {
    clearTimeout(timer);
  }
}

interface WithCredits { credits: Credits }

export const ai = {
  startup: (p: { idea: string; model: ModelId; variant: number; avoidNames: string[]; lang: string }) =>
    api<{ startup: Startup } & WithCredits>("/ai", { body: { action: "startup", ...p }, timeout: 90000 }),
  improve: (p: { startupId: string; model: ModelId; lang: string }) =>
    api<{ startup: Startup } & WithCredits>("/ai", { body: { action: "improve", ...p }, timeout: 90000 }),
  ideas: (p: { filters: IdeaFilters; model: ModelId; round: number; lang: string }) =>
    api<{ ideas: Startup[] } & WithCredits>("/ai", { body: { action: "ideas", ...p }, timeout: 90000 }),
  chat: (p: { startupId: string; message: string; history: ChatTurn[]; model: ModelId; lang: string }) =>
    api<{ reply: string }>("/ai", { body: { action: "chat", ...p } }),
  site: (p: { projectId: string; model: ModelId; lang: string; instruction?: string }) =>
    api<{ html: string; checks: SiteCheck[] } & WithCredits>("/ai", { body: { action: "site", ...p }, timeout: 170000 }),
};
