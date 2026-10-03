import { cn } from "@/lib/cn";
import { Icon } from "./ui/Icon";

export function AIProgress({ steps, active, className }: { steps: { label: string; detail?: string }[]; active: number; className?: string }) {
  return (
    <ol className={cn("m-0 flex list-none flex-col p-0", className)}>
      {steps.map((s, i) => {
        const done = i < active;
        const now = i === active;
        return (
          <li key={s.label} className={cn("flex items-start gap-3.75 py-2.75 transition-colors duration-400", done ? "text-tx2" : now ? "text-tx" : "text-tx3")}>
            <span className={cn("mt-px grid size-5.5 flex-none place-items-center rounded-full border-[1.5px] transition-colors duration-400", done ? "border-acc bg-acc text-accfg" : now ? "border-acc" : "border-line2")}>
              {done && <Icon n="check" size={13} stroke={3.2} />}
              {now && <span className="size-2 animate-pulse2 rounded-full bg-acc" />}
            </span>
            <div>
              <div className="text-base font-medium">{s.label}</div>
              {now && s.detail && <div className="mt-0.5 animate-rise text-[13.5px] text-tx3">{s.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
