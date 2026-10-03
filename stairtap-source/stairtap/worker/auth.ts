import type { Env } from "./types";
import { ensureSchema, type UserRow } from "./db";
import { enc, err, hex, json, newId, randomToken, readJson, safeEqual, sha256 } from "./util";

const SESSION_DAYS = 30;
const COOKIE = "st_session";
const PBKDF2_ITER = 100000; // Workers cap

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}

function cookieHeader(request: Request, token: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function readCookie(request: Request): string {
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : "";
}

export async function currentUser(env: Env, request: Request): Promise<UserRow | null> {
  const token = readCookie(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
  ).bind(await sha256(token), Date.now()).first<UserRow>();
  return row ?? null;
}

async function startSession(env: Env, request: Request, userId: string, body: unknown): Promise<Response> {
  const token = randomToken(32);
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), userId, Date.now() + SESSION_DAYS * 86400000).run();
  // opportunistic cleanup
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()).run();
  return json(body, 200, { "set-cookie": cookieHeader(request, token, SESSION_DAYS * 86400) });
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

async function tooManyAttempts(env: Env, key: string): Promise<boolean> {
  const since = Date.now() - 15 * 60000;
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM attempts WHERE key = ? AND ts > ?").bind(key, since).first<{ c: number }>();
  return (r?.c ?? 0) >= 8;
}
const noteAttempt = (env: Env, key: string) => env.DB.prepare("INSERT INTO attempts (key, ts) VALUES (?, ?)").bind(key, Date.now()).run();

export async function register(env: Env, request: Request): Promise<Response> {
  await ensureSchema(env);
  const p = await readJson<{ email?: string; password?: string; name?: string }>(request, 2000);
  if (!p) return err("bad_request");
  const email = String(p.email ?? "").trim().toLowerCase();
  const password = String(p.password ?? "");
  const name = String(p.name ?? "").trim().slice(0, 60);
  if (!EMAIL_RE.test(email)) return err("bad_email");
  if (password.length < 8 || password.length > 200) return err("weak_password");

  const ip = request.headers.get("cf-connecting-ip") || "anon";
  if (await tooManyAttempts(env, `reg:${ip}`)) return err("rate_limited", 429);
  await noteAttempt(env, `reg:${ip}`);

  const exists = await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first();
  if (exists) return err("email_taken", 409);

  const id = newId("u");
  const salt = randomToken(16);
  const hash = await hashPassword(password, salt);
  await env.DB.prepare("INSERT INTO users (id, email, name, pw_hash, pw_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, email, name || email.split("@")[0], hash, salt, Date.now()).run();
  return startSession(env, request, id, { ok: true });
}

export async function login(env: Env, request: Request): Promise<Response> {
  await ensureSchema(env);
  const p = await readJson<{ email?: string; password?: string }>(request, 2000);
  if (!p) return err("bad_request");
  const email = String(p.email ?? "").trim().toLowerCase();
  const password = String(p.password ?? "");
  const ip = request.headers.get("cf-connecting-ip") || "anon";
  const key = `login:${email}:${ip}`;
  if (await tooManyAttempts(env, key)) return err("rate_limited", 429);

  const u = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
  // hash even when the user is missing so timing does not reveal accounts
  const hash = await hashPassword(password, u?.pw_salt ?? "00".repeat(16));
  if (!u || !safeEqual(hash, u.pw_hash)) {
    await noteAttempt(env, key);
    return err("bad_credentials", 401);
  }
  return startSession(env, request, u.id, { ok: true });
}

export async function logout(env: Env, request: Request): Promise<Response> {
  const token = readCookie(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "set-cookie": cookieHeader(request, "", 0) });
}

