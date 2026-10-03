"use client";

import { useRef, useState } from "react";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, Chip, EmptyState, Label, PageHeader, Skeleton } from "@/components/ui/Primitives";
import { ai } from "@/lib/api";
import type { Startup, IdeaFilters } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const GROUPS: { label: string; key: Exclude<keyof IdeaFilters, "interests">; options: string[] }[] = [
  { label: "Industry", key: "industry", options: ["Fintech", "Health", "Education", "Creator economy", "Climate", "Dev tools"] },
  { label: "Audience", key: "audience", options: ["Indie hackers", "Students", "Small business", "Creators", "Enterprise"] },
  { label: "Business model", key: "biz", options: ["SaaS", "Marketplace", "Subscription", "Usage-based"] },
  { label: "Difficulty", key: "level", options: ["Easy", "Medium", "Hard"] },
  { label: "Market type", key: "market", options: ["B2B", "B2C", "B2B2C"] },
];
const INTERESTS = ["AI agents", "Automation", "Remote work", "Wellness", "Open data"];

type Phase = "idle" | "loading" | "ready";

export default function IdeasPage() {
  const { setIdea, startBuild, model, addStartups, setCredits, fail, left } = useStore();
  const { t, lang } = useI18n();
  const [f, setF] = useState<IdeaFilters>({ industry: "Fintech", audience: "Indie hackers", biz: "SaaS", level: "Medium", market: "B2C", interests: ["AI agents"] });
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [cards, setCards] = useState<Startup[]>([]);
  const token = useRef(0);

  const generate = () => {
    if (phase === "loading") return;
    const my = ++token.current;
    const nextRound = phase === "ready" ? round + 1 : round;
    setRound(nextRound);
    setPhase("loading"); setOpen({});
    ai.ideas({ filters: f, model, round: nextRound, lang }).then((r) => {
      if (my !== token.current) return;
      addStartups(r.ideas); setCredits(r.credits);
      setCards(r.ideas); setPhase("ready");
    }).catch((e) => {
      if (my !== token.current) return;
      setPhase(cards.length ? "ready" : "idle");
      fail(e);
    });
  };

  return (
    <Page>
      <Badge tone="soft" className="mb-4">{t("Founder tool")}</Badge>
      <PageHeader title={t("Find your next startup.")} sub={t("Let AI discover opportunities worth building.")} />
      <div className="mt-9 grid items-start gap-9 lg:grid-cols-[330px_1fr]">
        <div>
          {GROUPS.map((g) => (
            <div key={g.key} className="mb-5.5">
              <Label className="mb-2.5">{t(g.label)}</Label>
              <div className="flex flex-wrap gap-2">{g.options.map((o) => <Chip key={o} on={f[g.key] === o} onClick={() => setF({ ...f, [g.key]: o })}>{t(o)}</Chip>)}</div>
            </div>
          ))}
          <div className="mb-5.5">
            <Label className="mb-2.5">{t("Interests")}</Label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((o) => {
                const on = f.interests.includes(o);
                return <Chip key={o} on={on} onClick={() => setF({ ...f, interests: on ? f.interests.filter((x) => x !== o) : [...f.interests, o] })}>{t(o)}</Chip>;
              })}
            </div>
          </div>
          <Button variant="acc" size="lg" wide disabled={phase === "loading"} onClick={generate}>{t("Generate ideas")}</Button>
          <p className="mt-2.5 text-[13px] text-tx3">{t("Uses 1 generation · {n} left", { n: left })}</p>
        </div>
        <div>
          {phase === "idle" && <EmptyState title={t("Set your filters, then generate.")} text={t("STAIRTAP scans the opportunity space and returns startups worth building, with the reasoning attached.")} />}
          {phase === "loading" && (
            <div className="flex flex-col gap-4">
              <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-line bg-white/2 px-3.75 py-2.25 font-mono text-xs uppercase tracking-[0.08em] text-tx2">
                <span className="size-1.5 animate-pulse2 rounded-full bg-acc" />
                {t("Researching the opportunity space…")}
              </div>
              {[1, 2, 3].map((i) => (
                <Card key={i} className="min-h-47.5"><Skeleton w="38%" className="h-4" /><div className="mt-5.5 flex flex-col gap-2.25"><Skeleton w="90%" /><Skeleton w="76%" /><Skeleton w="58%" /></div></Card>
              ))}
            </div>
          )}
          {phase === "ready" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between"><Label>{t("{n} opportunities", { n: cards.length })}</Label><Button size="sm" onClick={generate}>{t("Regenerate")}</Button></div>
              {cards.map((s) => {
                const o = !!open[s.id];
                return (
                  <Card key={s.id}>
                    <div className="flex items-center justify-between gap-3"><div className="font-display text-[22px] font-semibold tracking-tight">{s.name}</div><Badge>{s.industry}</Badge></div>
                    <Row label={t("Problem")}>{s.problem}</Row>
                    <Row label={t("Target audience")}>{s.audience}</Row>
                    <Row label={t("Solution")}>{s.solution}</Row>
                    {o && (
                      <>
                        <Row label={t("Why now")}>{s.why}</Row>
                        <Row label={t("Monetization")}>{s.money}</Row>
                        <Row label={t("Estimated complexity")}>
                          <span className="mr-2.5 inline-flex gap-1">{[1, 2, 3].map((n) => <i key={n} className={cn("h-1.25 w-3.5 -skew-x-24 rounded-xs", n <= s.complexityLevel ? "bg-acc" : "bg-white/14")} />)}</span>{t(s.complexity)}
                        </Row>
                      </>
                    )}
                    <div className="mt-5.5 flex flex-wrap gap-2.5">
                      <Button variant="pri" onClick={() => { setIdea(s.solution); startBuild({ startup: s }); }}>{t("Build this")}</Button>
                      <Button onClick={() => setOpen({ ...open, [s.id]: !o })}>{o ? t("Collapse") : t("Explore")}</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mt-4"><Label>{label}</Label><p className="mt-1.5 text-[15px]">{children}</p></div>;
}
