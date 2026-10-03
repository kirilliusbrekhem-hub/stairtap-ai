"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Bar, EmptyState, Label, Tabs } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import type { ProjectStatus } from "@/lib/types";

type Filter = "all" | ProjectStatus;

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, setIdea, getStartup } = useStore();
  const { t, date, ago } = useI18n();
  const [f, setF] = useState<Filter>("all");
  const list = projects.filter((p) => f === "all" || p.status === f);
  const count = (s: Filter) => (s === "all" ? projects.length : projects.filter((p) => p.status === s).length);
  const create = () => { setIdea(""); router.push("/"); };
  const tabs = (["all", "Draft", "Building", "Live"] as Filter[]).map((id) => ({ id, label: id === "all" ? t("All") : t(id), count: count(id) }));

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>{t("{n} startups", { n: projects.length })}</Label>
          <h1 className="mt-2.5 font-display text-[clamp(28px,4.2vw,46px)] leading-[1.08] font-semibold tracking-[-0.03em]">{t("Your projects")}</h1>
        </div>
        <Button variant="pri" onClick={create}><Icon n="plus" size={16} stroke={2.2} /> {t("New startup")}</Button>
      </div>
      <Tabs tabs={tabs} value={f} onChange={setF} />
      {list.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const s = getStartup(p.sid);
            if (!s) return null;
            return (
              <Link key={p.id} href={`/project?id=${p.id}`} className="flex min-h-57 flex-col gap-3.5 rounded-[18px] border border-line bg-s1 p-5.5 text-left transition hover:-translate-y-0.5 hover:border-line2 hover:bg-s2">
                <div className="flex items-center justify-between gap-2"><StatusBadge status={p.status} /><span className="text-[13px] text-tx3">{s.type}</span></div>
                <div>
                  <div className="font-display text-[22px] leading-tight font-semibold tracking-tight">{s.name}</div>
                  <p className="mt-2 text-[15px] text-tx2">{s.tag}</p>
                </div>
                <div className="mt-auto">
                  <Bar value={p.progress} className="mb-3" />
                  <div className="flex justify-between text-[13px] text-tx3"><span>{t("Created {date}", { date: date(p.created_at) })}</span><span>{ago(p.updated_at)}</span></div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState title={t("No projects yet.")} text={t("Your first startup starts here.")} action={<Button variant="pri" onClick={create}>{t("Build something")}</Button>} />
      )}
    </Page>
  );
}
