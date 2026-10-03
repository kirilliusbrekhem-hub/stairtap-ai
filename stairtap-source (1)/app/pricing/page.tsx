"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Seg } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { CHAT_DAILY, PLAN_LIMITS, PLAN_NAMES, PRODUCTS, PROJECT_LIMITS, RUB_PER_USD, type PlanId, type ProductId } from "@/lib/plans";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

type Paid = Exclude<PlanId, "free">;
interface PlanDef { id: PlanId; blurb: string; feats: string[]; recommended?: boolean }

export default function PricingPage() {
  const router = useRouter();
  const { status, credits, openPay, refresh, say, payments } = useStore();
  const { t, lang, date } = useI18n();
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [cur, setCur] = useState<"USD" | "RUB" | null>(null);
  const currency = cur ?? (lang === "ru" ? "RUB" : "USD");
  const plan = credits?.plan ?? "free";

  const PLANS: PlanDef[] = [
    { id: "free", blurb: "For exploring STAIRTAP.", feats: [
      t("{n} generations per month", { n: PLAN_LIMITS.free }), t("{n} assistant messages per day", { n: CHAT_DAILY.free }),
      t("Up to {n} projects", { n: PROJECT_LIMITS.free }), t("Gemini Flash model"), t("Landing page with a working waitlist"), t("Publish on a public link")] },
    { id: "pro", blurb: "For serious builders.", recommended: true, feats: [
      t("{n} generations per month", { n: PLAN_LIMITS.pro }), t("{n} assistant messages per day", { n: CHAT_DAILY.pro }),
      t("Up to {n} projects", { n: PROJECT_LIMITS.pro }), t("Gemini Pro for deeper reasoning"), t("Everything in Free")] },
    { id: "ultra", blurb: "For ambitious builders.", feats: [
      t("{n} generations per month", { n: PLAN_LIMITS.ultra }), t("{n} assistant messages per day", { n: CHAT_DAILY.ultra }),
      t("Up to {n} projects", { n: PROJECT_LIMITS.ultra }), t("Gemini Pro for deeper reasoning"), t("Everything in Pro")] },
  ];

  // Returning from the payment page: poll until the webhook has been processed.
  const polled = useRef(false);
  useEffect(() => {
    if (polled.current || typeof window === "undefined" || !/[?&]paid=1/.test(window.location.search)) return;
    polled.current = true;
    say(t("Thank you! Activating your purchase…"));
    let n = 0;
    const id = setInterval(() => { void refresh(); if (++n >= 10) clearInterval(id); }, 3000);
    return () => clearInterval(id);
  }, [refresh, say, t]);

  const price = (id: Paid) => {
    const usd = period === "year" ? PRODUCTS[`${id}_year` as ProductId].usd / 12 : PRODUCTS[`${id}_month` as ProductId].usd;
    return currency === "RUB" ? `${Math.round(usd * RUB_PER_USD).toLocaleString("ru-RU")} ₽` : `$${Math.round(usd)}`;
  };

  const choose = (id: Paid) => {
    if (status !== "authed") { router.push("/login?next=/pricing"); return; }
    openPay(`${id}_${period}` as ProductId);
  };
  const manage = async () => {
    try { const r = await api<{ url: string }>("/billing/portal"); window.open(r.url, "_blank", "noopener"); }
    catch { say(t("Subscriptions paid with crypto do not renew automatically. Pay again to extend.")); }
  };

  return (
    <Page>
      <div className="flex flex-col items-center gap-4.5 text-center">
        <Badge>{t("Plans")}</Badge>
        <h1 className="font-display text-[clamp(34px,5.4vw,60px)] leading-[1.02] font-semibold tracking-[-0.035em]">{t("More intelligence.")}<br />{t("More creation power.")}</h1>
        <p className="max-w-150 text-[17px] text-tx2">{t("Every plan turns one idea into a startup. Higher plans give you more generations and the stronger model.")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Seg label={t("Billing period")} options={["month", "year"] as const} value={period} onChange={setPeriod} render={(o) => (o === "month" ? t("Monthly") : t("Yearly · save 20%"))} />
          <Seg label={t("Currency")} options={["USD", "RUB"] as const} value={currency} onChange={setCur} render={(o) => (o === "USD" ? "$ USD" : "₽ RUB")} />
        </div>
      </div>
      <div className="mt-11 grid items-stretch gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const isCur = plan === p.id;
          const name = PLAN_NAMES[p.id];
          const paid: Paid | null = p.id === "free" ? null : p.id;
          return (
            <div key={p.id} className={cn("relative flex flex-col gap-5 rounded-3xl border p-7.5", p.recommended ? "border-white/30 bg-linear-to-b from-[#18191b] to-[#0f1011] shadow-[0_40px_110px_-40px_color-mix(in_srgb,var(--color-acc)_50%,transparent)] lg:-my-3.5 lg:py-11" : "border-line bg-s1")}>
              {p.recommended && <Badge tone="pro" className="absolute top-4.5 right-4.5">{t("Recommended")}</Badge>}
              <div><div className="font-display text-[22px] font-semibold tracking-tight">{name}</div><p className="mt-1.5 text-tx2">{t(p.blurb)}</p></div>
              <div className="font-display text-[54px] leading-none font-bold tracking-[-0.045em]">
                {paid ? price(paid) : currency === "RUB" ? "0 ₽" : "$0"}
                <small className="ml-1.5 font-sans text-[15px] font-normal tracking-normal text-tx3">{p.id === "free" ? t("forever") : t("/ month")}</small>
              </div>
              {!paid ? (
                <Button size="lg" wide variant="ghost" disabled>{isCur ? t("Current plan") : t("Included for everyone")}</Button>
              ) : isCur ? (
                <div className="flex flex-col gap-2">
                  <Button size="lg" wide variant="ghost" disabled>{t("Current plan")}</Button>
                  <p className="text-center text-[13px] text-tx3">{t("Active until {date}.", { date: date(credits!.planUntil) })}</p>
                  <Button size="sm" wide onClick={() => (credits?.hasPortal ? manage() : choose(paid))}>{credits?.hasPortal ? t("Manage subscription") : t("Extend")}</Button>
                </div>
              ) : (
                <Button size="lg" wide variant={p.recommended ? "acc" : "pri"} onClick={() => choose(paid)}>{t("Upgrade to {name}", { name })}</Button>
              )}
              <ul className="list-stair mt-1">{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          );
        })}
      </div>
      <div className="mx-auto mt-10 max-w-170 text-center text-[13px] leading-relaxed text-tx3">
        <p>{currency === "RUB" ? t("Prices in rubles are approximate (1 $ ≈ {rate} ₽). You are always charged in US dollars.", { rate: RUB_PER_USD }) : t("Prices are in US dollars. Taxes are handled at checkout.")}</p>
        {payments.card || payments.crypto ? (
          <p className="mt-1.5">
            {payments.card && t("Card payments are processed by Lemon Squeezy, our merchant of record.")} {payments.crypto && t("Crypto payments (USDT, BTC, ETH and more) are processed by NOWPayments.")}
          </p>
        ) : null}
      </div>
    </Page>
  );
}
