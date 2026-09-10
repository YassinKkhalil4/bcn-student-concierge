import type { Metadata } from "next";
import "@/styles/globals.css";

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
