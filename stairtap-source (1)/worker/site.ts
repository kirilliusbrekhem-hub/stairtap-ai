import type { Env } from "./types";
import { AIError, type WireStartup, generateRaw } from "./gemini";
import { day7, type UserRow } from "./db";
import { clip, err, json, newId, readJson } from "./util";

export const MAX_SITE_BYTES = 180_000;

const SITE_PROMPT =
  "You are a senior product designer and front-end engineer. Output ONE complete, self-contained HTML5 document for a startup landing page that works as a real product front page. " +
  "Rules: start with <!doctype html>; <html lang> set; <meta name=viewport>; <title>; <meta name=description>; exactly one <h1>. " +
  "All CSS in one <style> block, all JS in one inline <script> (no external scripts, no frameworks, no CDN JS; Google Fonts <link> is allowed). " +
  "Responsive from 360px wide, accessible (semantic landmarks, alt text, visible focus, sufficient contrast), tasteful and distinctive, not a generic template. " +
  "Sections: hero with a clear promise and one primary call to action, how it works (3 steps), features (from the blueprint), who it is for, pricing or business model hint if relevant, FAQ (4 items), footer. " +
  "Include exactly one waitlist form: <form data-waitlist> containing an <input type=\"email\" name=\"email\" required aria-label=...> and a submit <button>, plus an element <p data-waitlist-msg role=\"status\"></p>. Do NOT write the submit JavaScript for it; the platform wires it. " +
  "Never invent statistics, testimonials, customer logos or press mentions. Write all visible copy in the requested language. " +
  "Output only the HTML, no markdown fences, no commentary.";

function extractHtml(raw: string): string {
  let t = raw.trim();
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const i = t.search(/<!doctype html>/i);
  if (i > 0) t = t.slice(i);
  return t;
}

export async function genSite(env: Env, model: string, p: { startup: WireStartup; lang: string; instruction: string; current: string }): Promise<string> {
  const lang = p.lang === "ru" ? "Russian" : "English";
  const bp = JSON.stringify(p.startup);
  const task = p.current && p.instruction
    ? `Modify this existing page according to the instruction. Keep everything that works. Language: ${lang}.\n\nInstruction: ${p.instruction}\n\nBlueprint: ${bp}\n\nCurrent HTML:\n${p.current.slice(0, 120_000)}`
    : `Build the landing page. Language: ${lang}.${p.instruction ? `\nExtra direction: ${p.instruction}` : ""}\n\nStartup blueprint (JSON): ${bp}`;
  const raw = await generateRaw(env, model, { system: SITE_PROMPT, contents: [{ role: "user", parts: [{ text: task }] }], temperature: 0.8, maxTokens: 24000, timeoutMs: 100_000 });
  const html = extractHtml(raw);
  if (!/<!doctype html>/i.test(html) || !/<\/html>\s*$/i.test(html) || !/<form[^>]*data-waitlist/i.test(html)) throw new AIError("invalid", 502);
  if (html.length > MAX_SITE_BYTES) throw new AIError("invalid", 502);
  return html;
}

export interface Check { id: string; ok: boolean }

