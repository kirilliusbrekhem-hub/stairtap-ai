import type { Env } from "./types";
import { AIError, genChat, genIdeas, genImprove, genStartup, normalize, pickModel, type WireStartup } from "./gemini";
import { analytics, ensureSiteRow, genSite, runChecks } from "./site";
import { effectivePlan, getCredits, refundCredit, spendChat, spendCredit, type UserRow } from "./db";
import { changePassword, deleteAccount } from "./auth";
import { checkout, methods } from "./billing";
import { clip, err, json, newId, readJson } from "./util";
import { PROJECT_LIMITS } from "../lib/plans";

type Lang = "ru" | "en";
const lang = (v: unknown): Lang => (v === "ru" ? "ru" : "en");

interface StartupFull extends WireStartup { id: string; slug: string; complexityLevel: 1 | 2 | 3 }

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "startup";
}
function full(id: string, w: WireStartup): StartupFull {
  return { ...w, id, slug: slugify(w.name), complexityLevel: w.complexity === "Low" ? 1 : w.complexity === "High" ? 3 : 2 };
}

async function saveStartup(env: Env, userId: string, w: WireStartup, id?: string): Promise<StartupFull> {
  const sid = id ?? newId("s");
  const s = full(sid, w);
  await env.DB.prepare("INSERT INTO startups (id, user_id, data, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data WHERE user_id = excluded.user_id")
    .bind(sid, userId, JSON.stringify(s), Date.now()).run();
  return s;
}

async function getStartupRow(env: Env, userId: string, sid: string): Promise<StartupFull | null> {
  const r = await env.DB.prepare("SELECT data FROM startups WHERE id = ? AND user_id = ?").bind(sid, userId).first<{ data: string }>();
  return r ? (JSON.parse(r.data) as StartupFull) : null;
}

