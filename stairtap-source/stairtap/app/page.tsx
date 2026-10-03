"use client";

import Link from "next/link";
import { AIInput } from "@/components/AIInput";
import { Chip, Bar } from "@/components/ui/Primitives";
import { StatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { EXAMPLE_IDEAS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function HomePage() {
  const { idea, setIdea, model, setModel, startBuild, say, projects, getStartup, status } = useStore();
  const { t } = useI18n();
  return (
    <div className="relative animate-rise overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_46%_at_50%_0%,rgb(255_255_255/0.075),transparent_72%)]" />
      <svg className="pointer-events-none absolute right-[-2%] bottom-0 w-[72%] max-w-240" viewBox="0 0 900 520" fill="none" aria-hidden>
        <path d="M0 520H110V440H230V360H350V280H470V200H590V120H710V44H760" stroke="rgb(255 255 255/0.075)" strokeWidth="1.5" />
        <path d="M0 470H110V390H230V310H350V230H470V150H590V70H700" stroke="rgb(255 255 255/0.04)" strokeWidth="1.5" />
        <path d="M770 22L744 60L792 56Z" fill="rgb(255 255 255/0.1)" />
      </svg>
      <div className="relative mx-auto flex max-w-215 flex-col items-center gap-5.5 px-6 pt-14 pb-24 text-center md:pt-17">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-white/2 px-3.75 py-2.25 font-mono text-xs uppercase tracking-[0.08em] text-tx2">
          <span className="size-1.5 animate-pulse2 rounded-full bg-acc shadow-[0_0_12px_var(--color-acc)]" />
          {t("Idea")} <i className="not-italic text-tx3">→</i> AI <i className="not-italic text-tx3">→</i> {t("Startup")}
        </div>
        <h1 className="font-display text-[clamp(36px,6.4vw,70px)] leading-[1.02] font-semibold tracking-[-0.035em]">
          {t("What do you want")}<br />{t("to build?")}
        </h1>
        <p className="max-w-150 text-[17px] text-tx2">{t("Describe your idea. AI writes the blueprint, builds a landing page with a waitlist and publishes it on a link.")}</p>

        <AIInput
          value={idea}
          onChange={setIdea}
          model={model}
          onModel={setModel}
          onSubmit={() => startBuild()}
          onEmpty={() => say(t("Describe your idea first, or tap an example"))}
        />

        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_IDEAS.map((x) => <Chip key={x} onClick={() => setIdea(t(x))}>{t(x)}</Chip>)}
        </div>
        <Link href="/ideas" className="inline-flex h-11 items-center gap-2 text-sm font-medium text-tx2 transition hover:text-tx">
          {t("No idea yet? Find your next startup")} <Icon n="arrow" size={16} />
        </Link>

        <div className="mt-6 font-display text-[clamp(20px,3vw,26px)] leading-tight font-semibold tracking-[-0.015em] text-tx3">
          Just build on AI.
          <b className="block font-bold text-tx">Just… STAIRTAP.</b>
        </div>

        {status === "authed" && projects.length > 0 && (
          <div className="mt-1.5 grid w-full gap-3 sm:grid-cols-2">
            {projects.slice(0, 2).map((p) => (
              <Link key={p.id} href={`/project?id=${p.id}`} className="flex flex-col gap-3 rounded-[18px] border border-line bg-s1 p-4.5 text-left transition hover:-translate-y-0.5 hover:border-line2 hover:bg-s2">
                <div className="flex items-center justify-between gap-2.5">
                  <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-tx3">{t("Continue building")}</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="font-display text-base font-semibold">{getStartup(p.sid)?.name}</div>
                <Bar value={p.progress} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
