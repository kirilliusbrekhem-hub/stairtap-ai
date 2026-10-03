"use client";

import { useEffect, type ReactNode } from "react";
import { IconButton } from "./Button";
import { Icon } from "./Icon";
import { useI18n } from "@/lib/i18n";

export function Modal({ label, onClose, children }: { label: string; onClose?: () => void; children: ReactNode }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-60 grid animate-fade place-items-center bg-black/70 p-5 backdrop-blur-[7px]" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="relative max-h-[92vh] w-full max-w-125 animate-pop2 overflow-auto rounded-[26px] border border-line2 bg-[#111113] p-8.5">
        {onClose && (
          <IconButton className="absolute top-3.5 right-3.5" aria-label={t("Close")} onClick={onClose}>
            <Icon n="x" />
          </IconButton>
        )}
        {children}
      </div>
    </div>
  );
}