async function addGen(env: Env, userId: string, g: { type: string; title: string; project?: string; model: string; sid?: string }) {
  await env.DB.prepare("INSERT INTO generations (id, user_id, type, title, project, model, sid, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(newId("g"), userId, g.type, clip(g.title, 160), clip(g.project ?? "", 80), g.model, g.sid ?? null, Date.now()).run();
}

function aiFail(e: unknown): Response {
  if (e instanceof AIError) {
    const status = e.code === "quota" ? 429 : e.code === "no_key" ? 503 : 502;
    return err(e.code, status);
  }
  console.error("ai failure", e);
  return err("upstream", 502);
}

const MODEL_LABEL = (m: string) => (m === "geminipro" ? "Gemini Pro" : "Gemini");

/* ---------------- bootstrap ---------------- */

export async function bootstrap(env: Env, u: UserRow): Promise<Response> {
  const [credits, startups, projects, gens] = await Promise.all([
    getCredits(env, u),
    env.DB.prepare("SELECT data FROM startups WHERE user_id = ? ORDER BY created_at DESC LIMIT 300").bind(u.id).all<{ data: string }>(),
    env.DB.prepare("SELECT p.id, p.sid, p.status, p.progress, p.created_at, p.updated_at, s.published, s.public_id FROM projects p LEFT JOIN sites s ON s.project_id = p.id WHERE p.user_id = ? ORDER BY p.updated_at DESC").bind(u.id).all(),
    env.DB.prepare("SELECT id, type, title, project, model, sid, created_at FROM generations WHERE user_id = ? ORDER BY created_at DESC LIMIT 200").bind(u.id).all(),
  ]);
  let prefs: unknown = null;
  try { prefs = u.prefs ? JSON.parse(u.prefs) : null; } catch { /* ignore */ }
  return json({
    user: { id: u.id, email: u.email, name: u.name },
    credits: { ...credits, planUntil: effectivePlan(u) === "free" ? 0 : u.plan_until, hasPortal: !!u.portal_url },
    startups: Object.fromEntries(startups.results.map((r) => { const s = JSON.parse(r.data) as StartupFull; return [s.id, s]; })),
    projects: projects.results,
    gens: gens.results,
    prefs,
    payments: methods(env),
  });
}

/* ---------------- AI ---------------- */

export async function aiHandler(env: Env, request: Request, u: UserRow): Promise<Response> {
  const p = await readJson<Record<string, unknown>>(request, 24000);
  if (!p) return err("bad_request");
  const action = String(p.action ?? "");
  const l = lang(p.lang);
  const plan = effectivePlan(u);
  const modelId = String(p.model ?? "auto");
  if (modelId === "geminipro" && plan === "free") return err("pro_required", 402);
  const model = pickModel(env, modelId, plan !== "free");
  const label = MODEL_LABEL(modelId);

  if (action === "chat") {
    const s = await getStartupRow(env, u.id, String(p.startupId ?? ""));
    const message = clip(p.message, 600).trim();
    if (!s || !message) return err("bad_request");
    if (!(await spendChat(env, u))) return err("chat_limit", 429);
    try {
      const reply = await genChat(env, model, { startup: s, message, history: Array.isArray(p.history) ? (p.history as { from?: string; text?: string }[]) : [], lang: l });
      return json({ reply });
    } catch (e) { return aiFail(e); }
  }

  // Generation actions spend one credit up front and refund on failure.
  const kind = action === "ideas" ? "ideas" : action === "site" ? "designs" : "startups";
  if (!["startup", "improve", "ideas", "site"].includes(action)) return err("unknown_action");

  // validate inputs before charging
  let idea = "", s0: StartupFull | null = null, projectId = "";
  if (action === "startup") {
    idea = clip(p.idea, 1500).trim();
    if (!idea) return err("empty_idea");
  } else if (action === "improve") {
    s0 = await getStartupRow(env, u.id, String(p.startupId ?? ""));
    if (!s0) return err("bad_startup", 404);
  } else if (action === "site") {
    projectId = String(p.projectId ?? "");
    const pr = await env.DB.prepare("SELECT sid FROM projects WHERE id = ? AND user_id = ?").bind(projectId, u.id).first<{ sid: string }>();
    if (!pr) return err("bad_project", 404);
    s0 = await getStartupRow(env, u.id, pr.sid);
    if (!s0) return err("bad_startup", 404);
  }

  const from = await spendCredit(env, u, kind);
  if (!from) return err("no_credits", 402);

  try {
    if (action === "startup") {
      const w = await genStartup(env, model, { idea, variant: Number(p.variant) || 0, avoid: Array.isArray(p.avoidNames) ? (p.avoidNames as unknown[]).map((x) => clip(x, 60)).slice(0, 5) : [], lang: l });
      const s = await saveStartup(env, u.id, w);
      await addGen(env, u.id, { type: "startups", title: `${s.name} — ${l === "ru" ? "бизнес-план" : "startup blueprint"}`, project: s.name, model: label, sid: s.id });
      return json({ startup: s, credits: await getCredits(env, u) });
    }
    if (action === "improve") {
      const w = await genImprove(env, model, s0!, l);
      const s = await saveStartup(env, u.id, w, s0!.id);
      await addGen(env, u.id, { type: "startups", title: `${s.name} — ${l === "ru" ? "улучшено" : "improved"}`, project: s.name, model: label, sid: s.id });
      return json({ startup: s, credits: await getCredits(env, u) });
    }
    if (action === "ideas") {
      const ws = await genIdeas(env, model, { filters: (p.filters && typeof p.filters === "object" ? p.filters : {}) as Record<string, unknown>, round: Number(p.round) || 0, lang: l });
      const ideas = await Promise.all(ws.map((w) => saveStartup(env, u.id, w)));
      await addGen(env, u.id, { type: "ideas", title: `${l === "ru" ? "Идеи" : "Ideas"}: ${clip((p.filters as { industry?: string } | undefined)?.industry, 40) || "any"}`, project: "", model: label });
      return json({ ideas, credits: await getCredits(env, u) });
    }
    // site
    const cur = await env.DB.prepare("SELECT html FROM sites WHERE project_id = ?").bind(projectId).first<{ html: string }>();
    const instruction = clip(p.instruction, 400).trim();
    const html = await genSite(env, model, { startup: s0!, lang: l, instruction, current: cur?.html ?? "" });
    await ensureSiteRow(env, u.id, projectId);
    await env.DB.batch([
      env.DB.prepare("UPDATE sites SET html = ?, updated_at = ? WHERE project_id = ?").bind(html, Date.now(), projectId),
      env.DB.prepare("UPDATE projects SET status = CASE WHEN status = 'Live' THEN 'Live' ELSE 'Building' END, progress = CASE WHEN status = 'Live' THEN 100 ELSE 60 END, updated_at = ? WHERE id = ?").bind(Date.now(), projectId),
    ]);
    await addGen(env, u.id, { type: "designs", title: `${s0!.name} — ${l === "ru" ? "сайт" : "website"}`, project: s0!.name, model: label, sid: s0!.id });
    return json({ html, checks: runChecks(html), credits: await getCredits(env, u) });
  } catch (e) {
    await refundCredit(env, u, kind, from);
    return aiFail(e);
  }
}

/* ---------------- projects ---------------- */

export async function createProject(env: Env, request: Request, u: UserRow): Promise<Response> {
  const p = await readJson<{ sid?: string }>(request, 500);
  const sid = String(p?.sid ?? "");
  if (!(await getStartupRow(env, u.id, sid))) return err("bad_startup", 404);
  const existing = await env.DB.prepare("SELECT id FROM projects WHERE user_id = ? AND sid = ?").bind(u.id, sid).first<{ id: string }>();
  if (existing) return json({ id: existing.id, created: false });
  const cnt = await env.DB.prepare("SELECT COUNT(*) AS c FROM projects WHERE user_id = ?").bind(u.id).first<{ c: number }>();
  if ((cnt?.c ?? 0) >= PROJECT_LIMITS[effectivePlan(u)]) return err("project_limit", 402);
  const id = newId("p");
  const now = Date.now();
  await env.DB.prepare("INSERT INTO projects (id, user_id, sid, status, progress, created_at, updated_at) VALUES (?, ?, ?, 'Draft', 15, ?, ?)").bind(id, u.id, sid, now, now).run();
  return json({ id, created: true });
}

async function ownProject(env: Env, u: UserRow, id: string) {
  return env.DB.prepare("SELECT id, sid FROM projects WHERE id = ? AND user_id = ?").bind(id, u.id).first<{ id: string; sid: string }>();
}

export async function deleteProject(env: Env, u: UserRow, id: string): Promise<Response> {
  if (!(await ownProject(env, u, id))) return err("not_found", 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM signups WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM site_views WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM sites WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}

export async function getSite(env: Env, u: UserRow, id: string): Promise<Response> {
  if (!(await ownProject(env, u, id))) return err("not_found", 404);
  const s = await env.DB.prepare("SELECT html, published, public_id FROM sites WHERE project_id = ?").bind(id).first<{ html: string; published: number; public_id: string }>();
  if (!s || !s.html) return json({ html: "", published: false, publicId: "", checks: [] });
  return json({ html: s.html, published: !!s.published, publicId: s.public_id, checks: runChecks(s.html) });
}

export async function publish(env: Env, request: Request, u: UserRow, id: string): Promise<Response> {
  if (!(await ownProject(env, u, id))) return err("not_found", 404);
  const p = await readJson<{ publish?: boolean }>(request, 200);
  const on = p?.publish !== false;
  const s = await env.DB.prepare("SELECT html FROM sites WHERE project_id = ?").bind(id).first<{ html: string }>();
  if (!s?.html) return err("no_site", 409);
  if (on && runChecks(s.html).some((c) => c.id === "form" && !c.ok)) return err("checks_failed", 409);
  await env.DB.batch([
    env.DB.prepare("UPDATE sites SET published = ? WHERE project_id = ?").bind(on ? 1 : 0, id),
    env.DB.prepare("UPDATE projects SET status = ?, progress = ?, updated_at = ? WHERE id = ?").bind(on ? "Live" : "Building", on ? 100 : 60, Date.now(), id),
  ]);
  return json({ ok: true, published: on });
}

export async function projectAnalytics(env: Env, u: UserRow, id: string): Promise<Response> {
  if (!(await ownProject(env, u, id))) return err("not_found", 404);
  return json(await analytics(env, id));
}

/* ---------------- generations / prefs / account ---------------- */

export async function patchGeneration(env: Env, request: Request, u: UserRow, id: string): Promise<Response> {
  const p = await readJson<{ title?: string }>(request, 500);
  const title = clip(p?.title, 160).trim();
  if (!title) return err("bad_request");
  await env.DB.prepare("UPDATE generations SET title = ? WHERE id = ? AND user_id = ?").bind(title, id, u.id).run();
  return json({ ok: true });
}
export async function deleteGeneration(env: Env, u: UserRow, id: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM generations WHERE id = ? AND user_id = ?").bind(id, u.id).run();
  return json({ ok: true });
}

export async function savePrefs(env: Env, request: Request, u: UserRow): Promise<Response> {
  const p = await readJson<Record<string, unknown>>(request, 4000);
  if (!p) return err("bad_request");
  await env.DB.prepare("UPDATE users SET prefs = ? WHERE id = ?").bind(JSON.stringify(p), u.id).run();
  return json({ ok: true });
}

export async function patchAccount(env: Env, request: Request, u: UserRow): Promise<Response> {
  const p = await readJson<{ name?: string }>(request, 500);
  const name = clip(p?.name, 60).trim();
  if (!name) return err("bad_request");
  await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, u.id).run();
  return json({ ok: true });
}

export async function portal(u: UserRow): Promise<Response> {
  return u.portal_url ? json({ url: u.portal_url }) : err("no_subscription", 404);
}

export { changePassword, deleteAccount, checkout };
export { normalize };
