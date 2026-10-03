"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Label } from "@/components/ui/Primitives";
import { Page } from "@/components/Page";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function ResultPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { buildId, buildState, buildVariant, getStartup, modelName, ver, improving, improve, startBuild, ensureProject } = useStore();
  const s = getStartup(buildId);

  useEffect(() => {
    if (!s && buildState === "idle") router.replace("/");
  }, [s, buildState, router]);
  useEffect(() => {
    if (buildState === "pending" || buildState === "error") router.replace("/build");
  }, [buildState, router]);
  if (!s || buildState !== "ready") return null;

  const open = async () => {
    const id = await ensureProject(s.id);
    if (id) router.push(`/project?id=${id}`);
  };

  return (
    <Page>
      <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-white/2 px-3.75 py-2.25 font-mono text-xs uppercase tracking-[0.08em] text-tx2">
        <span className="size-1.5 animate-pulse2 rounded-full bg-acc shadow-[0_0_12px_var(--color-acc)]" />
        {t("Generated with {model} · v{ver}", { model: modelName, ver })}
      </div>
      <h1 className="mt-5.5 font-display text-[clamp(28px,4.2vw,46px)] leading-[1.08] font-semibold tracking-[-0.03em]">{t("Your startup is taking shape.")}</h1>
      <div className="mt-4.5 font-display text-[clamp(42px,8vw,92px)] leading-none font-bold tracking-[-0.045em]">{s.name}</div>
      <p className="mt-3.5 max-w-150 text-[19px] text-tx2">{s.tag}</p>
      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <Button variant="pri" size="lg" onClick={open}>{t("Open workspace")} <Icon n="arrow" /></Button>
        <Button onClick={() => router.push("/")}>{t("Edit idea")}</Button>
        <Button onClick={() => startBuild({ variant: buildVariant })}>{t("Regenerate")}</Button>
        <Button onClick={improve}>{improving ? t("Improving…") : t("Improve")}</Button>
        <Button onClick={() => startBuild({ variant: buildVariant + 1 })}>{t("Generate another version")}</Button>
      </div>
      <p className="mt-3 text-[13px] text-tx3">{t("Regenerate, Improve and Another version use one generation each.")}</p>
      <div className="mt-10 grid gap-px overflow-hidden rounded-[20px] border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
        <Cell label={t("Problem")}><p className="mt-2 text-[15px]">{s.problem}</p></Cell>
        <Cell label={t("Target audience")}><p className="mt-2 text-[15px]">{s.audience}</p></Cell>
        <Cell label={t("Core solution")}><p className="mt-2 text-[15px]">{s.solution}</p></Cell>
        <Cell label={t("Key features")}><ul className="list-stair">{s.features.map((f) => <li key={f}>{f}</li>)}</ul></Cell>
        <Cell label={t("Possible business model")}><ul className="list-stair">{s.biz.map((f) => <li key={f}>{f}</li>)}</ul></Cell>
        <div className="hidden bg-s1 xl:block" />
      </div>
    </Page>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="bg-s1 p-6"><Label>{label}</Label>{children}</div>;
}
