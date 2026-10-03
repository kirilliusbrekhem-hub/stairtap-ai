"use client";

import { useState } from "react";
import { Icon } from "./ui/Icon";
import { MODELS } from "@/lib/data";
import type { ModelId } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export function ModelSelector({ value, onChange }: { value: ModelId; onChange: (m: ModelId) => void }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const current = MODELS.find((m) => m.id === value)!;
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("Choose AI model")}
        onClick={() => setOpen(!open)}
        className="inline-flex h-11.5 items-center gap-2.25 rounded-[13px] border border-line2 bg-s2 pr-3.5 pl-3.25 text-sm font-medium transition hover:border-white/35"
      >
        <span className="size-2 rotate-45 rounded-xs bg-acc" />
        {current.name}
        <Icon n="chev" size={15} className={cn("text-tx3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <button type="button" aria-label={t("Close model menu")} tabIndex={-1} className="fixed inset-0 z-35 cursor-default" onClick={() => setOpen(false)} />
          <div role="listbox" className="absolute top-[calc(100%+12px)] right-0 z-40 w-85 max-w-[calc(100vw-40px)] origin-top-right animate-pop rounded-[18px] border border-line2 bg-[#131315] p-2 shadow-[0_30px_70px_-10px_rgb(0_0_0/0.9)]">
            <div className="px-2.5 pt-2 pb-2.5 font-mono text-[11.5px] uppercase tracking-[0.08em] text-tx3">{t("Choose AI model")}</div>
            {MODELS.map((m) => (
              <button
                key={m.id}
                role="option"
                aria-selected={m.id === value}
                type="button"
                onClick={() => { onChange(m.id); setOpen(false); }}
                className={cn("flex min-h-13 w-full items-center gap-3 rounded-xl px-2.5 py-2.75 text-left transition hover:bg-white/6", m.id === value && "bg-white/5")}
              >
                <span>
                  <b className="block text-[14.5px] font-medium">{m.name}</b>
                  <small className="block text-[12.5px] text-tx3">{t(m.sub)}</small>
                </span>
                {m.id === value && <Icon n="check" className="ml-auto flex-none text-acc" stroke={2.4} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
