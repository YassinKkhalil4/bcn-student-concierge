import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  TIERS,
  formatEur,
  hasSinglePrice,
  tierPriceCents,
  SERVICE_ROUTES,
  type ServiceRoute,
  type Tier,
} from "@/lib/pricing";

interface Feature {
  title: string;
  body: string;
  /** A second paragraph under the body. */
  extra?: string;
  /** Sub-points, shown as an arrow list. */
  details?: string[];
}

/** Tags the package copy may use — it is the guide PDF's copy, verbatim. */
export const PRICING_TAGS = {
  strong: (chunks: ReactNode) => <strong className="font-semibold text-ink">{chunks}</strong>,
  em: (chunks: ReactNode) => <em>{chunks}</em>,
  code: (chunks: ReactNode) => <code className="font-mono text-[0.92em]">{chunks}</code>,
  warn: (chunks: ReactNode) => <span className="text-terracotta">{chunks}</span>,
};

/**
 * A package, priced on both routes.
 *
 * Both prices are always shown, because the public page cannot know the
 * reader's nationality and guessing would quote half of them the wrong figure.
 * Which one applies is settled at triage, before anyone pays. A package that
 * charges the same on both routes shows the one figure.
 *
 * `compact` (the home page) lists only each feature's heading; the full text
 * is on /pricing. The figures are the same component either way, so the two
 * pages cannot disagree.
 */
export function PricingCard({ tier, compact = false }: { tier: Tier; compact?: boolean }) {
  const t = useTranslations("pricing");
  const key = (k: string) => `tiers.${tier.id}.${k}`;
  const features = t.raw(key("features")) as Feature[];
  const number = String(TIERS.findIndex((x) => x.id === tier.id) + 1).padStart(2, "0");
  const routeLabel: Record<ServiceRoute, string> = {
    eu: t("card.routeEu"),
    "non-eu": t("card.routeNonEu"),
  };
  const badge = tier.waitlist ? t("card.waitlist") : tier.featured ? t("card.mostChosen") : null;

  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border p-7 transition-shadow",
        tier.featured ? "border-olive bg-white shadow-lg shadow-olive/5" : "border-bone-line bg-white/60 hover:shadow-md",
      ].join(" ")}
    >
      {badge && (
        <span
          className={[
            "absolute -top-3 left-7 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
            tier.waitlist ? "border border-terracotta/40 bg-bone text-terracotta" : "bg-olive text-bone",
          ].join(" ")}
        >
          {badge}
        </span>
      )}

      <p className="font-mono text-xs font-semibold text-ink-soft">{number}</p>
      <h3 className="mt-1 font-display text-xl font-semibold text-ink">{t(key("name"))}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t(key("tagline"))}</p>
      {t.has(key("note")) && (
        <p className="mt-3 text-sm italic leading-relaxed text-terracotta">{t(key("note"))}</p>
      )}

      <dl className="mt-6 divide-y divide-bone-line border-y border-bone-line">
        {(hasSinglePrice(tier) ? [null] : SERVICE_ROUTES).map((route) => (
          <div key={route ?? "both"} className="flex items-baseline justify-between gap-3 py-4">
            <dt className="text-xs font-medium uppercase tracking-wider text-ink-soft">
              {route ? routeLabel[route] : t("card.bothRoutes")}
            </dt>
            <dd className="font-display text-2xl font-semibold text-ink">
              {formatEur(tierPriceCents(tier, route ?? "eu"))}
            </dd>
          </div>
        ))}
      </dl>

      {t.has(key("includes")) && (
        <p className="mt-4 rounded-lg bg-olive/5 px-4 py-3 text-xs leading-relaxed text-ink-muted">
          {t.rich(key("includes"), PRICING_TAGS)}
        </p>
      )}

      {tier.inherits && (
        <p className="mt-5 text-sm font-medium text-olive">
          {t("card.everythingIn", { name: t(`tiers.${tier.inherits}.name`) })}
        </p>
      )}

      <ul className={`mt-4 space-y-3 ${tier.inherits ? "" : "mt-5"}`}>
        {features.map((feature, i) => (
          <li key={feature.title} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 flex-none text-olive-light" fill="currentColor">
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
            </svg>
            <div className="min-w-0">
              {compact ? (
                <span>{feature.title.replace(/\.$/, "")}</span>
              ) : (
                <FeatureText t={t} base={`${key("features")}.${i}`} feature={feature} />
              )}
            </div>
          </li>
        ))}
      </ul>

      {!compact && t.has(key("never")) && (
        <p className="mt-5 text-sm leading-relaxed text-ink">{t.rich(key("never"), PRICING_TAGS)}</p>
      )}
      {!compact && t.has(key("delivery")) && (
        <p className="mt-5 text-sm leading-relaxed text-ink-muted">{t.rich(key("delivery"), PRICING_TAGS)}</p>
      )}

      {!compact && (
        <p className="mt-6 rounded-lg bg-bone-warm px-4 py-3 text-xs leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">{t("card.bestFor")} </span>
          {t(key("bestFor"))}
        </p>
      )}

      <div className="mt-auto pt-7">
        {tier.waitlist ? (
          // By application: the waitlist goes through triage, never checkout.
          <Link href={{ pathname: "/triage", query: { apply: tier.id } }} className="btn-secondary w-full">
            {t("card.applyWaitlist")}
          </Link>
        ) : (
          <Link
            href={{ pathname: "/intake", query: { tier: tier.id } }}
            className={tier.featured ? "btn-primary w-full" : "btn-secondary w-full"}
          >
            {t("card.select", { name: t(key("shortName")) })}
          </Link>
        )}
      </div>
    </div>
  );
}

type Translator = ReturnType<typeof useTranslations<"pricing">>;

function FeatureText({ t, base, feature }: { t: Translator; base: string; feature: Feature }) {
  return (
    <>
      <strong className="font-semibold text-ink">{feature.title}</strong>{" "}
      {t.rich(`${base}.body`, PRICING_TAGS)}
      {feature.extra !== undefined && <span className="mt-2 block">{t.rich(`${base}.extra`, PRICING_TAGS)}</span>}
      {feature.details && (
        <ul className="mt-2 space-y-1.5">
          {feature.details.map((detail, j) => (
            <li key={detail} className="flex gap-2">
              <span aria-hidden="true" className="text-terracotta">→</span>
              <span>{t(`${base}.details.${j}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
