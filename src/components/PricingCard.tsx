import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatEur, priceWithIva, type Tier } from "@/lib/pricing";

export function PricingCard({ tier, compact = false }: { tier: Tier; compact?: boolean }) {
  const t = useTranslations("pricing");
  const { baseCents, ivaCents, totalCents } = priceWithIva(tier.basePriceCents);
  const features = t.raw(`tiers.${tier.id}.features`) as string[];

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

      <div className="mt-6 border-y border-bone-line py-5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-semibold text-ink">{formatEur(baseCents)}</span>
          <span className="text-sm text-ink-soft">{t("card.plusIva")}</span>
        </div>
        {/*
          Both figures are shown. Quoting only the ex-IVA price is the standard
          way this category surprises parents at checkout; the total is what
          actually leaves their card.
        */}
        <p className="mt-2 text-xs text-ink-soft">
          {t.rich("card.ivaLine", {
            iva: formatEur(ivaCents),
            total: formatEur(totalCents),
            strong: (chunks) => <span className="font-semibold text-ink-muted">{chunks}</span>,
          })}
        </p>
      </div>

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
