import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TIERS } from "@/lib/pricing";
import { PricingCard } from "@/components/PricingCard";
import { PageHeader } from "@/components/PageHeader";
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

/**
 * The price list.
 *
 * Three label rules on this page, no more: the cover, the honest notes, and
 * what is not included. The guarantee, the routes note and the government-fee
 * section used to carry one each, which turned six different arguments into
 * six identical-looking blocks.
 *
 * The two long note lists are deliberately NOT the same component. "What we
 * are honest about" is a ruled two-column register a reader works down; "not
 * included" is a set of short blocks they scan. Making both a divided
 * definition list is what made the bottom half of this page unreadable.
 */
function Pricing() {
  const t = useTranslations("pricing.page");
  const tt = useTranslations("triage");
  const exclusions = t.raw("exclusions") as { item: string; note: string }[];
  const honest = t.raw("honest") as { item: string; note: string }[];
  return (
    <>
      <PageHeader label={t("eyebrow")} title={t("title")} intro={t("intro")} />

      {/* Triage before the price list: someone out of time should not have to
          pick a package to find out where they stand. */}
      <section className="border-b border-paper-line bg-paper-dim">
        <div className="container-x flex flex-wrap items-center justify-between gap-6 py-7">
          <div className="max-w-xl">
            <h2 className="text-display-sm text-ink">{tt("cta.title")}</h2>
            <p className="prose-body mt-2">{tt("cta.note")}</p>
          </div>
          <Link href="/triage" className="btn-primary">
            {tt("cta.button")}
          </Link>
        </div>
      </section>

      {/* The spread. Columns divided by hairlines so the price rows line up
          across all three and can be read against each other. */}
      <section className="section-band">
        <div className="container-x">
          <div className="grid border-t-2 border-ink lg:grid-cols-3">
            {TIERS.map((tier) => (
              <PricingCard key={tier.id} tier={tier} />
            ))}
          </div>
          <p className="prose-body measure mt-8">{t("feesNote")}</p>

          {/*
            The six-week refund was a paragraph inside the "before you choose"
            list, three screens below the price cards — the strongest argument
            on the page, filed where nobody reads it. It belongs beside the
            prices, and it is the only block here allowed a crimson cap rule.
          */}
          <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16">
            <div className="border-t-3 border-accent bg-white p-7 sm:p-8">
              <h2 className="text-display-md text-ink">{t("guaranteeTitle")}</h2>
              <p className="prose-body mt-4">{t("guaranteeBody")}</p>
            </div>
            <div className="border-t border-paper-edge pt-7">
              <h2 className="text-display-sm text-ink">{t("routesTitle")}</h2>
              <p className="prose-body mt-3">{t("routesBody")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* The notes that prevent complaints, stated before purchase rather than
          discovered at a bank counter. A register: term on the left, the plain
          truth about it on the right. */}
      <section className="border-t border-paper-line section">
        <div className="container-x">
          <div className="max-w-3xl">
            <p className="rule-label">{t("honestEyebrow")}</p>
            <h2 className="mt-5 text-display-lg text-ink">{t("honestTitle")}</h2>
          </div>
          <dl className="mt-12 max-w-4xl border-t-2 border-ink">
            {honest.map((row) => (
              <div
                key={row.item}
                className="grid gap-2 border-b border-paper-line py-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-10"
              >
                <dt className="font-sans text-sm font-bold tracking-tight text-ink">{row.item}</dt>
                <dd className="prose-body">{row.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-y border-paper-line bg-paper-dim section">
        <div className="container-x">
          <h2 className="max-w-2xl text-display-lg text-ink">{t("govTitle")}</h2>
          <div className="mt-10 max-w-3xl">
            <Modelo790Notice />
          </div>
        </div>
      </section>

      {/* Not included. Short blocks, scanned rather than read — a second
          divided register here would put the reader to sleep. */}
      <section className="section">
        <div className="container-x">
          <div className="max-w-3xl">
            <p className="rule-label">{t("exclusionsEyebrow")}</p>
            <h2 className="mt-5 text-display-lg text-ink">{t("exclusionsTitle")}</h2>
          </div>
          <div className="mt-12 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {exclusions.map((row) => (
              <div key={row.item} className="border-t border-paper-edge pt-5">
                <h3 className="font-sans text-sm font-bold tracking-tight text-ink">{row.item}</h3>
                <p className="prose-body mt-2.5">{row.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 max-w-4xl">
            <LegalDisclaimer variant="prominent" />
          </div>
        </div>
      </section>
    </>
  );
}
