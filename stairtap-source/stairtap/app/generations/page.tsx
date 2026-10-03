"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/Button";
import { EmptyState, Label, Tabs } from "@/components/ui/Primitives";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import type { Generation, GenerationType } from "@/lib/types";

type Cat = "all" | GenerationType;
const CATS: [Cat, string][] = [["all", "All"], ["ideas", "Ideas"], ["startups", "Startups"], ["designs", "Websites"]];
const TYPE_LABEL: Record<string, string> = { ideas: "Idea", startups: "Startup", designs: "Website", copy: "Copy", research: "Research", other: "Other" };

export default function GenerationsPage() {
  const router = useRouter();
  const { gens, projects, renameGeneration, deleteGeneration } = useStore();
  const { t, ago } = useI18n();
  const [cat, setCat] = useState<Cat>("all");
  const [editing, setEditing] = useState<string>("");
  const [draft, setDraft] = useState("");
  const list = gens.filter((g) => cat === "all" || g.type === cat);
  const tabs = CATS.map(([id, label]) => ({ id, label: t(label), count: id === "all" ? gens.length : gens.filter((g) => g.type === id).length }));

  const open = (g: Generation) => {
    const p = g.sid ? projects.find((x) => x.sid === g.sid) : undefined;
    if (p) router.push(`/project?id=${p.id}${g.type === "designs" ? "&tab=site" : ""}`);
    else router.push(g.type === "ideas" ? "/ideas" : "/projects");
  };
  const save = (g: Generation) => {
    const v = draft.trim();
    if (v && v !== g.title) void renameGeneration(g.id, v);
    setEditing("");
  };

  return (
    <Page>
      <Label>{t("{n} generations", { n: gens.length })}</Label>
      <h1 className="mt-2.5 font-display text-[clamp(28px,4.2vw,46px)] leading-[1.08] font-semibold tracking-[-0.03em]">{t("Generations")}</h1>
      <Tabs tabs={tabs} value={cat} onChange={setCat} />
      {list.length > 0 ? (
        <div>
          {list.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-4.5 border-b border-line py-4.5">
              <span className="min-w-21 rounded-lg border border-line px-2.5 py-1.25 text-center font-mono text-[11.5px] uppercase tracking-[0.06em] text-tx2">{t(TYPE_LABEL[g.type] ?? "Other")}</span>
              <div className="min-w-57 flex-1">
                {editing === g.id ? (
                  <input autoFocus aria-label={t("Rename")} value={draft} maxLength={160} onChange={(e) => setDraft(e.target.value)} onBlur={() => save(g)} onKeyDown={(e) => { if (e.key === "Enter") save(g); if (e.key === "Escape") setEditing(""); }} className="h-10 w-full rounded-lg border border-line2 bg-s1 px-3 text-[15px] outline-none focus:border-white/40" />
                ) : (
                  <b className="block text-[15.5px] font-medium">{g.title}</b>
                )}
                <span className="text-[13px] text-tx3">{g.project}</span>
              </div>
              <span className="min-w-32 font-mono text-[12.5px] text-tx3">{g.model}</span>
              <span className="min-w-32 font-mono text-[12.5px] text-tx3">{ago(g.created_at)}</span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => open(g)}>{t("Open")}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(g.id); setDraft(g.title); }}>{t("Rename")}</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(t("Delete this entry from history?"))) void deleteGeneration(g.id); }}>{t("Delete")}</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={t("No generations here.")} text={t("Your ideas will appear here.")} action={<Button variant="pri" onClick={() => router.push("/ideas")}>{t("Generate an idea")}</Button>} />
      )}
    </Page>
  );
}
