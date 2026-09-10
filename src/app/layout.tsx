import type { Metadata } from "next";
import "@/styles/globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_ORIGIN ?? "https://bcnstudentconcierge.com"),
  title: {
    default: "BCN Student Concierge — Frictionless Arrivals in Barcelona",
    template: "%s · BCN Student Concierge",
  },
  description:
    "Independent administrative facilitation for international university students " +
    "arriving in Barcelona. Padrón, TIE/CUE appointments, and document preparation.",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "BCN Student Concierge",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4
                     focus:z-50 focus:rounded-lg focus:bg-olive focus:px-4 focus:py-2
                     focus:text-sm focus:text-bone"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
