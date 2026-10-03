import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("mx-auto max-w-310 animate-rise px-4 pt-7 pb-24 md:px-6 md:pt-11 md:pb-28", className)}>{children}</main>;
}
