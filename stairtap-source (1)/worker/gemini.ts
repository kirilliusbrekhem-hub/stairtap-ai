import type { Env } from "./types";
import { clip } from "./util";

const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_FAST = "gemini-2.5-flash";
const DEFAULT_PRO = "gemini-2.5-pro";

export class AIError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

export interface WireStartup {
  name: string; type: string; industry: string; tag: string; problem: string; audience: string; solution: string;
  features: string[]; biz: string[]; why: string; money: string; complexity: "Low" | "Medium" | "High";
}

const STR = { type: "STRING" };
const LIST = { type: "ARRAY", items: { type: "STRING" } };
const STARTUP_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: STR, type: STR, industry: STR, tag: STR, problem: STR, audience: STR, solution: STR,
    features: LIST, biz: LIST, why: STR, money: STR,
    complexity: { type: "STRING", enum: ["Low", "Medium", "High"] },
  },
  required: ["name", "type", "industry", "tag", "problem", "audience", "solution", "features", "biz", "why", "money", "complexity"],
};
const IDEAS_SCHEMA = { type: "OBJECT", properties: { ideas: { type: "ARRAY", items: STARTUP_SCHEMA } }, required: ["ideas"] };

const BASE_PROMPT =
  "You are STAIRTAP, an AI co-founder that turns ideas into startups. Be concrete, realistic and concise. " +
  "Never invent statistics, customer counts or revenue figures. Plain text only, no markdown.";
const FIELD_GUIDE =
  "Fields: name = short brandable name (1-2 words); type = product category (2-3 words); industry = 1-2 words; " +
  "tag = one sentence, at most 18 words; problem = 1-2 sentences; audience = 1 sentence; solution = 1-2 sentences; " +
  "features = exactly 5 short items (at most 8 words each); biz = exactly 3 business model items; " +
  "why = 1-2 sentences on why now; money = 1 sentence on monetization; complexity = Low, Medium or High to build an MVP.";

const langRule = (lang: string) =>
  `Write every text field in the language of the user's input; if that is unclear use ${lang === "ru" ? "Russian" : "English"}. The "complexity" field must stay exactly Low, Medium or High.`;

const list = (v: unknown, n: number, len: number): string[] =>
  Array.isArray(v) ? v.map((x) => clip(x, len)).filter(Boolean).slice(0, n) : [];

export function normalize(raw: unknown): WireStartup | null {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: WireStartup = {
    name: clip(s.name, 60), type: clip(s.type, 60), industry: clip(s.industry, 40), tag: clip(s.tag, 220),
    problem: clip(s.problem, 420), audience: clip(s.audience, 300), solution: clip(s.solution, 480),
    features: list(s.features, 6, 90), biz: list(s.biz, 4, 90), why: clip(s.why, 360), money: clip(s.money, 240),
    complexity: s.complexity === "Low" || s.complexity === "High" ? s.complexity : "Medium",
  };
  if (!out.name || !out.tag || !out.problem || !out.solution || out.features.length < 3 || out.biz.length < 1) return null;
  return out;
}

export function pickModel(env: Env, model: string, allowPro: boolean): string {
  return model === "geminipro" && allowPro ? env.GEMINI_MODEL_PRO || DEFAULT_PRO : env.GEMINI_MODEL_FAST || DEFAULT_FAST;
}

function endpoint(env: Env, model: string): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! };
  let base = env.GEMINI_API_BASE || DEFAULT_BASE;
  if (env.AI_GATEWAY_URL) {
    base = `${env.AI_GATEWAY_URL.replace(/\/+$/, "")}/v1beta`;
    if (env.CF_AIG_TOKEN) headers["cf-aig-authorization"] = `Bearer ${env.CF_AIG_TOKEN}`;
  }
  return { url: `${base}/models/${model}:generateContent`, headers };
}

interface GenOpts { system: string; contents: unknown[]; schema?: unknown; temperature?: number; maxTokens?: number; timeoutMs?: number }

