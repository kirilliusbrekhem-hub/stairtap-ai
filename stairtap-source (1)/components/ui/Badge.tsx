import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ProjectStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

const base = "inline-flex h-6.5 items-center gap-1.75 rounded-full border px-2.5 font-mono text-[11.5px] uppercase tracking-[0.06em]";

export function Badge({ children, tone = "plain", className }: { children: ReactNode; tone?: "plain" | "pro" | "soft"; className?: string }) {
  return (
    <span className={cn(base, tone === "plain" && "border-line text-tx2", tone === "pro" && "border-acc bg-acc text-accfg", tone === "soft" && "border-acc/40 text-acc", className)}>
      {children}
    </span>
  );
}

const DOT: Record<ProjectStatus, string> = {
  Draft: "bg-tx3",
  Building: "bg-warn animate-pulse2",
  Live: "bg-acc",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useI18n();
  return (
    <span className={cn(base, "border-line text-tx2")}>
      <i className={cn("size-1.5 rounded-full", DOT[status])} />
      {t(status)}
    </span>
  );
}
