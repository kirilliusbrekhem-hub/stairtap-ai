import type { Env } from "./types";
import { CHAT_DAILY, PLAN_LIMITS, type PlanId } from "../lib/plans";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
    pw_hash TEXT NOT NULL, pw_salt TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free', plan_until INTEGER NOT NULL DEFAULT 0,
    bonus INTEGER NOT NULL DEFAULT 0, portal_url TEXT NOT NULL DEFAULT '',
    prefs TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS startups (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_startups_user ON startups(user_id)`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, sid TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Building',
    progress INTEGER NOT NULL DEFAULT 12, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE(user_id, sid))`,
  `CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL,
    project TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', sid TEXT, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_gens_user ON generations(user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS usage (
    user_id TEXT NOT NULL, period TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, period, kind))`,
  `CREATE TABLE IF NOT EXISTS payments (
    provider TEXT NOT NULL, ref TEXT NOT NULL, user_id TEXT NOT NULL, product TEXT NOT NULL,
    created_at INTEGER NOT NULL, PRIMARY KEY (provider, ref))`,
  `CREATE TABLE IF NOT EXISTS sites (
    project_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, html TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 0, public_id TEXT NOT NULL UNIQUE, views INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS site_views (project_id TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (project_id, day))`,
  `CREATE TABLE IF NOT EXISTS signups (project_id TEXT NOT NULL, email TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (project_id, email))`,
  `CREATE TABLE IF NOT EXISTS resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS attempts (key TEXT NOT NULL, ts INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_attempts ON attempts(key, ts)`,
];

let ready: Promise<void> | null = null;

/** Create tables on first request (no manual migration step). Safe to run repeatedly. */
export function ensureSchema(env: Env): Promise<void> {
  if (!ready) {
    ready = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).then(() => undefined);
    ready.catch(() => { ready = null; });
  }
  return ready;
}

export interface UserRow {
  id: string; email: string; name: string; pw_hash: string; pw_salt: string;
  plan: string; plan_until: number; bonus: number; portal_url: string; prefs: string; created_at: number;
}

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

/** The plan the user is entitled to right now. */
export function effectivePlan(u: Pick<UserRow, "plan" | "plan_until">, now = Date.now()): PlanId {
  return (u.plan === "pro" || u.plan === "ultra") && u.plan_until > now ? u.plan : "free";
}

export interface Credits { plan: PlanId; limit: number; used: Record<string, number>; usedTotal: number; bonus: number; left: number; chatLeft: number }

const GEN_KINDS = ["startups", "ideas", "designs", "copy"] as const;

export async function getCredits(env: Env, u: UserRow): Promise<Credits> {
  const plan = effectivePlan(u);
  const rows = await env.DB.prepare("SELECT kind, n FROM usage WHERE user_id = ? AND (period = ? OR (period = ? AND kind = 'chat'))")
    .bind(u.id, monthKey(), dayKey()).all<{ kind: string; n: number }>();
  const used: Record<string, number> = { startups: 0, ideas: 0, designs: 0, copy: 0 };
  let chat = 0;
  for (const r of rows.results) {
    if (r.kind === "chat") chat = r.n;
    else if (r.kind in used) used[r.kind] = r.n;
  }
  const usedTotal = GEN_KINDS.reduce((a, k) => a + used[k], 0);
  const limit = PLAN_LIMITS[plan];
  return { plan, limit, used, usedTotal, bonus: u.bonus, left: Math.max(0, limit - usedTotal) + u.bonus, chatLeft: Math.max(0, CHAT_DAILY[plan] - chat) };
}

/**
 * Take one generation. Monthly allowance first, then purchased bonus.
 * Returns where it came from (for refunds) or null if the user is out.
 */
export async function spendCredit(env: Env, u: UserRow, kind: (typeof GEN_KINDS)[number]): Promise<"month" | "bonus" | null> {
  const c = await getCredits(env, u);
  if (c.left <= 0) return null;
  if (c.usedTotal < c.limit) {
    await env.DB.prepare("INSERT INTO usage (user_id, period, kind, n) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, period, kind) DO UPDATE SET n = n + 1")
      .bind(u.id, monthKey(), kind).run();
    return "month";
  }
  const r = await env.DB.prepare("UPDATE users SET bonus = bonus - 1 WHERE id = ? AND bonus > 0").bind(u.id).run();
  return r.meta.changes > 0 ? "bonus" : null;
}

export async function refundCredit(env: Env, u: UserRow, kind: string, from: "month" | "bonus"): Promise<void> {
  if (from === "month") {
    await env.DB.prepare("UPDATE usage SET n = MAX(0, n - 1) WHERE user_id = ? AND period = ? AND kind = ?").bind(u.id, monthKey(), kind).run();
  } else {
    await env.DB.prepare("UPDATE users SET bonus = bonus + 1 WHERE id = ?").bind(u.id).run();
  }
}

/** Count a chat message for today. Returns false when the daily limit is reached. */
export async function spendChat(env: Env, u: UserRow): Promise<boolean> {
  const c = await getCredits(env, u);
  if (c.chatLeft <= 0) return false;
  await env.DB.prepare("INSERT INTO usage (user_id, period, kind, n) VALUES (?, ?, 'chat', 1) ON CONFLICT(user_id, period, kind) DO UPDATE SET n = n + 1")
    .bind(u.id, dayKey()).run();
  return true;
}

/** Last 7 days as YYYY-MM-DD, oldest first. */
export function day7(): string[] {
  return Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10));
}
