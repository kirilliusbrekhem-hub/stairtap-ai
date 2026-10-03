"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./ui/Logo";
import { Bolt } from "./ui/Icon";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/ideas", label: "Ideas" },
  { href: "/generations", label: "Generations" },
  { href: "/pricing", label: "Pricing" },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/build") || path.startsWith("/result");
  return path.startsWith(href);
}

export function Navbar() {
  const path = usePathname();
  const { left, prefs, setCreditsOpen, status, user } = useStore();
  const { t, lang, setLang } = useI18n();
  const initials = (user?.name || user?.email || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-310 flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-2.5 md:h-17 md:flex-nowrap md:gap-7 md:px-6 md:py-0">
        <Link href="/" aria-label="STAIRTAP" className="flex min-h-11 items-center">
          <Logo height={24} />
        </Link>
        <nav aria-label={t("Main")} className="order-3 flex w-full gap-0.5 overflow-x-auto pb-1 md:order-none md:w-auto md:flex-1 md:pb-0">
          {LINKS.map((l) => {
            const on = isActive(path, l.href);
            return (
              <Link key={l.href} href={l.href} className={cn("relative flex h-11 items-center rounded-[10px] px-3.5 text-sm whitespace-nowrap transition hover:bg-white/5 hover:text-tx", on ? "text-tx after:absolute after:inset-x-3.5 after:bottom-1 after:h-0.5 after:rounded after:bg-acc after:content-['']" : "text-tx2")}>
                {t(l.label)}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <button type="button" onClick={() => setLang(lang === "ru" ? "en" : "ru")} aria-label={t("Language")} className="h-10 rounded-full border border-line2 px-3 font-mono text-xs uppercase tracking-[0.06em] text-tx2 transition hover:border-white/35 hover:text-tx">
            {lang === "ru" ? "EN" : "RU"}
          </button>
          {status === "authed" ? (
            <>
              {prefs.showCredits && (
                <button type="button" onClick={() => setCreditsOpen(true)} aria-label={t("Generations remaining")} className="inline-flex h-10 items-center gap-1.75 rounded-full border border-line2 bg-s1 pr-3.5 pl-2.75 text-[13px] font-medium transition hover:border-white/35 active:scale-95">
                  <Bolt className="text-acc" />
                  {left}<span className="hidden sm:inline">{t("generations")}</span>
                </button>
              )}
              <Link href="/profile" aria-label={t("Profile")} className="grid size-10 place-items-center rounded-full border border-line2 bg-s3 font-display text-[13px] font-semibold transition hover:border-white/40">
                {initials}
              </Link>
            </>
          ) : status === "anon" ? (
            <Link href="/login" className="inline-flex h-10 items-center rounded-full border border-tx bg-tx px-4 text-[13px] font-medium text-[#0a0a0b] transition hover:bg-white">{t("Sign in")}</Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
