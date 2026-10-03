"use client";

import { Icon } from "./ui/Icon";
import { useStore } from "@/lib/store";

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-7 left-1/2 z-80 flex max-w-[calc(100vw-32px)] animate-toast items-center gap-2.5 rounded-[13px] bg-tx px-4.5 py-3 text-sm font-medium text-[#0a0a0b] shadow-[0_20px_50px_-10px_rgb(0_0_0/0.7)]">
      <Icon n="check" size={16} stroke={2.6} />
      {toast}
    </div>
  );
}