/** Deterministic quality checks on the generated page. */
export function runChecks(html: string): Check[] {
  const has = (re: RegExp) => re.test(html);
  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  return [
    { id: "title", ok: has(/<title>[^<]{3,}<\/title>/i) },
    { id: "lang", ok: has(/<html[^>]*\blang=/i) },
    { id: "viewport", ok: has(/<meta[^>]*name=["']viewport["']/i) },
    { id: "description", ok: has(/<meta[^>]*name=["']description["'][^>]*content=["'][^"']{20,}/i) },
    { id: "h1", ok: h1s === 1 },
    { id: "form", ok: has(/<form[^>]*data-waitlist[\s\S]*type=["']email["']/i) },
    { id: "no_external_js", ok: !has(/<script[^>]+src=/i) },
    { id: "alt", ok: imgs.every((i) => /\balt=/i.test(i)) },
    { id: "landmarks", ok: has(/<main[\s>]/i) && has(/<footer[\s>]/i) },
    { id: "size", ok: html.length <= 120_000 },
  ];
}

/** Script injected at serve time to wire up the waitlist form. */
function wireScript(endpoint: string | null, msgs: { ok: string; bad: string; wait: string }): string {
  return `<script>(function(){var f=document.querySelector('form[data-waitlist]');if(!f)return;var m=document.querySelector('[data-waitlist-msg]');
function say(t){if(m)m.textContent=t}
f.addEventListener('submit',function(e){e.preventDefault();var em=(f.querySelector('input[type=email]')||{}).value||'';var ep=${JSON.stringify(endpoint)};
if(!ep){say(${JSON.stringify(msgs.wait)});return}
var b=f.querySelector('button');if(b)b.disabled=true;
fetch(ep,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:em})}).then(function(r){return r.json()}).then(function(j){say(j&&j.ok?${JSON.stringify(msgs.ok)}:${JSON.stringify(msgs.bad)});if(j&&j.ok)f.reset()}).catch(function(){say(${JSON.stringify(msgs.bad)})}).then(function(){if(b)b.disabled=false})})})();</script>`;
}

export function withWiring(html: string, endpoint: string | null, lang: string): string {
  const msgs = lang === "ru"
    ? { ok: "Готово! Мы сообщим о запуске.", bad: "Не получилось. Проверьте email и повторите.", wait: "Предпросмотр: форма заработает после публикации." }
    : { ok: "Done! We will let you know at launch.", bad: "Something went wrong. Check the email and retry.", wait: "Preview: the form works once the site is published." };
  const tag = wireScript(endpoint, msgs);
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${tag}</body>`) : html + tag;
}

export const SITE_CSP = (origin: string) =>
  `sandbox allow-scripts allow-forms; default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: https:; script-src 'unsafe-inline'; connect-src ${origin}; form-action 'none'; base-uri 'none'`;

/** Public page: GET /s/:publicId */
export async function servePublicSite(env: Env, request: Request, publicId: string): Promise<Response> {
  const row = await env.DB.prepare("SELECT project_id, html FROM sites WHERE public_id = ? AND published = 1").bind(publicId).first<{ project_id: string; html: string }>();
  if (!row) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const origin = new URL(request.url).origin;
  const lang = /<html[^>]*\blang=["']?ru/i.test(row.html) ? "ru" : "en";
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.batch([
    env.DB.prepare("UPDATE sites SET views = views + 1 WHERE project_id = ?").bind(row.project_id),
    env.DB.prepare("INSERT INTO site_views (project_id, day, n) VALUES (?, ?, 1) ON CONFLICT(project_id, day) DO UPDATE SET n = n + 1").bind(row.project_id, day),
  ]);
  return new Response(withWiring(row.html, `${origin}/api/public/waitlist/${publicId}`, lang), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": SITE_CSP(origin),
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": "no-store",
    },
  });
}

const CORS_OPEN = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" };
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

/** Public waitlist signup for a published site. */
export async function waitlistSignup(env: Env, request: Request, publicId: string): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_OPEN });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, CORS_OPEN);
  const site = await env.DB.prepare("SELECT project_id FROM sites WHERE public_id = ? AND published = 1").bind(publicId).first<{ project_id: string }>();
  if (!site) return json({ error: "not_found" }, 404, CORS_OPEN);
  const ip = request.headers.get("cf-connecting-ip") || "anon";
  const key = `wl:${publicId}:${ip}`;
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM attempts WHERE key = ? AND ts > ?").bind(key, Date.now() - 600000).first<{ c: number }>();
  if ((r?.c ?? 0) >= 10) return json({ error: "rate_limited" }, 429, CORS_OPEN);
  await env.DB.prepare("INSERT INTO attempts (key, ts) VALUES (?, ?)").bind(key, Date.now()).run();
  const p = await readJson<{ email?: string }>(request, 1000);
  const email = String(p?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "bad_email" }, 400, CORS_OPEN);
  await env.DB.prepare("INSERT OR IGNORE INTO signups (project_id, email, ts) VALUES (?, ?, ?)").bind(site.project_id, email, Date.now()).run();
  return json({ ok: true }, 200, CORS_OPEN);
}

export async function ensureSiteRow(env: Env, userId: string, projectId: string): Promise<{ public_id: string }> {
  const row = await env.DB.prepare("SELECT public_id FROM sites WHERE project_id = ?").bind(projectId).first<{ public_id: string }>();
  if (row) return row;
  const public_id = newId("w").slice(2);
  await env.DB.prepare("INSERT INTO sites (project_id, user_id, html, published, public_id, updated_at) VALUES (?, ?, '', 0, ?, ?)").bind(projectId, userId, public_id, Date.now()).run();
  return { public_id };
}

export async function analytics(env: Env, projectId: string) {
  const site = await env.DB.prepare("SELECT views, published, public_id FROM sites WHERE project_id = ?").bind(projectId).first<{ views: number; published: number; public_id: string }>();
  const days = day7();
  const rows = await env.DB.prepare("SELECT day, n FROM site_views WHERE project_id = ? AND day >= ?").bind(projectId, days[0]).all<{ day: string; n: number }>();
  const map = new Map(rows.results.map((r) => [r.day, r.n]));
  const sc = await env.DB.prepare("SELECT COUNT(*) AS c FROM signups WHERE project_id = ?").bind(projectId).first<{ c: number }>();
  const recent = await env.DB.prepare("SELECT email, ts FROM signups WHERE project_id = ? ORDER BY ts DESC LIMIT 200").bind(projectId).all<{ email: string; ts: number }>();
  return {
    views: site?.views ?? 0,
    signups: sc?.c ?? 0,
    days: days.map((d) => ({ day: d, n: map.get(d) ?? 0 })),
    recent: recent.results,
  };
}
export { clip, err };
export type { UserRow };
