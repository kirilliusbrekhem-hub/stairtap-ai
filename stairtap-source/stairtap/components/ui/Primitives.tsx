import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("font-mono text-[11.5px] uppercase tracking-[0.08em] text-tx3", className)}>{children}</div>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[18px] border border-line bg-s1 p-5.5 text-left", className)}>{children}</div>;
}

export function Bar({ value, accent, className }: { value: number; accent?: boolean; className?: string }) {
  return (
    <div className={cn("h-1 overflow-hidden rounded bg-white/9", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <i className={cn("block h-full rounded transition-[width] duration-900 ease-out", accent ? "bg-acc" : "bg-tx")} style={{ width: `${value}%` }} />
    </div>
  );
}

export function Chip({ children, on, onClick, icon }: { children: ReactNode; on?: boolean; onClick?: () => void; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center gap-1.75 rounded-full border px-3.75 text-[13.5px] transition",
        on ? "border-acc bg-acc font-medium text-accfg" : "border-line bg-white/3 text-tx2 hover:border-line2 hover:bg-white/6 hover:text-tx",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Seg<T extends string>({ options, value, onChange, label, render }: { options: readonly T[]; value: T; onChange: (v: T) => void; label?: string; render?: (o: T) => string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-[13px] border border-line bg-s2 p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn("h-11 rounded-[9px] px-3.5 text-[13.5px] font-medium transition md:h-9", o === value ? "bg-tx text-[#0a0a0b]" : "text-tx2 hover:text-tx")}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-7.5 w-12.5 flex-none rounded-full border transition before:absolute before:-inset-2 before:content-[''] after:absolute after:top-1 after:size-5 after:rounded-full after:transition-all after:content-['']", on ? "border-acc bg-acc after:left-6 after:bg-accfg" : "border-line2 bg-s3 after:left-1 after:bg-tx2")}
    />
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="my-7 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === value}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn("relative inline-flex h-11.5 items-center gap-2 px-3.5 text-sm whitespace-nowrap transition after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:content-['']", t.id === value ? "text-tx after:bg-acc" : "text-tx2 hover:text-tx")}
        >
          {t.label}
          {t.count !== undefined && <em className="font-mono text-[11px] not-italic text-tx3">{t.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-[22px] border border-dashed border-line2 px-6 py-16 text-center">
      <div className="font-display text-[22px] font-semibold tracking-tight">{title}</div>
      <p className="max-w-95 text-tx2">{text}</p>
      {action}
    </div>
  );
}

export function LockRow({ label, tag = "Pro", onClick }: { label: string; tag?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-13 w-full items-center gap-3 rounded-[14px] border border-dashed border-line2 bg-white/2 px-4 py-3 text-left text-[14.5px] text-tx2 transition hover:border-white/40 hover:bg-white/4 hover:text-tx">
      <Icon n="lock" className="flex-none text-acc" />
      {label}
      <small className="ml-auto text-xs text-tx3">{tag}</small>
    </button>
  );
}

export function Skeleton({ w = "100%", className }: { w?: string; className?: string }) {
  return <div className={cn("sk", className)} style={{ width: w }} />;
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow?: ReactNode; title: ReactNode; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div>
        {eyebrow && <div className="mb-3">{eyebrow}</div>}
        <h1 className="font-display text-[clamp(28px,4.2vw,46px)] leading-[1.08] font-semibold tracking-[-0.03em]">{title}</h1>
        {sub && <p className="mt-3.5 max-w-150 text-[17px] text-tx2">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
