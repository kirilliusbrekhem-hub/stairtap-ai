import type { Env } from "./types";
import { currentUser, forgot, login, logout, mailEnabled, register, reset } from "./auth";
import { ensureSchema } from "./db";
import { aiHandler, bootstrap, changePassword, checkout, createProject, deleteAccount, deleteGeneration, deleteProject, getSite, patchAccount, patchGeneration, portal, projectAnalytics, publish, savePrefs } from "./api";
import { lemonWebhook, nowpaymentsWebhook } from "./billing";
import { servePublicSite, waitlistSignup } from "./site";
import { err, json } from "./util";

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const m = request.method;

  // Published user sites (served sandboxed, see site.ts)
  const site = path.match(/^\/s\/([a-z0-9]{6,32})\/?$/);
  if (site && m === "GET") { await ensureSchema(env); return servePublicSite(env, request, site[1]); }

  if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
  await ensureSchema(env);

  // Webhooks and public endpoints (no session)
  if (path === "/api/billing/webhook/lemon" && m === "POST") return lemonWebhook(env, request);
  if (path === "/api/billing/webhook/nowpayments" && m === "POST") return nowpaymentsWebhook(env, request);
  const wl = path.match(/^\/api\/public\/waitlist\/([a-z0-9]{6,32})$/);
  if (wl) return waitlistSignup(env, request, wl[1]);
  if (path === "/api/health") return json({ ok: true, gemini: !!env.GEMINI_API_KEY });
  if (path === "/api/config" && m === "GET") return json({ mail: mailEnabled(env) });

  // CSRF: state-changing browser requests must come from our own origin
  if (m !== "GET" && m !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return err("forbidden", 403);
  }

  if (path === "/api/auth/register" && m === "POST") return register(env, request);
  if (path === "/api/auth/login" && m === "POST") return login(env, request);
  if (path === "/api/auth/logout" && m === "POST") return logout(env, request);
  if (path === "/api/auth/forgot" && m === "POST") return forgot(env, request);
  if (path === "/api/auth/reset" && m === "POST") return reset(env, request);

  const u = await currentUser(env, request);
  if (!u) return err("unauthorized", 401);

  if (path === "/api/bootstrap" && m === "GET") return bootstrap(env, u);
  if (path === "/api/ai" && m === "POST") return aiHandler(env, request, u);
  if (path === "/api/prefs" && m === "PUT") return savePrefs(env, request, u);
  if (path === "/api/account" && m === "PATCH") return patchAccount(env, request, u);
  if (path === "/api/account/password" && m === "POST") return changePassword(env, request, u);
  if (path === "/api/account/delete" && m === "POST") return deleteAccount(env, request, u);
  if (path === "/api/billing/checkout" && m === "POST") return checkout(env, request, u);
  if (path === "/api/billing/portal" && m === "GET") return portal(u);
  if (path === "/api/projects" && m === "POST") return createProject(env, request, u);

  const pr = path.match(/^\/api\/projects\/([\w-]+)(?:\/(site|publish|analytics))?$/);
  if (pr) {
    if (!pr[2] && m === "DELETE") return deleteProject(env, u, pr[1]);
    if (pr[2] === "site" && m === "GET") return getSite(env, u, pr[1]);
    if (pr[2] === "publish" && m === "POST") return publish(env, request, u, pr[1]);
    if (pr[2] === "analytics" && m === "GET") return projectAnalytics(env, u, pr[1]);
  }
  const g = path.match(/^\/api\/generations\/([\w-]+)$/);
  if (g) {
    if (m === "PATCH") return patchGeneration(env, request, u, g[1]);
    if (m === "DELETE") return deleteGeneration(env, u, g[1]);
  }
  return err("not_found", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const res = await route(request, env);
      if (new URL(request.url).pathname.startsWith("/s/")) return res; // keeps its own CSP
      const out = new Response(res.body, res);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!out.headers.has(k)) out.headers.set(k, v);
      return out;
    } catch (e) {
      console.error("unhandled", e);
      return err("server_error", 500);
    }
  },
} satisfies ExportedHandler<Env>;
