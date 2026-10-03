"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Primitives";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

const inputCls = "h-12 w-full rounded-[13px] border border-line2 bg-s1 px-3.75 text-[15px] transition outline-none focus:border-white/40";

export function LoginView() {
  const { status, login, register } = useStore();
  const { t, lang } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [mail, setMail] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (status === "authed") router.replace(dest); }, [status, dest, router]);
  useEffect(() => { api<{ mail: boolean }>("/config").then((c) => setMail(c.mail)).catch(() => undefined); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (mode === "forgot") { await api("/auth/forgot", { body: { email, lang } }); setSent(true); setBusy(false); return; }
      if (mode === "in") await login(email, password);
      else await register(email, password, name);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "network";
      const map: Record<string, string> = {
        bad_credentials: "Wrong email or password.",
        email_taken: "This email is already registered. Sign in instead.",
        bad_email: "Enter a valid email address.",
        weak_password: "Use a password of at least 8 characters.",
        rate_limited: "Too many attempts. Wait a few minutes and retry.",
        network: "No connection to the server. Check your internet and retry.",
      };
      setError(t(map[code] ?? "Something went wrong. Try again."));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-110 animate-rise px-5 pt-14 pb-24 md:pt-20">
      <Label>{mode === "in" ? t("Welcome back") : mode === "up" ? t("Create your account") : t("Password reset")}</Label>
      <h1 className="mt-3 font-display text-[clamp(30px,5vw,44px)] leading-[1.06] font-semibold tracking-[-0.035em]">
        {mode === "in" ? t("Sign in to STAIRTAP") : mode === "up" ? t("Start building with AI") : t("Forgot your password?")}
      </h1>
      <p className="mt-3 text-tx2">{mode === "in" ? t("Your projects and generations are waiting.") : mode === "up" ? t("Free plan: 10 generations a month. No card needed.") : t("Enter your email and we will send a link to set a new password.")}</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
        {mode === "up" && (
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-tx2">{t("Name")}</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-tx2">Email</span>
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        {mode !== "forgot" && <label className="block">
          <span className="mb-1.5 block text-[13px] text-tx2">{t("Password")}</span>
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={8} />
        </label>}
        {sent && <p role="status" className="rounded-xl border border-acc/40 px-3.5 py-2.5 text-[14px] text-acc">{t("If this email is registered, a reset link is on its way.")}</p>}
        {error && <p role="alert" className="rounded-xl border border-[rgb(255_160_120/0.4)] bg-[rgb(255_140_90/0.06)] px-3.5 py-2.5 text-[14px] text-[#ffcfb8]">{error}</p>}
        <Button type="submit" variant="acc" size="lg" wide disabled={busy}>{busy ? t("Please wait…") : mode === "in" ? t("Sign in") : mode === "up" ? t("Create account") : t("Send reset link")}</Button>
      </form>

      <div className="mt-6 flex flex-col items-start gap-1">
        <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); setSent(false); }} className="min-h-11 text-[14.5px] text-tx2 transition hover:text-tx">
          {mode === "in" ? t("No account yet? Create one") : t("Already have an account? Sign in")}
        </button>
        {mode === "in" && mail && <button type="button" onClick={() => { setMode("forgot"); setError(""); }} className="min-h-11 text-[14.5px] text-tx3 transition hover:text-tx">{t("Forgot your password?")}</button>}
      </div>
    </div>
  );
}
