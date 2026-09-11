import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DocumentLang } from "@/components/DocumentLang";

const OG_LOCALE: Record<string, string> = {
  en: "en_GB",
  es: "es_ES",
  ca: "ca_ES",
  fr: "fr_FR",
  it: "it_IT",
  de: "de_DE",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    description: t("metaDescription"),
    openGraph: { type: "website", locale: OG_LOCALE[locale] ?? "en_GB", siteName: "BCN Student Concierge" },
  };
}

/** Public site: one of the six languages, with the site's header and footer. */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // "/pt/pricing" and friends: not a language we offer, so not a page.
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <NextIntlClientProvider messages={await getMessages()}>
      <DocumentLang />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4
                   focus:z-50 focus:rounded-lg focus:bg-olive focus:px-4 focus:py-2
                   focus:text-sm focus:text-bone"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}
