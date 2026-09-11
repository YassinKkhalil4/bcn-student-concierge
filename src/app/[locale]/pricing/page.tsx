import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TIERS, IVA_RATE } from "@/lib/pricing";
import { PricingCard } from "@/components/PricingCard";
import { Modelo790Notice } from "@/components/Modelo790Notice";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "pricing.page" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Pricing />;
}

function Pricing() {
  const t = useTranslations("pricing.page");
  const exclusions = t.raw("exclusions") as { item: string; note: string }[];
  return (
    <>
      <section className="border-b border-bone-line bg-bone-warm">
        <div className="container-x py-16 sm:py-20">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
            {t("intro", { rate: Math.round(IVA_RATE * 100) })}
          </p>
        </div>
      </section>

      <section className="container-x py-16 sm:py-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <PricingCard key={tier.id} tier={tier} />
          ))}
        </div>
      </section>

      <section className="border-y border-bone-line bg-bone-warm py-16 sm:py-20">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow">{t("govEyebrow")}</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">{t("govTitle")}</h2>
          </div>
          <div className="mt-10 max-w-3xl">
            <Modelo790Notice />
          </div>
        </div>
      </section>

      <section className="container-x py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">{t("exclusionsEyebrow")}</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">{t("exclusionsTitle")}</h2>
        </div>
        <dl className="mt-10 max-w-3xl divide-y divide-bone-line border-y border-bone-line">
          {exclusions.map((row) => (
            <div key={row.item} className="grid gap-2 py-5 sm:grid-cols-3 sm:gap-6">
              <dt className="font-medium text-ink">{row.item}</dt>
              <dd className="text-sm leading-relaxed text-ink-muted sm:col-span-2">{row.note}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-12 max-w-3xl">
          <LegalDisclaimer variant="prominent" />
        </div>
      </section>
    </>
  );
}
