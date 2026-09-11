import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntakeWizard } from "@/components/intake/IntakeWizard";

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
  setRequestLocale((await params).locale);
  const [query, t] = await Promise.all([searchParams, getTranslations("intake.page")]);

  return (
    <div className="container-x py-14 sm:py-20">
      <div className="max-w-2xl">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">{t("intro")}</p>
      </div>

      <div className="mt-12">
        {/* The tier from the query string is untrusted input. It is validated
            against the tier table inside the wizard, and again server-side at
            checkout, where the price is read from the table rather than the URL. */}
        <IntakeWizard initialTier={query.tier ?? "soft-landing"} />
      </div>
    </div>
  );
}