export async function generateRaw(env: Env, model: string, o: GenOpts): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new AIError("no_key", 503);
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: o.system }] },
    contents: o.contents,
    generationConfig: { temperature: o.temperature ?? 0.9, maxOutputTokens: o.maxTokens ?? 4096 },
  };
  const gc = body.generationConfig as Record<string, unknown>;
  if (o.schema) { gc.responseMimeType = "application/json"; gc.responseSchema = o.schema; }
  if (/2\.5-flash/.test(model)) gc.thinkingConfig = { thinkingBudget: 0 };

  const { url, headers } = endpoint(env, model);
  let lastErr: AIError = new AIError("upstream", 502);
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 45000);
    try {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal });
      if (res.ok) {
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
        if (text) return text;
        lastErr = new AIError("empty", 502);
        continue;
      }
      const detail = await res.text().catch(() => "");
      if (res.status === 429) throw new AIError("quota", 429);
      if (/location is not supported|FAILED_PRECONDITION/i.test(detail)) throw new AIError("geo_blocked", 502);
      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
        console.error("gemini rejected", res.status, detail.slice(0, 300));
        throw new AIError("upstream_rejected", 502);
      }
      console.error("gemini upstream", res.status, detail.slice(0, 200));
      lastErr = new AIError("upstream", 502); // 5xx: retry once
    } catch (e) {
      if (e instanceof AIError) throw e;
      lastErr = new AIError("upstream", 502);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

const userMsg = (text: string) => [{ role: "user", parts: [{ text }] }];

function parseStartup(raw: string): WireStartup {
  try {
    const s = normalize(JSON.parse(raw));
    if (s) return s;
  } catch { /* fall through */ }
  throw new AIError("invalid", 502);
}

export async function genStartup(env: Env, model: string, p: { idea: string; variant: number; avoid: string[]; lang: string }): Promise<WireStartup> {
  const angle = p.variant > 0 ? ` Take a clearly different angle from earlier versions${p.avoid.length ? ` (avoid the names: ${p.avoid.join(", ")})` : ""}.` : "";
  const raw = await generateRaw(env, model, {
    system: `${BASE_PROMPT} ${FIELD_GUIDE} ${langRule(p.lang)}`,
    contents: userMsg(`Turn this idea into a startup blueprint.${angle}\n\nIdea:\n${p.idea}`),
    schema: STARTUP_SCHEMA, maxTokens: 4096,
  });
  return parseStartup(raw);
}

export async function genImprove(env: Env, model: string, cur: WireStartup, lang: string): Promise<WireStartup> {
  const raw = await generateRaw(env, model, {
    system: `${BASE_PROMPT} ${FIELD_GUIDE} ${langRule(lang)}`,
    contents: userMsg(`Improve this startup blueprint: sharper positioning, a more specific problem and audience, stronger and more concrete features (you may add one feature, at most 6). Keep the same name and the same language.\n\n${JSON.stringify(cur)}`),
    schema: STARTUP_SCHEMA, maxTokens: 4096, temperature: 0.7,
  });
  const s = parseStartup(raw);
  s.name = cur.name;
  return s;
}

export async function genIdeas(env: Env, model: string, p: { filters: Record<string, unknown>; round: number; lang: string }): Promise<WireStartup[]> {
  const f = p.filters;
  const interests = list(f.interests, 6, 40).join(", ") || "any";
  const raw = await generateRaw(env, model, {
    system: `${BASE_PROMPT} ${FIELD_GUIDE} ${langRule(p.lang)}`,
    contents: userMsg(
      `Propose exactly 3 distinct startup opportunities worth building. Variation seed: ${p.round}.\n` +
      `Industry: ${clip(f.industry, 40)}\nAudience: ${clip(f.audience, 40)}\nBusiness model: ${clip(f.biz, 40)}\n` +
      `Difficulty: ${clip(f.level, 20)}\nMarket type: ${clip(f.market, 20)}\nInterests: ${interests}\n` +
      `Each idea needs a real, specific problem and a concrete "why now".`,
    ),
    schema: IDEAS_SCHEMA, maxTokens: 8192,
  });
  try {
    const ideas = ((JSON.parse(raw) as { ideas?: unknown[] }).ideas ?? []).map(normalize).filter((x): x is WireStartup => !!x).slice(0, 3);
    if (ideas.length) return ideas;
  } catch { /* fall through */ }
  throw new AIError("invalid", 502);
}

export async function genChat(env: Env, model: string, p: { startup: WireStartup; message: string; history: { from?: string; text?: string }[]; lang: string }): Promise<string> {
  const cur = p.startup;
  const history = p.history.slice(-8).map((m) => ({ role: m.from === "me" ? "user" : "model", parts: [{ text: clip(m.text, 800) }] }));
  while (history.length && history[0].role !== "user") history.shift();
  const system =
    `${BASE_PROMPT} You are the co-founder of "${cur.name}" (${cur.tag}). Problem: ${cur.problem} Audience: ${cur.audience} ` +
    `Solution: ${cur.solution} Features: ${cur.features.join("; ")}. Business model: ${cur.biz.join("; ")}. ` +
    `Answer in at most 120 words, practical and specific. Reply in the language of the user's last message.`;
  const text = await generateRaw(env, model, { system, contents: [...history, ...userMsg(p.message)], temperature: 0.8, maxTokens: 2048 });
  return clip(text, 2000);
}
