import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
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
    default: "BCN Student Concierge — Spanish residency paperwork for students in Barcelona",
    template: "%s · BCN Student Concierge",
  },
  description:
    "We prepare the Spanish residency paperwork international students in Barcelona have to " +
    "get right — the TIE, the padrón, the EX-17 and EX-18 forms, and the appointments. " +
    "Independent, fixed-fee, and always filed in your own name.",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "BCN Student Concierge",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The language of the page being served; staff and API routes are English.
    <html lang={await getLocale()}>
      {/* Page chrome lives in the (site) and admin layouts, so the staff
          dashboard does not inherit the marketing header and footer. */}
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
