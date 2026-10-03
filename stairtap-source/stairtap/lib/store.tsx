"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ai, api, ApiError } from "./api";
import { useI18n } from "./i18n";
import { MODELS } from "./data";
import type { ProductId } from "./plans";
import type { Credits, Generation, ModelId, Prefs, Project, Startup, User } from "./types";

type Status = "loading" | "anon" | "authed";
type BuildState = "idle" | "pending" | "ready" | "error";

interface Bootstrap {
  user: User;
  credits: Credits;
  startups: Record<string, Startup>;
  projects: Project[];
  gens: Generation[];
  prefs: Partial<Prefs> | null;
  payments: { card: boolean; crypto: boolean };
}

interface State {
  status: Status;
  user: User | null;
  credits: Credits | null;
  payments: { card: boolean; crypto: boolean };
  idea: string;
  model: ModelId;
  projects: Project[];
  gens: Generation[];
  startups: Record<string, Startup>;
  prefs: Prefs;
  toast: string;
  upgrade: string;
  creditsOpen: boolean;
  pay: ProductId | "";
  buildId: string;
  buildState: BuildState;
  buildVariant: number;
  buildError: string;
  ver: number;
  improving: boolean;
}

const DEFAULT_PREFS: Prefs = { reduceMotion: false, showCredits: true, model: "auto" };

const initial: State = {
  status: "loading", user: null, credits: null, payments: { card: false, crypto: false },
  idea: "", model: "auto", projects: [], gens: [], startups: {}, prefs: DEFAULT_PREFS,
  toast: "", upgrade: "", creditsOpen: false, pay: "",
  buildId: "", buildState: "idle", buildVariant: 0, buildError: "", ver: 1, improving: false,
};

