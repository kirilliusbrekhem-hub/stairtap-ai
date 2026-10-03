"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AIProgress } from "@/components/AIProgress";
import { Bar, Label } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { BUILD_STEPS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

const STEP_MS = 1500;

export default function BuildPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { buildId, buildState, buildError, getStartup, idea, modelName, cancelBuild, startBuild, buildVariant } = useStore();
  const [step, setStep] = useState(0);
  const finished = useRef(false);
  const ready = useRef(false);
  const startup = buildState === "ready" ? getStartup(buildId) : undefined;
  const last = BUILD_STEPS.length - 1;
  ready.current = buildState === "ready" && !!startup;

  useEffect(() => {
    if (buildState === "idle") router.replace("/");
  }, [buildState, router]);

  useEffect(() => {
    // Hold on the last step until the AI answer has arrived.
    const id = setInterval(() => setStep((s) => (s >= last && !ready.current ? s : s + 1)), STEP_MS);
    return () => clearInterval(id);
  }, [last]);

  useEffect(() => {
    if (step >= BUILD_STEPS.length && !finished.current) {
      finished.current = true;
      router.replace("/result");
    }
  }, [step, router]);

  if (buildState === "idle") return null;

  if (buildState === "error") {
    return (
      <div className="mx-auto max-w-150 animate-rise px-5 pt-16 pb-24">
        <div className="rounded-[18px] border border-[rgb(255_160_120/0.4)] bg-[rgb(255_140_90/0.06)] p-6">
          <h2 className="font-display text-xl font-semibold text-[#ffcfb8]">{t("The build did not finish.")}</h2>
          <p className="mt-2 text-tx2">{buildError}</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button variant="pri" onClick={() => { finished.current = false; setStep(0); startBuild({ variant: buildVariant }); }}>{t("Retry")}</Button>
            <Button onClick={() => { cancelBuild(); router.replace("/"); }}>{t("Back")}</Button>
          </div>
        </div>
      </div>
    );
  }

  const pct = Math.min(99, Math.round(((step + 0.5) * 100) / BUILD_STEPS.length));
  const bp: [string, string, number, boolean][] = startup
    ? [
        [t("Name"), startup.name, 2, true],
        [t("Problem"), startup.problem, 3, false],
        [t("Audience"), startup.audience, 4, false],
        [t("Solution"), startup.solution, 5, false],
        [t("First features"), startup.features.slice(0, 3).join(" · "), 6, false],
      ]
    : [t("Name"), t("Problem"), t("Audience"), t("Solution"), t("First features")].map((l, i) => [l, "", 99 + i, false] as [string, string, number, boolean]);

  return (
    <div className="mx-auto grid max-w-280 animate-rise gap-9 px-4 pt-9 pb-24 md:px-6 md:pt-15 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
      <div>
        <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-white/2 px-3.75 py-2.25 font-mono text-xs uppercase tracking-[0.08em] text-tx2">
          <span className="size-1.5 animate-pulse2 rounded-full bg-acc shadow-[0_0_12px_var(--color-acc)]" />
          {t("{model} is working", { model: modelName })}
        </div>
        <h2 className="mt-5.5 font-display text-[clamp(28px,4.2vw,46px)] leading-[1.08] font-semibold tracking-[-0.03em]">{t("Building your startup…")}</h2>
        <p className="mt-4 max-w-130 border-t border-line pt-4 text-base text-tx2">“{idea.trim() || startup?.solution}”</p>
        <AIProgress className="my-5.5 mb-6.5" active={step} steps={BUILD_STEPS.map(([label, detail]) => ({ label: t(label), detail: t(detail) }))} />
        <Bar accent value={pct} />
        <div className="mt-4.5 flex items-center justify-between">
          <span className="text-[13px] text-tx3">{pct}%{step >= last && buildState === "pending" ? ` · ${t("waiting for the model…")}` : ""}</span>
          <Button variant="ghost" onClick={() => { cancelBuild(); router.replace("/"); }}>{t("Cancel")}</Button>
        </div>
      </div>
      <div aria-live="polite" className="flex flex-col gap-5.5 rounded-[22px] border border-line bg-s1 p-6.5">
        <Label>{t("Live blueprint")}</Label>
        {bp.map(([label, text, at, big]) => (
          <div key={label}>
            <Label>{label}</Label>
            {step >= at && text ? (
              <div className={big ? "mt-2 animate-rise font-display text-[34px] leading-[1.05] font-bold tracking-[-0.035em]" : "mt-2 animate-rise text-[15px]"}>{text}</div>
            ) : (
              <div className="mt-2.5 flex flex-col gap-2.25"><div className="sk w-[92%]" /><div className="sk w-[64%]" /></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