export async function changePassword(env: Env, request: Request, u: UserRow): Promise<Response> {
  const p = await readJson<{ current?: string; next?: string }>(request, 2000);
  if (!p) return err("bad_request");
  const next = String(p.next ?? "");
  if (next.length < 8 || next.length > 200) return err("weak_password");
  const cur = await hashPassword(String(p.current ?? ""), u.pw_salt);
  if (!safeEqual(cur, u.pw_hash)) return err("bad_credentials", 401);
  const salt = randomToken(16);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET pw_hash = ?, pw_salt = ? WHERE id = ?").bind(await hashPassword(next, salt), salt, u.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id),
  ]);
  return startSession(env, request, u.id, { ok: true });
}

export async function deleteAccount(env: Env, request: Request, u: UserRow): Promise<Response> {
  const p = await readJson<{ password?: string }>(request, 1000);
  const h = await hashPassword(String(p?.password ?? ""), u.pw_salt);
  if (!safeEqual(h, u.pw_hash)) return err("bad_credentials", 401);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM startups WHERE user_id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM projects WHERE user_id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM generations WHERE user_id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM usage WHERE user_id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(u.id),
  ]);
  return json({ ok: true }, 200, { "set-cookie": cookieHeader(request, "", 0) });
}

/* ---------------- password reset by email (optional, needs Resend) ---------------- */

export const mailEnabled = (env: Env) => !!(env.RESEND_API_KEY && env.MAIL_FROM);

export async function forgot(env: Env, request: Request): Promise<Response> {
  if (!mailEnabled(env)) return err("mail_not_configured", 503);
  const p = await readJson<{ email?: string; lang?: string }>(request, 500);
  const email = String(p?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return err("bad_email");
  const ip = request.headers.get("cf-connecting-ip") || "anon";
  if (await tooManyAttempts(env, `forgot:${email}`) || await tooManyAttempts(env, `forgot-ip:${ip}`)) return json({ ok: true }); // silent
  await noteAttempt(env, `forgot:${email}`);
  await noteAttempt(env, `forgot-ip:${ip}`);

  const u = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  if (u) {
    const token = randomToken(32);
    await env.DB.prepare("INSERT INTO resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await sha256(token), u.id, Date.now() + 3600000).run();
    const base = (env.PUBLIC_URL || new URL(request.url).origin).replace(/\/+$/, "");
    const link = `${base}/reset/?token=${token}`;
    const ru = p?.lang === "ru";
    const res = await fetch(`${env.RESEND_API_BASE || "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM, to: [email],
        subject: ru ? "Сброс пароля STAIRTAP" : "Reset your STAIRTAP password",
        text: ru
          ? `Чтобы задать новый пароль, откройте ссылку (действует 1 час):\n${link}\n\nЕсли вы не запрашивали сброс, просто проигнорируйте письмо.`
          : `Open this link to set a new password (valid for 1 hour):\n${link}\n\nIf you did not request this, ignore this email.`,
      }),
    });
    if (!res.ok) console.error("resend failed", res.status, (await res.text()).slice(0, 200));
  }
  return json({ ok: true }); // same answer whether or not the account exists
}

export async function reset(env: Env, request: Request): Promise<Response> {
  const p = await readJson<{ token?: string; password?: string }>(request, 1000);
  const token = String(p?.token ?? "");
  const password = String(p?.password ?? "");
  if (!/^[a-f0-9]{64}$/.test(token)) return err("bad_token");
  if (password.length < 8 || password.length > 200) return err("weak_password");
  const ip = request.headers.get("cf-connecting-ip") || "anon";
  if (await tooManyAttempts(env, `reset:${ip}`)) return err("rate_limited", 429);
  const th = await sha256(token);
  const row = await env.DB.prepare("SELECT user_id FROM resets WHERE token_hash = ? AND expires_at > ?").bind(th, Date.now()).first<{ user_id: string }>();
  if (!row) { await noteAttempt(env, `reset:${ip}`); return err("bad_token", 400); }
  const salt = randomToken(16);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET pw_hash = ?, pw_salt = ? WHERE id = ?").bind(await hashPassword(password, salt), salt, row.user_id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.user_id),
    env.DB.prepare("DELETE FROM resets WHERE user_id = ?").bind(row.user_id),
  ]);
  return json({ ok: true });
}
