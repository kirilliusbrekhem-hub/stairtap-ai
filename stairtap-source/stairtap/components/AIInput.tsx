"use client";

import { useEffect, useRef, useState } from "react";
import { ModelSelector } from "./ModelSelector";
import { SendMark } from "./ui/Logo";
import type { ModelId } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const WORDS = ["idea", "design", "business", "startup", "product", "next big thing"];

interface Props {
  value: string;
  onChange: (v: string) => void;
  model: ModelId;
  onModel: (m: ModelId) => void;
  /** Called after the send animation. */
  onSubmit: () => void;
  onEmpty: () => void;
}

export function AIInput({ value, onChange, model, onModel, onSubmit, onEmpty }: Props) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);
  const [shake, setShake] = useState(false);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % WORDS.length), 2800);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const send = () => {
    if (sending) return;
    if (!value.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      onEmpty();
      return;
    }
    setSending(true);
    timer.current = setTimeout(() => { setSending(false); onSubmit(); }, 450);
  };

  return (
    <div className={cn("relative mt-2 w-full rounded-3xl border border-line2 bg-linear-to-b from-[#131315] to-[#0d0d0f] p-4.5 pb-3.5 text-left shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] transition focus-within:border-white/35 focus-within:shadow-[0_0_0_5px_color-mix(in_srgb,var(--color-acc)_9%,transparent),0_30px_80px_-30px_rgb(0_0_0/0.9)]", shake && "animate-shake")}>
      <div className="relative">
        {!value && (
          <div aria-hidden className="pointer-events-none absolute top-1.5 left-1.5 flex gap-[0.32em] text-xl whitespace-pre text-tx3">
            <span>{t("Describe your")}</span>
            <span className="relative inline-block h-[1.5em] w-[13em] overflow-hidden text-tx2">
              {WORDS.map((w, i) => {
                const d = (i - idx + WORDS.length) % WORDS.length;
                return <span key={w} className={cn("ph-w", d === 0 && "ph-in", d === WORDS.length - 1 && "ph-out")}>{t(w)}</span>;
              })}
            </span>
          </div>
        )}
        <textarea
          rows={4}
          aria-label={t("Describe your idea")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="block min-h-31 w-full resize-none border-0 bg-transparent px-1.5 pt-1.5 text-xl leading-[1.5] caret-acc outline-none"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="hidden font-mono text-xs text-tx3 sm:block">{t("Enter to build · Shift+Enter for a new line")}</span>
        <div className="ml-auto flex items-center gap-2.5">
          <ModelSelector value={model} onChange={onModel} />
          <button
            type="button"
            onClick={send}
            aria-label={t("Build my startup")}
            className={cn(
              "grid size-13.5 place-items-center overflow-hidden rounded-[15px] border transition hover:-translate-y-px hover:scale-105 hover:shadow-[0_0_0_4px_rgb(255_255_255/0.05),0_10px_30px_-6px_color-mix(in_srgb,var(--color-acc)_55%,transparent)] active:scale-90 [&_svg]:transition-transform hover:[&_svg]:-translate-y-0.5",
              value.trim() ? "border-acc bg-acc text-accfg" : "border-line2 bg-s3 text-tx2 hover:text-tx",
              sending && "send-go",
            )}
          >
            <SendMark />
          </button>
        </div>
      </div>
    </div>
  );
}
