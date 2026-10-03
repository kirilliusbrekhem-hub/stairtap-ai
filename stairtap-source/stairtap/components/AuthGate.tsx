"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

const PUBLIC = ["/", "/login", "/pricing", "/legal", "/reset"];

/** Sends signed-out visitors to /login for private pages. Home, login and pricing stay public. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useStore();
  const path = usePathname().replace(/\/$/, "") || "/";
  const router = useRouter();
  const isPublic = PUBLIC.includes(path);

  useEffect(() => {
    if (status === "anon" && !isPublic) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [status, isPublic, path, router]);

  if (!isPublic && status !== "authed") return <div className="grid min-h-[60vh] place-items-center"><span className="size-2 animate-pulse2 rounded-full bg-acc" aria-label="Loading" /></div>;
  return <>{children}</>;
}
