import Link from "next/link";
import { formatEur, priceWithIva, getTier, type Tier } from "@/lib/pricing";

export function PricingCard({ tier, compact = false }: { tier: Tier; compact?: boolean }) {
  const { baseCents, ivaCents, totalCents } = priceWithIva(tier.basePriceCents);
  const parent = tier.inherits ? getTier(tier.inherits) : undefined;

  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border p-7 transition-shadow",
        tier.featured
          ? "border-olive bg-white shadow-lg shadow-olive/5"
          : "border-bone-line bg-white/60 hover:shadow-md",
      ].join(" ")}
    >
      {tier.featured && (
        <span className="absolute -top-3 left-7 rounded-full bg-olive px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-bone">
          Most chosen
        </span>
      )}

      <h3 className="font-display text-xl font-semibold text-ink">{tier.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{tier.tagline}</p>

      <div className="mt-6 border-y border-bone-line py-5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-semibold text-ink">
            {formatEur(baseCents)}
          </span>
          <span className="text-sm text-ink-soft">+ IVA</span>
        </div>
        {/*
          Both figures are shown. Quoting only the ex-IVA price is the standard
          way this category surprises parents at checkout; the total is what
          actually leaves their card.
        */}
        <p className="mt-2 text-xs text-ink-soft">
          {formatEur(ivaCents)} IVA (21%) ·{" "}
          <span className="font-semibold text-ink-muted">
            {formatEur(totalCents)} total
          </span>
        </p>
      </div>

      {parent && (
        <p className="mt-5 text-sm font-medium text-olive">
          Everything in {parent.name}, plus:
        </p>
      )}

      <ul className={`mt-4 space-y-3 ${parent ? "" : "mt-5"}`}>
        {tier.features.map((feature) => (
          <li key={feature} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="mt-0.5 h-4 w-4 flex-none text-olive-light"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {!compact && (
        <p className="mt-6 rounded-lg bg-bone-warm px-4 py-3 text-xs leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">Best for: </span>
          {tier.bestFor}
        </p>
      )}

      <div className="mt-auto pt-7">
        <Link
          href={`/intake?tier=${tier.id}`}
          className={tier.featured ? "btn-primary w-full" : "btn-secondary w-full"}
        >
          Select {tier.name.replace(/^The /, "")}
        </Link>
      </div>
    </div>
  );
}
