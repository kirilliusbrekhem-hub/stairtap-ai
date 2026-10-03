import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { I18nProvider } from "@/lib/i18n";
import { AuthGate } from "@/components/AuthGate";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Toast } from "@/components/Toast";
import { CreditsModal, PayModal, UpgradeModal } from "@/components/Overlays";

export const metadata: Metadata = {
  title: "STAIRTAP — Just build on AI",
  description: "You bring the idea. AI builds the startup.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Sora:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        <I18nProvider>
          <StoreProvider>
            <Navbar />
            <AuthGate>{children}</AuthGate>
            <Footer />
            <UpgradeModal />
            <CreditsModal />
            <PayModal />
            <Toast />
          </StoreProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
