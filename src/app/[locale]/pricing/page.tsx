import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TIERS } from "@/lib/pricing";
import { PricingCard } from "@/components/PricingCard";
import { Modelo790Notice } from "@/components/Modelo790Notice";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { JsonLd } from "@/components/JsonLd";
import { alternatesFor } from "@/lib/seo";
import { breadcrumbs, graph, organization, serviceOffers } from "@/lib/structured-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing.page" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/pricing", locale),
  };
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tc = await getTranslations({ locale, namespace: "common" });
  const tp = await getTranslations({ locale, namespace: "pricing" });
  const th = await getTranslations({ locale, namespace: "home" });
  const tierCopy = Object.fromEntries(
    TIERS.map((tier) => [tier.id, { name: tp(`tiers.${tier.id}.name`), tagline: tp(`tiers.${tier.id}.tagline`) }]),
  );

  return (
    <>
      <JsonLd
        json={graph(
          organization(tc("brand"), th("metaDescription")),
          serviceOffers(tierCopy, locale),
          breadcrumbs(
            [
              { name: tc("brand"), page: "/" },
              { name: tp("page.eyebrow"), page: "/pricing" },
            ],
            locale,
          ),
        )}
      />
      <Pricing />
    </>
  );
}

function Pricing() {
  const t = useTranslations("pricing.page");
  const tt = useTranslations("triage");
  const exclusions = t.raw("exclusions") as { item: string; note: string }[];
  const honest = t.raw("honest") as { item: string; note: string }[];
  return (
    <>
      <section className="border-b border-bone-line bg-bone-warm">
        <div className="container-x py-16 sm:py-20">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
            {t("intro")}
          </p>
        </div>
      </section>

      {/* Triage before the price list: someone out of time should not have to
          pick a package to find out where they stand. */}
      <section className="border-b border-bone-line bg-olive/5">
        <div className="container-x flex flex-wrap items-center justify-between gap-6 py-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl font-semibold text-ink">{tt("cta.title")}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{tt("cta.note")}</p>
          </div>
          <Link href="/triage" className="btn-primary">
            {tt("cta.button")}
          </Link>
        </div>
      </section>

      <section className="container-x py-16 sm:py-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <PricingCard key={tier.id} tier={tier} />
          ))}
        </div>
        <p className="mt-8 text-sm text-ink-muted">{t("feesNote")}</p>

        {/*
          The six-week refund was a paragraph inside the "before you choose"
          list, three screens below the price cards — the strongest argument on
          the page, filed where nobody reads it. It belongs beside the prices.
        */}
        <div className="mt-14 max-w-3xl rounded-2xl border border-olive-light/40 bg-olive/5 p-7">
          <p className="eyebrow">{t("guaranteeEyebrow")}</p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">
            {t("guaranteeTitle")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("guaranteeBody")}</p>
        </div>

        <div className="mt-8 max-w-3xl rounded-2xl border border-bone-line bg-bone-warm p-7">
          <p className="eyebrow">{t("routesEyebrow")}</p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">
            {t("routesTitle")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("routesBody")}</p>
        </div>
      </section>

      {/* The notes that prevent complaints, stated before purchase rather than
          discovered at a bank counter. */}
      <section className="border-t border-bone-line py-16 sm:py-20">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow">{t("honestEyebrow")}</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
              {t("honestTitle")}
            </h2>
          </div>
          <dl className="mt-10 max-w-3xl divide-y divide-bone-line border-y border-bone-line">
            {honest.map((row) => (
              <div key={row.item} className="grid gap-2 py-5 sm:grid-cols-3 sm:gap-6">
                <dt className="font-medium text-ink">{row.item}</dt>
                <dd className="text-sm leading-relaxed text-ink-muted sm:col-span-2">{row.note}</dd>
              </div>
            ))}
          </dl>
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
