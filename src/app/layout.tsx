import type { Metadata } from "next";
import "@/styles/globals.css";

/**
 * Every page renders per request. This is REQUIRED by the nonce-based CSP in
 * src/middleware.ts: a page pre-rendered at build time is sent without the
 * per-request nonce on its scripts, and the browser then blocks all of them.
 * (That happened: /, /pricing and the legal pages shipped with 0 of 12
 * scripts nonced until this line was added.) tests/csp.test.ts guards it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_ORIGIN ?? "https://bcnstudent.com"),
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
      {/* Page chrome lives in the (site) and admin layouts, so the staff
          dashboard does not inherit the marketing header and footer. */}
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