interface Store extends State {
  modelName: string;
  left: number;
  limit: number;
  isPro: boolean;
  setIdea: (v: string) => void;
  setModel: (m: ModelId) => void;
  say: (msg: string) => void;
  openUpgrade: (feature: string) => void;
  closeUpgrade: () => void;
  setCreditsOpen: (v: boolean) => void;
  openPay: (p: ProductId) => void;
  closePay: () => void;
  refresh: () => Promise<boolean>;
  setCredits: (c: Credits) => void;
  /** Human message for an API error; also opens the upgrade modal when the plan is the cause. */
  fail: (e: unknown) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  getStartup: (id: string) => Startup | undefined;
  addStartups: (list: Startup[]) => void;
  startBuild: (opts?: { startup?: Startup; variant?: number }) => boolean;
  cancelBuild: () => void;
  improve: () => void;
  ensureProject: (sid: string) => Promise<string | null>;
  deleteProject: (id: string) => Promise<void>;
  renameGeneration: (id: string, title: string) => Promise<void>;
  deleteGeneration: (id: string) => Promise<void>;
  setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
  renameUser: (name: string) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [s, setS] = useState<State>(initial);
  const ref = useRef(s);
  ref.current = s;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patch = useCallback((p: Partial<State>) => setS((prev) => ({ ...prev, ...p })), []);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", s.prefs.reduceMotion);
  }, [s.prefs.reduceMotion]);

  const say = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    patch({ toast: msg });
    toastTimer.current = setTimeout(() => patch({ toast: "" }), 4200);
  }, [patch]);

  const applyBootstrap = useCallback((b: Bootstrap) => {
    const prefs: Prefs = { ...DEFAULT_PREFS, ...(b.prefs ?? {}) };
    setS((prev) => ({
      ...prev, status: "authed", user: b.user, credits: b.credits, payments: b.payments,
      startups: { ...prev.startups, ...b.startups }, projects: b.projects, gens: b.gens, prefs,
      model: prev.status === "authed" ? prev.model : prefs.model,
    }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyBootstrap(await api<Bootstrap>("/bootstrap"));
      return true;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 0 || e.status >= 500)) {
        setS((prev) => ({ ...prev, status: e.status === 401 ? "anon" : prev.status === "authed" ? "authed" : "anon" }));
      }
      return false;
    }
  }, [applyBootstrap]);

  useEffect(() => { void refresh(); }, [refresh]);

  const errorText = useCallback((e: unknown): string => {
    const code = e instanceof ApiError ? e.code : "network";
    const map: Record<string, string> = {
      no_credits: "You are out of generations. Upgrade or buy more.",
      pro_required: "Gemini Pro is available on paid plans.",
      project_limit: "Project limit reached for your plan.",
      chat_limit: "Daily message limit reached. Try again tomorrow or upgrade.",
      quota: "The AI is busy right now. Try again in a minute.",
      geo_blocked: "The AI service is not available from the server's region. Contact support.",
      no_key: "AI is not configured yet. Contact support.",
      upstream_rejected: "The AI service rejected the request. Contact support.",
      upstream: "The AI service did not answer. Nothing was charged. Try again.",
      invalid: "The AI returned an unusable answer. Nothing was charged. Try again.",
      empty: "The AI returned an empty answer. Nothing was charged. Try again.",
      network: "No connection to the server. Check your internet and retry.",
      rate_limited: "Too many attempts. Wait a few minutes.",
      server_error: "Server error. Try again in a moment.",
    };
    return t(map[code] ?? "Something went wrong. Try again.");
  }, [t]);

  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 401) { setS((prev) => ({ ...prev, status: "anon", user: null })); router.push("/login"); return; }
      if (e.code === "no_credits" || e.code === "pro_required" || e.code === "project_limit") patch({ upgrade: e.code === "no_credits" ? t("More generations") : e.code === "pro_required" ? "Gemini Pro" : t("More projects") });
    }
    say(errorText(e));
  }, [errorText, patch, router, say, t]);

  const setCredits = useCallback((c: Credits) => setS((prev) => ({ ...prev, credits: c })), []);

  const login = useCallback(async (email: string, password: string) => {
    await api("/auth/login", { body: { email, password } });
    await refresh();
  }, [refresh]);
  const register = useCallback(async (email: string, password: string, name: string) => {
    await api("/auth/register", { body: { email, password, name } });
    await refresh();
  }, [refresh]);
  const logout = useCallback(async () => {
    try { await api("/auth/logout", { body: {} }); } catch { /* ignore */ }
    buildToken.current++;
    setS({ ...initial, status: "anon" });
    router.push("/");
  }, [router]);

  const buildToken = useRef(0);

  const startBuild = useCallback((opts?: { startup?: Startup; variant?: number }) => {
    const cur = ref.current;
    if (cur.status !== "authed") { router.push("/login?next=/"); return false; }
    const idea = cur.idea.trim();
    if (!opts?.startup && !idea) return false;
    if (cur.credits && cur.credits.left <= 0 && !opts?.startup) { patch({ upgrade: t("More generations") }); return false; }
    const token = ++buildToken.current;
    const variant = opts?.variant ?? 0;
    if (opts?.startup) {
      const st = opts.startup;
      setS((prev) => ({ ...prev, startups: { ...prev.startups, [st.id]: st }, buildId: st.id, buildState: "ready", buildVariant: variant, buildError: "", ver: 1, improving: false }));
    } else {
      const avoid = cur.buildId && cur.startups[cur.buildId] ? [cur.startups[cur.buildId].name] : [];
      patch({ buildState: "pending", buildVariant: variant, buildError: "", ver: 1, improving: false });
      ai.startup({ idea, model: cur.model, variant, avoidNames: variant > 0 ? avoid : [], lang }).then((r) => {
        if (token !== buildToken.current) return;
        setS((prev) => ({ ...prev, startups: { ...prev.startups, [r.startup.id]: r.startup }, buildId: r.startup.id, buildState: "ready", credits: r.credits }));
        void refresh();
      }).catch((e) => {
        if (token !== buildToken.current) return;
        if (e instanceof ApiError && e.status === 401) { fail(e); return; }
        patch({ buildState: "error", buildError: errorText(e) });
        if (e instanceof ApiError && (e.code === "no_credits" || e.code === "pro_required")) fail(e);
      });
    }
    router.push("/build");
    return true;
  }, [errorText, fail, lang, patch, refresh, router, t]);

  const cancelBuild = useCallback(() => {
    buildToken.current++;
    patch({ buildState: "idle" });
    void refresh();
  }, [patch, refresh]);

  const improve = useCallback(() => {
    const cur = ref.current;
    const st = cur.startups[cur.buildId];
    if (cur.improving || !st) return;
    patch({ improving: true });
    ai.improve({ startupId: st.id, model: cur.model, lang }).then((r) => {
      setS((prev) => ({ ...prev, improving: false, ver: prev.ver + 1, startups: { ...prev.startups, [st.id]: r.startup }, credits: r.credits }));
      say(t("Sharpened positioning and features"));
      void refresh();
    }).catch((e) => { patch({ improving: false }); fail(e); });
  }, [fail, lang, patch, refresh, say, t]);

  const ensureProject = useCallback(async (sid: string) => {
    try {
      const r = await api<{ id: string; created: boolean }>("/projects", { body: { sid } });
      await refresh();
      say(r.created ? t("{name} added to your projects", { name: ref.current.startups[sid]?.name ?? "" }) : t("Opened {name}", { name: ref.current.startups[sid]?.name ?? "" }));
      return r.id;
    } catch (e) { fail(e); return null; }
  }, [fail, refresh, say, t]);

  const deleteProject = useCallback(async (id: string) => {
    try { await api(`/projects/${id}`, { method: "DELETE" }); await refresh(); say(t("Project deleted")); } catch (e) { fail(e); }
  }, [fail, refresh, say, t]);

  const renameGeneration = useCallback(async (id: string, title: string) => {
    setS((prev) => ({ ...prev, gens: prev.gens.map((g) => (g.id === id ? { ...g, title } : g)) }));
    try { await api(`/generations/${id}`, { method: "PATCH", body: { title } }); } catch (e) { fail(e); void refresh(); }
  }, [fail, refresh]);
  const deleteGeneration = useCallback(async (id: string) => {
    setS((prev) => ({ ...prev, gens: prev.gens.filter((g) => g.id !== id) }));
    try { await api(`/generations/${id}`, { method: "DELETE" }); } catch (e) { fail(e); void refresh(); }
  }, [fail, refresh]);

  const setPref = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setS((prev) => ({ ...prev, prefs: { ...prev.prefs, [k]: v } }));
    const next = { ...ref.current.prefs, [k]: v };
    void api("/prefs", { method: "PUT", body: next }).catch(() => undefined);
  }, []);

  const renameUser = useCallback(async (name: string) => {
    try { await api("/account", { method: "PATCH", body: { name } }); await refresh(); say(t("Saved")); } catch (e) { fail(e); }
  }, [fail, refresh, say, t]);

  const store: Store = useMemo(() => {
    const left = s.credits?.left ?? 0;
    return {
      ...s,
      modelName: MODELS.find((m) => m.id === s.model)?.name ?? "Auto",
      left, limit: (s.credits?.limit ?? 0) + (s.credits?.bonus ?? 0),
      isPro: (s.credits?.plan ?? "free") !== "free",
      setIdea: (v) => patch({ idea: v }),
      setModel: (m) => { patch({ model: m }); if (ref.current.status === "authed") setPref("model", m); },
      say,
      openUpgrade: (f) => patch({ upgrade: f }),
      closeUpgrade: () => patch({ upgrade: "" }),
      setCreditsOpen: (v) => patch({ creditsOpen: v }),
      openPay: (p) => patch({ pay: p, upgrade: "", creditsOpen: false }),
      closePay: () => patch({ pay: "" }),
      refresh, setCredits, fail, login, register, logout,
      getStartup: (id) => s.startups[id],
      addStartups: (list) => setS((prev) => ({ ...prev, startups: { ...prev.startups, ...Object.fromEntries(list.map((x) => [x.id, x])) } })),
      startBuild, cancelBuild, improve, ensureProject, deleteProject, renameGeneration, deleteGeneration, setPref, renameUser,
    };
  }, [s, patch, say, refresh, setCredits, fail, login, register, logout, startBuild, cancelBuild, improve, ensureProject, deleteProject, renameGeneration, deleteGeneration, setPref, renameUser]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
