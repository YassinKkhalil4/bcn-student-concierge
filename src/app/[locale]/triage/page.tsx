import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TriageForm } from "@/components/triage/TriageForm";
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

function Triage() {
  const t = useTranslations("triage.page");
  const steps = t.raw("steps") as string[];

  return (
    <>
      <section className="border-b border-bone-line bg-bone-warm">
        <div className="container-x py-16 sm:py-20">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">{t("intro")}</p>
        </div>
      </section>

      <section className="container-x py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{t("whatYouGet")}</h2>
            <ul className="mt-6 space-y-4">
              {steps.map((step) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 flex-none text-olive-light" fill="currentColor">
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                  </svg>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 rounded-lg bg-bone-warm px-4 py-3 text-sm leading-relaxed text-ink-muted">
              {t("declineNote")}
            </p>
          </div>

          <TriageForm />
        </div>

        <div className="mt-16 max-w-3xl">
          <LegalDisclaimer variant="prominent" />
        </div>
      </section>
    </>
  );
}
