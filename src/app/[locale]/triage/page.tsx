import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TriageForm } from "@/components/triage/TriageForm";
import { PageHeader } from "@/components/PageHeader";
import { CheckMark } from "@/components/icons";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "triage.page" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/triage", locale),
  };
}

export default async function TriagePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Triage />;
}

/**
 * The free check. One label rule, on the cover, and none after it: this page
 * has two things on it and neither needs announcing.
 *
 * The form sits in the wider of the two columns because it is the point of the
 * page, and the list beside it answers the only question a student has before
 * filling it in, which is what they get back.
 */
function Triage() {
  const t = useTranslations("triage.page");
  const steps = t.raw("steps") as string[];

  return (
    <>
      <PageHeader label={t("eyebrow")} title={t("title")} intro={t("intro")} />

      <section className="section-band">
        <div className="container-x grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-display-md text-ink">{t("whatYouGet")}</h2>
            <ul className="mt-7 border-t border-paper-edge">
              {steps.map((step) => (
                <li key={step} className="flex gap-4 border-b border-paper-line py-4">
                  <CheckMark className="mt-1 h-3.5 w-3.5 flex-none text-accent" />
                  <span className="prose-body">{step}</span>
                </li>
              ))}
            </ul>
            <p className="mt-7 border-l-2 border-paper-edge pl-4 font-sans text-sm leading-relaxed text-ink-muted">
              {t("declineNote")}
            </p>
          </div>

          <TriageForm />
        </div>

        <div className="container-x mt-16 max-w-4xl">
          <LegalDisclaimer variant="prominent" />
        </div>
      </section>
    </>
  );
}
