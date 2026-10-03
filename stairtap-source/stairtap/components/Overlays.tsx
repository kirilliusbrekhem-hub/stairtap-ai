"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Bar, Label } from "./ui/Primitives";
import { SendMark } from "./ui/Logo";
import { api } from "@/lib/api";
import { PRODUCTS, RUB_PER_USD } from "@/lib/plans";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export function UpgradeModal() {
  const { upgrade, closeUpgrade } = useStore();
  const { t } = useI18n();
  const router = useRouter();
  if (!upgrade) return null;
  return (
    <Modal label={t("Upgrade")} onClose={closeUpgrade}>
      <div className="mb-5 grid size-13 place-items-center rounded-[15px] bg-acc text-accfg"><SendMark /></div>
      <h2 className="font-display text-[32px] leading-[1.08] font-semibold tracking-[-0.03em]">{t("Unlock the full STAIRTAP")}</h2>
      <p className="mt-2 text-base text-tx2">{t("More generations, Gemini Pro and more projects for serious founders.")}</p>
      <div className="mt-4.5"><Badge tone="soft">{upgrade}</Badge></div>
      <ul className="list-stair mb-6.5">
        <li>{t("Up to 1000 generations every month")}</li>
        <li>{t("Gemini Pro for deeper reasoning")}</li>
        <li>{t("Up to 200 projects and more assistant messages")}</li>
      </ul>
      <div className="flex flex-col gap-2.5">
        <Button variant="acc" size="lg" wide onClick={() => { closeUpgrade(); router.push("/pricing"); }}>{t("See plans")}</Button>
        <Button variant="ghost" wide onClick={closeUpgrade}>{t("Maybe later")}</Button>
      </div>
    </Modal>
  );
}

export function CreditsModal() {
  const { creditsOpen, setCreditsOpen, credits, openPay, status } = useStore();
  const { t, date } = useI18n();
  const router = useRouter();
  if (!creditsOpen || !credits || status !== "authed") return null;
  const close = () => setCreditsOpen(false);
  const total = credits.limit + credits.bonus;
  const rows: [string, number][] = [[t("Startups"), credits.used.startups], [t("Ideas"), credits.used.ideas], [t("Websites"), credits.used.designs]];
  return (
    <Modal label={t("Generations")} onClose={close}>
      <Label>{t("Generations remaining")}</Label>
      <div className="mt-2.5 font-display text-[72px] leading-none font-bold tracking-[-0.045em]">
        {credits.left}<small className="ml-1.5 font-sans text-[15px] font-normal tracking-normal text-tx3">{t("of {n}", { n: total })}</small>
      </div>
      <Bar accent value={total > 0 ? Math.max(0, Math.min(100, Math.round((credits.left * 100) / total))) : 0} className="mt-4.5 mb-2" />
      <p className="mb-6 text-[13px] text-tx3">
        {t("The monthly allowance resets on the 1st. Purchased generations never expire.")}
        {credits.plan !== "free" && credits.planUntil > 0 ? ` ${t("Plan active until {date}.", { date: date(credits.planUntil) })}` : ""}
      </p>
      <Label>{t("Used this month")}</Label>
      <div className="mt-1.5 mb-6">
        {rows.map(([n, v]) => (
          <div key={n} className="flex justify-between border-b border-line py-3 last:border-0"><span>{n}</span><span className="text-[13px] text-tx3">{v}</span></div>
        ))}
      </div>
      <Label>{t("Buy more")}</Label>
      <div className="mt-3 mb-5.5 flex flex-wrap gap-2.5">
        <Button onClick={() => openPay("pack_50")}>{t("+{n} generations", { n: 50 })} · ${PRODUCTS.pack_50.usd}</Button>
        <Button onClick={() => openPay("pack_200")}>{t("+{n} generations", { n: 200 })} · ${PRODUCTS.pack_200.usd}</Button>
      </div>
      <Button variant="pri" wide onClick={() => { close(); router.push("/pricing"); }}>{t("Upgrade plan")}</Button>
    </Modal>
  );
}

/** Choose how to pay, then hand over to the payment provider's hosted page. */
export function PayModal() {
  const { pay, closePay, payments, say, fail } = useStore();
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState<"" | "card" | "crypto">("");
  if (!pay) return null;
  const p = PRODUCTS[pay];
  const title = p.kind === "pack" ? t("+{n} generations", { n: p.gens! }) : `${p.plan === "pro" ? "Pro" : t("Founder")} · ${p.days === 365 ? t("per year") : t("per month")}`;
  const none = !payments.card && !payments.crypto;

  const go = async (method: "card" | "crypto") => {
    setBusy(method);
    try {
      const r = await api<{ url: string }>("/billing/checkout", { body: { product: pay, method } });
      window.location.href = r.url;
    } catch (e) {
      setBusy("");
      if (e instanceof Error && /not_configured/.test(e.message)) say(t("This payment method is not available yet."));
      else fail(e);
    }
  };

  return (
    <Modal label={t("Payment")} onClose={busy ? undefined : closePay}>
      <Label>{t("Order")}</Label>
      <h2 className="mt-2 font-display text-[30px] leading-[1.08] font-semibold tracking-[-0.03em]">{title}</h2>
      <div className="mt-3 font-display text-[44px] leading-none font-bold tracking-[-0.04em]">${p.usd}</div>
      {lang === "ru" && <p className="mt-2 text-[13px] text-tx3">{t("≈ {rub} ₽. You are charged in US dollars.", { rub: (p.usd * RUB_PER_USD).toLocaleString("ru-RU") })}</p>}
      <div className="mt-7 flex flex-col gap-2.5">
        {payments.card && (
          <Button variant="acc" size="lg" wide disabled={!!busy} onClick={() => go("card")}>{busy === "card" ? t("Opening checkout…") : t("Pay by card")}</Button>
        )}
        {payments.crypto && (
          <Button variant="pri" size="lg" wide disabled={!!busy} onClick={() => go("crypto")}>{busy === "crypto" ? t("Opening checkout…") : t("Pay with crypto (USDT and others)")}</Button>
        )}
        {none && <p className="rounded-xl border border-line2 p-4 text-tx2">{t("Payments are not connected yet. Please try again later.")}</p>}
        <Button variant="ghost" wide disabled={!!busy} onClick={closePay}>{t("Cancel")}</Button>
      </div>
      <p className="mt-5 text-[12.5px] leading-relaxed text-tx3">
        {payments.card && t("Cards issued in Russia are usually not accepted by the card processor. Use crypto in that case.")}{" "}
        {payments.crypto && p.kind === "plan" && t("Crypto pays for one period; there is no automatic renewal. Card plans renew automatically and can be cancelled any time.")}
      </p>
    </Modal>
  );
}
