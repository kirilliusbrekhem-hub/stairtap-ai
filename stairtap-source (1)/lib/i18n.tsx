"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { RU } from "./dict";

export type Lang = "en" | "ru";
const KEY = "stairtap.lang";

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translate an English source string. Placeholders: {name}. Falls back to English. */
  t: (s: string, vars?: Record<string, string | number>) => string;
  /** Locale-aware date, e.g. "3 окт. 2026 г." */
  date: (ms: number) => string;
  /** Short relative time. */
  ago: (ms: number) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let l: Lang = typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en";
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === "ru" || v === "en") l = v;
    } catch { /* storage unavailable */ }
    setLangState(l);
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
  }, []);

  const value = useMemo<I18n>(() => {
    const t = (s: string, vars?: Record<string, string | number>) => {
      let out = lang === "ru" ? RU[s] ?? s : s;
      if (vars) for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
      return out;
    };
    const loc = lang === "ru" ? "ru-RU" : "en-US";
    const date = (ms: number) => new Date(ms).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
    const ago = (ms: number) => {
      const m = Math.floor((Date.now() - ms) / 60000);
      if (m < 1) return t("Just now");
      if (m < 60) return t("{n} min ago", { n: m });
      const h = Math.floor(m / 60);
      if (h < 24) return t("{n} h ago", { n: h });
      return date(ms);
    };
    return { lang, setLang, t, date, ago };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}
