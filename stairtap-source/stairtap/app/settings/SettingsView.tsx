"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/Button";
import { Label, Seg, Toggle } from "@/components/ui/Primitives";
import { api, ApiError } from "@/lib/api";
import { MODELS } from "@/lib/data";
import { PLAN_NAMES } from "@/lib/plans";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

type TabId = "general" | "appearance" | "ai" | "security" | "billing";
const TABS: [TabId, string][] = [["general", "General"], ["appearance", "Appearance"], ["ai", "AI preferences"], ["security", "Security"], ["billing", "Billing"]];
const inputCls = "h-11 min-w-0 rounded-xl border border-line2 bg-s1 px-3.5 text-[14.5px] outline-none transition focus:border-white/40";

function Row({ label, desc, children }: { label: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 border-b border-line py-5">
      <div><b className="block font-medium">{label}</b><small className="text-[13.5px] text-tx3">{desc}</small></div>
      {children}
    </div>
  );
}

export function SettingsView() {
  const router = useRouter();
  const search = useSearchParams();
  const s = useStore();
  const { t, lang, setLang } = useI18n();
  const { prefs, setPref, say, user, credits } = s;
  const initial = TABS.find(([id]) => id === search.get("tab"))?.[0] ?? "general";
  const [tab, setTab] = useState<TabId>(initial);
  const [name, setName] = useState(user?.name ?? "");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user || !credits) return null;

  const changePw = async () => {
    setBusy(true);
    try { await api("/account/password", { body: { current: cur, next } }); setCur(""); setNext(""); say(t("Password changed")); }
    catch (e) { say(e instanceof ApiError && e.code === "bad_credentials" ? t("Wrong email or password.") : e instanceof ApiError && e.code === "weak_password" ? t("Use a password of at least 8 characters.") : t("Something went wrong. Try again.")); }
    setBusy(false);
  };
  const del = async () => {
    const pw = window.prompt(t("Enter your password to delete the account permanently. All projects and published sites will be removed."));
    if (!pw) return;
    try { await api("/account/delete", { body: { password: pw } }); await s.logout(); }
    catch (e) { say(e instanceof ApiError && e.code === "bad_credentials" ? t("Wrong email or password.") : t("Something went wrong. Try again.")); }
  };

  return (
    <Page>
      <Label>{t("Account")}</Label>
      <h1 className="mt-2.5 font-display text-[clamp(28px,4.2vw,46px)] leading-[1.08] font-semibold tracking-[-0.03em]">{t("Settings")}</h1>
      <div className="mt-9 grid gap-3 md:grid-cols-[220px_1fr] md:gap-12">
        <div className="flex gap-0.5 overflow-x-auto md:flex-col">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={cn("h-11 rounded-[10px] px-3.5 text-left text-[14.5px] whitespace-nowrap transition hover:bg-white/4 hover:text-tx", tab === id ? "bg-s2 text-tx" : "text-tx2")}>{t(label)}</button>
          ))}
        </div>
        <div>
          <h2 className="font-display text-[22px] font-semibold tracking-tight">{t(TABS.find(([id]) => id === tab)![1])}</h2>
          {tab === "general" && (
            <>
              <Row label={t("Display name")} desc={t("Shown in the header and on your profile.")}>
                <div className="flex gap-2.5">
                  <input aria-label={t("Display name")} className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
                  <Button size="sm" disabled={!name.trim() || name.trim() === user.name} onClick={() => void s.renameUser(name.trim())}>{t("Save")}</Button>
                </div>
              </Row>
              <Row label="Email" desc={t("Used for sign-in.")}><span className="text-[14.5px] text-tx2">{user.email}</span></Row>
              <Row label={t("Language")} desc={t("Interface and the language the AI writes in.")}><Seg options={["en", "ru"] as const} value={lang} onChange={setLang} render={(o) => (o === "en" ? "English" : "Русский")} /></Row>
            </>
          )}
          {tab === "appearance" && (
            <>
              <Row label={t("Reduce motion")} desc={t("Turns off non-essential animation across the app.")}><Toggle label={t("Reduce motion")} on={prefs.reduceMotion} onChange={(v) => setPref("reduceMotion", v)} /></Row>
              <Row label={t("Show generation counter")} desc={t("Keep the remaining generations visible in the header.")}><Toggle label={t("Show generation counter")} on={prefs.showCredits} onChange={(v) => setPref("showCredits", v)} /></Row>
            </>
          )}
          {tab === "ai" && (
            <Row label={t("Default model")} desc={t("Used for every new build. Gemini Pro needs a paid plan.")}>
              <Seg options={MODELS.map((m) => m.name)} value={s.modelName} onChange={(v) => { const m = MODELS.find((x) => x.name === v)!; if (m.id === "geminipro" && !s.isPro) { s.openUpgrade("Gemini Pro"); return; } s.setModel(m.id); }} />
            </Row>
          )}
          {tab === "security" && (
            <>
              <div className="border-b border-line py-5">
                <b className="block font-medium">{t("Password")}</b>
                <small className="text-[13.5px] text-tx3">{t("Changing it signs out your other devices.")}</small>
                <div className="mt-3.5 flex flex-wrap gap-2.5">
                  <input aria-label={t("Current password")} placeholder={t("Current password")} type="password" autoComplete="current-password" className={cn(inputCls, "basis-56")} value={cur} onChange={(e) => setCur(e.target.value)} />
                  <input aria-label={t("New password")} placeholder={t("New password")} type="password" autoComplete="new-password" className={cn(inputCls, "basis-56")} value={next} onChange={(e) => setNext(e.target.value)} />
                  <Button variant="pri" disabled={busy || !cur || next.length < 8} onClick={() => void changePw()}>{t("Change")}</Button>
                </div>
              </div>
              <Row label={t("Sign out")} desc={t("End the session on this device.")}><Button size="sm" onClick={() => void s.logout()}>{t("Sign out")}</Button></Row>
              <Row label={t("Delete account")} desc={t("Removes your projects, published sites and data.")}><Button size="sm" variant="ghost" onClick={() => void del()}>{t("Delete")}</Button></Row>
            </>
          )}
          {tab === "billing" && (
            <>
              <Row label={t("Plan")} desc={t("Your current subscription.")}>
                <div className="flex flex-wrap items-center gap-3 text-[14.5px] text-tx2">{PLAN_NAMES[credits.plan]}<Button size="sm" onClick={() => router.push("/pricing")}>{t("Change plan")}</Button></div>
              </Row>
              <Row label={t("Generations")} desc={t("Remaining this period.")}>
                <div className="flex flex-wrap items-center gap-3 text-[14.5px] text-tx2">{t("{n} remaining", { n: s.left })}<Button size="sm" onClick={() => s.setCreditsOpen(true)}>{t("Buy more")}</Button></div>
              </Row>
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
