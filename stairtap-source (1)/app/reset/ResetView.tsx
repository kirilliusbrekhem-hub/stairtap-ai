"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Primitives";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function ResetView() {
  const { t } = useI18n();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { await api("/auth/reset", { body: { token, password } }); setDone(true); }
    catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(code === "bad_token" ? t("This link is invalid or has expired. Request a new one.") : code === "weak_password" ? t("Use a password of at least 8 characters.") : t("Something went wrong. Try again."));
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto w-full max-w-110 animate-rise px-5 pt-14 pb-24 md:pt-20">
      <Label>{t("Password reset")}</Label>
      <h1 className="mt-3 font-display text-[clamp(30px,5vw,44px)] leading-[1.06] font-semibold tracking-[-0.035em]">{t("Set a new password")}</h1>
      {done ? (
        <div className="mt-8"><p className="text-tx2">{t("Password changed")}.</p><Link href="/login" className="mt-5 inline-flex h-12 items-center rounded-[14px] border border-acc bg-acc px-6 font-medium text-accfg">{t("Sign in")}</Link></div>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-tx2">{t("New password")}</span>
            <input className="h-12 w-full rounded-[13px] border border-line2 bg-s1 px-3.75 text-[15px] outline-none transition focus:border-white/40" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p role="alert" className="rounded-xl border border-[rgb(255_160_120/0.4)] bg-[rgb(255_140_90/0.06)] px-3.5 py-2.5 text-[14px] text-[#ffcfb8]">{error}</p>}
          <Button type="submit" variant="acc" size="lg" wide disabled={busy || !token}>{busy ? t("Please wait…") : t("Save")}</Button>
        </form>
      )}
    </div>
  );
}
