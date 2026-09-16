import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatEur, tierPriceCents, SERVICE_ROUTES, type ServiceRoute, type Tier } from "@/lib/pricing";

/**
 * A package, priced on both routes.
 *
 * Both prices are always shown, because the public page cannot know the
 * reader's nationality and guessing would quote half of them the wrong figure.
 * Which one applies is settled at triage, before anyone pays.
 */
export function PricingCard({ tier, compact = false }: { tier: Tier; compact?: boolean }) {
  const t = useTranslations("pricing");
  const features = t.raw(`tiers.${tier.id}.features`) as string[];
  const routeLabel: Record<ServiceRoute, string> = {
    eu: t("card.routeEu"),
    "non-eu": t("card.routeNonEu"),
  };

  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border p-7 transition-shadow",
        tier.featured ? "border-olive bg-white shadow-lg shadow-olive/5" : "border-bone-line bg-white/60 hover:shadow-md",
      ].join(" ")}
    >
      {tier.featured && (
        <span className="absolute -top-3 left-7 rounded-full bg-olive px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-bone">
          {t("card.mostChosen")}
        </span>
      )}

      <h3 className="font-display text-xl font-semibold text-ink">{t(`tiers.${tier.id}.name`)}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t(`tiers.${tier.id}.tagline`)}</p>

      <dl className="mt-6 divide-y divide-bone-line border-y border-bone-line">
        {SERVICE_ROUTES.map((route) => (
          <div key={route} className="flex items-baseline justify-between gap-3 py-4">
            <dt className="text-xs font-medium uppercase tracking-wider text-ink-soft">{routeLabel[route]}</dt>
            <dd className="font-display text-2xl font-semibold text-ink">{formatEur(tierPriceCents(tier, route))}</dd>
          </div>
        ))}
      </dl>

      {tier.includedCardsCents !== undefined && (
        <p className="mt-4 rounded-lg bg-olive/5 px-4 py-3 text-xs leading-relaxed text-ink-muted">
          {t("card.includesCards", { amount: formatEur(tier.includedCardsCents) })}
        </p>
      )}

      {tier.inherits && (
        <p className="mt-5 text-sm font-medium text-olive">
          {t("card.everythingIn", { name: t(`tiers.${tier.inherits}.name`) })}
        </p>
      )}

      <ul className={`mt-4 space-y-3 ${tier.inherits ? "" : "mt-5"}`}>
        {features.map((feature) => (
          <li key={feature} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 flex-none text-olive-light" fill="currentColor">
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {!compact && (
        <p className="mt-6 rounded-lg bg-bone-warm px-4 py-3 text-xs leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">{t("card.bestFor")} </span>
          {t(`tiers.${tier.id}.bestFor`)}
        </p>
      )}

      <div className="mt-auto pt-7">
        <Link
          href={{ pathname: "/intake", query: { tier: tier.id } }}
          className={tier.featured ? "btn-primary w-full" : "btn-secondary w-full"}
        >
          {t("card.select", { name: t(`tiers.${tier.id}.shortName`) })}
        </Link>
      </div>
    </div>
  );
}
