"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-310 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-[13px] text-tx3 md:px-6">
        <span>© {new Date().getFullYear()} STAIRTAP</span>
        <nav className="flex flex-wrap gap-x-5" aria-label={t("Legal")}>
          <Link className="inline-flex h-9 items-center transition hover:text-tx" href="/legal#terms">{t("Terms")}</Link>
          <Link className="inline-flex h-9 items-center transition hover:text-tx" href="/legal#privacy">{t("Privacy")}</Link>
          <Link className="inline-flex h-9 items-center transition hover:text-tx" href="/legal#refunds">{t("Refunds")}</Link>
        </nav>
      </div>
    </footer>
  );
}
