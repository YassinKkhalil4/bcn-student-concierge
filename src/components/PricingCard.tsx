import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckMark, ArrowMark } from "@/components/icons";
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
  warn: (chunks: ReactNode) => <span className="text-accent-deep">{chunks}</span>,
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
 *
 * SHAPE: this is a column in a ruled spread, not a floating card. The box,
 * the shadow and the radius were carrying no information — the prices are what
 * distinguish these three, and columns let the price rows line up across the
 * spread so they can actually be read against each other. The chosen package
 * is marked by ground and weight instead of by elevation.
 */
export function PricingCard({ tier, compact = false }: { tier: Tier; compact?: boolean }) {
  const t = useTranslations("pricing");
  const key = (k: string) => `tiers.${tier.id}.${k}`;
  const features = t.raw(key("features")) as Feature[];
  const index = TIERS.findIndex((x) => x.id === tier.id);
  const number = String(index + 1).padStart(2, "0");
  const routeLabel: Record<ServiceRoute, string> = {
    eu: t("card.routeEu"),
    "non-eu": t("card.routeNonEu"),
  };
  const badge = tier.waitlist ? t("card.waitlist") : tier.featured ? t("card.mostChosen") : null;

  return (
    <div
      className={[
        "relative flex flex-col px-0 py-8 lg:px-8 lg:py-10",
        // Hairlines between columns on the spread; stacked rules on mobile.
        "border-b border-paper-line lg:border-b-0 lg:border-r lg:last:border-r-0",
        // The featured column is marked by its ground and a crimson cap rule,
        // never by a drop shadow.
        tier.featured ? "bg-paper-dim lg:-mt-px lg:border-t-3 lg:border-t-accent" : "",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-sm font-medium text-accent">{number}</p>
        {badge && (
          <p
            className={[
              "font-sans text-[0.625rem] font-bold uppercase tracking-[0.16em]",
              tier.waitlist ? "text-ink-soft" : "text-accent-deep",
            ].join(" ")}
          >
            {badge}
          </p>
        )}
      </div>

      <h3 className="mt-4 text-display-md text-ink">{t(key("name"))}</h3>
      <p className="prose-body mt-3">{t(key("tagline"))}</p>
      {t.has(key("note")) && (
        <p className="mt-4 border-l-2 border-accent pl-3.5 font-sans text-sm leading-relaxed text-accent-deep">
          {t(key("note"))}
        </p>
      )}

      {/* Tabular figures, so the euro amounts align down the spread. */}
      <dl className="mt-7 border-t-2 border-ink">
        {(hasSinglePrice(tier) ? [null] : SERVICE_ROUTES).map((route) => (
          <div
            key={route ?? "both"}
            className="flex items-baseline justify-between gap-3 border-b border-paper-line py-3.5"
          >
            <dt className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-soft">
              {route ? routeLabel[route] : t("card.bothRoutes")}
            </dt>
            <dd className="font-sans text-2xl font-extrabold tabular-nums tracking-tight text-ink">
              {formatEur(tierPriceCents(tier, route ?? "eu"))}
            </dd>
          </div>
        ))}
      </dl>

      {t.has(key("includes")) && (
        <p className="mt-5 border-l-2 border-paper-edge pl-3.5 font-sans text-xs leading-relaxed text-ink-muted">
          {t.rich(key("includes"), PRICING_TAGS)}
        </p>
      )}

      {tier.inherits && (
        <p className="mt-6 font-sans text-sm font-bold text-ink">
          {t("card.everythingIn", { name: t(`tiers.${tier.inherits}.name`) })}
        </p>
      )}

      <ul className={`space-y-3.5 ${tier.inherits ? "mt-4" : "mt-6"}`}>
        {features.map((feature, i) => (
          <li key={feature.title} className="flex gap-3 font-sans text-sm leading-relaxed text-ink-muted">
            <CheckMark className="mt-1 h-3.5 w-3.5 flex-none text-accent" />
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
        <p className="mt-6 font-sans text-sm leading-relaxed text-ink">{t.rich(key("never"), PRICING_TAGS)}</p>
      )}
      {!compact && t.has(key("delivery")) && (
        <p className="prose-body mt-6">{t.rich(key("delivery"), PRICING_TAGS)}</p>
      )}

      {!compact && (
        <p className="mt-7 border-t border-paper-line pt-5 font-sans text-xs leading-relaxed text-ink-muted">
          <span className="font-bold uppercase tracking-[0.12em] text-ink">{t("card.bestFor")} </span>
          {t(key("bestFor"))}
        </p>
      )}

      <div className="mt-auto pt-8">
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
        <ul className="mt-2.5 space-y-1.5">
          {feature.details.map((detail, j) => (
            <li key={detail} className="flex gap-2.5">
              <ArrowMark className="mt-1 h-3 w-3 flex-none text-accent" />
              <span>{t(`${base}.details.${j}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
