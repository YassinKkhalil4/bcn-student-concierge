/**
 * Single source of truth for pricing. Every displayed figure and every Stripe
 * line item derives from here, so the site and the checkout can never drift.
 *
 * All base prices are stored in cents, EXCLUSIVE of IVA, per the brief.
 */

export const IVA_RATE = 0.21;

export type TierId = "baseline" | "soft-landing" | "turnkey";

export interface Tier {
  id: TierId;
  name: string;
  tagline: string;
  /** Base price in euro cents, excluding IVA. */
  basePriceCents: number;
  /** Shown as "Everything in X, plus:" when set. */
  inherits?: TierId;
  features: string[];
  bestFor: string;
  featured?: boolean;
}

export const TIERS: readonly Tier[] = [
  {
    id: "baseline",
    name: "The Administrative Baseline",
    tagline: "The legal essentials, correctly filed the first time.",
    basePriceCents: 29_900,
    bestFor: "Students in university housing who need the paperwork handled.",
    features: [
      "Padrón (municipal registration) appointment scheduling",
      "TIE / CUE National Police appointment booking",
      "EX-17 or EX-18 form generation, pre-filled and print-ready",
      "Modelo 790 Código 012 barcoded tax form setup",
      "Pre-checked physical and digital “Ready File” assembly",
    ],
  },
  {
    id: "soft-landing",
    name: "The Digital Soft-Landing",
    tagline: "Paperwork, plus everything that makes the city usable.",
    basePriceCents: 54_000,
    inherits: "baseline",
    featured: true,
    bestFor: "Most first-year international students arriving alone.",
    features: [
      "Spanish bank account setup guidance (non-resident to resident)",
      "T-mobilitat / T-jove transit pass registration",
      "Digital SIM / eSIM selection and activation guidance",
      "Carnet Jove and ISIC student card configuration",
      "Dedicated WhatsApp support line during onboarding",
    ],
  },
  {
    id: "turnkey",
    name: "The Turnkey Relocation & Housing Audit",
    tagline: "We verify the apartment before you wire a deposit.",
    basePriceCents: 110_000,
    inherits: "soft-landing",
    bestFor: "Families securing private housing from abroad, sight unseen.",
    features: [
      "Verified housing sourcing against fraud-screened listings",
      "Landlord registry (Nota Simple) ownership audit",
      "Rental contract review with legal deposit-cap verification",
      "Utility activation guidance (water, electricity, internet)",
      "90-day document tracking through to TIE card collection",
    ],
  },
] as const;

export function getTier(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export interface PriceBreakdown {
  baseCents: number;
  ivaCents: number;
  totalCents: number;
}

/**
 * IVA is computed on the integer cent base and rounded half-up to the cent,
 * matching how Stripe computes exclusive tax on a line item. Never compute
 * this in floating-point euros — 299 * 0.21 is not representable exactly.
 */
export function priceWithIva(baseCents: number): PriceBreakdown {
  const ivaCents = Math.round(baseCents * IVA_RATE);
  return { baseCents, ivaCents, totalCents: baseCents + ivaCents };
}

export function formatEur(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
