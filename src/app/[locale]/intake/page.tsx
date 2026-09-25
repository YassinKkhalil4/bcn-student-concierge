import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { CLIENT_NAMESPACES, pick } from "@/i18n/messages";
import { IntakeWizard } from "@/components/intake/IntakeWizard";
import { WorkHeader } from "@/components/PageHeader";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "intake.meta" });
  return {
    title: t("title"),
    description: t("description"),
    // The intake portal must never appear in search results or be archived:
    // it is a form that collects passport data.
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [query, t, messages] = await Promise.all([
    searchParams,
    getTranslations("intake.page"),
    getMessages(),
  ]);

  return (
    <NextIntlClientProvider locale={locale} messages={pick(messages, CLIENT_NAMESPACES.intake)}>
      <div className="container-x py-14 sm:py-20">
        {/* Paper with a cap rule, not cover stock: this is the interior of the
            file, and a student who has already decided is not being sold to. */}
        <WorkHeader label={t("eyebrow")} title={t("title")} intro={t("intro")} />

        <div className="mt-14">
          {/* The tier from the query string is untrusted input. It is validated
              against the tier table inside the wizard, and again server-side at
              checkout, where the price is read from the table rather than the URL. */}
          <IntakeWizard initialTier={query.tier ?? "soft-landing"} />
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
