"use client";

import Link from "next/link";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, Label } from "@/components/ui/Primitives";
import { PLAN_NAMES } from "@/lib/plans";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function ProfilePage() {
  const { user, credits, projects, setCreditsOpen, logout } = useStore();
  const { t, date } = useI18n();
  if (!user || !credits) return null;
  const initials = (user.name || user.email).trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <Page>
      <div className="flex flex-wrap items-center gap-6">
        <div className="grid size-21 place-items-center rounded-full border border-line2 bg-s3 font-display text-[26px] font-semibold">{initials}</div>
        <div>
          <h1 className="font-display text-[clamp(28px,4.2vw,46px)] leading-[1.08] font-semibold tracking-[-0.03em]">{user.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5"><span className="text-[13px] text-tx3">{user.email}</span><Badge tone="pro">{PLAN_NAMES[credits.plan]}</Badge></div>
        </div>
        <Link href="/settings" className="ml-auto inline-flex h-11 items-center rounded-xl border border-line2 px-4.5 text-sm font-medium transition hover:bg-white/6">{t("Settings")}</Link>
      </div>
      <div className="mt-9 grid gap-4 sm:grid-cols-3">
        <Stat label={t("Projects")} value={projects.length} />
        <Stat label={t("Generations used")} value={credits.usedTotal} />
        <button type="button" onClick={() => setCreditsOpen(true)} className="text-left"><Stat label={t("Generations left")} value={credits.left} /></button>
      </div>
      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <Card>
          <Label>{t("Subscription")}</Label>
          <div className="mt-3 font-display text-[22px] font-semibold tracking-tight">{t("{name} plan", { name: PLAN_NAMES[credits.plan] })}</div>
          <p className="mt-2 text-tx2">
            {credits.plan === "free" ? t("10 generations a month and the fast model. Upgrade for more generations and Gemini Pro.") : t("Active until {date}.", { date: date(credits.planUntil) })}
          </p>
          <Link href="/pricing" className="mt-5 inline-flex h-11 items-center rounded-xl border border-tx bg-tx px-4.5 text-sm font-medium text-[#0a0a0b] transition hover:bg-white">{t("Manage plan")}</Link>
        </Card>
        <Card>
          <Label>{t("Account")}</Label>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href="/settings?tab=security" className="inline-flex h-11 items-center rounded-xl border border-line2 px-4.5 text-sm font-medium transition hover:bg-white/6">{t("Security")}</Link>
            <Link href="/settings" className="inline-flex h-11 items-center rounded-xl border border-line2 px-4.5 text-sm font-medium transition hover:bg-white/6">{t("All settings")}</Link>
            <Button onClick={() => void logout()}>{t("Sign out")}</Button>
          </div>
        </Card>
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <Card className="h-full"><Label>{label}</Label><div className="mt-2.5 font-display text-[38px] leading-none font-bold tracking-[-0.04em]">{value}</div></Card>;
}
