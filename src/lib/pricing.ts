/**
 * Single source of truth for pricing. Every displayed figure and every Stripe
 * line item derives from here, so the site and the checkout can never drift.
 *
 * All prices are stored in cents and are the final amount the student pays:
 * nothing is added on top at checkout.
 *
 * TWO PRICES PER PACKAGE (except The Fixer, which charges one)
 * The EU/EEA/Swiss route is less work than the non-EU one and is charged less:
 * no fingerprints, no Modelo 790 Código 012, and where the requirements are met
 * the certificate is normally issued at the appointment itself. A non-EU student
 * needs the EX-17, the biometric appointment, and at some offices a separate
 * collection trip.
 *
 * The route is never asked for twice and never chosen by the student: it is
 * derived from nationality, exactly as the EX-17 / EX-18 decision already is
 * (`selectForm` in forms/field-map.ts). `formId` is stored on every case, so a
 * case's price is always reproducible from the case itself.
 */

export const SERVICE_ROUTES = ["eu", "non-eu"] as const;
export type ServiceRoute = (typeof SERVICE_ROUTES)[number];

export type TierId = "ready-file" | "soft-landing" | "fixer";

export interface Tier {
  id: TierId;
  /** Brand name — identical in every language, and on the invoice. */
  name: string;
  tagline: string;
  /**
   * Final price in euro cents, per route. Nothing is added at checkout. A
   * package may charge the same on both routes (The Fixer); its card then
   * shows one figure.
   */
  priceCents: Record<ServiceRoute, number>;
  /** Shown as "Everything in X, plus:" when set. */
  inherits?: TierId;
  /** The "Most chosen" package. */
  featured?: boolean;
  /**
   * Sold by application, not checkout: its card links to a waitlist
   * application (through triage) instead of /intake.
   */
  waitlist?: boolean;
}

/**
 * Features, taglines and card notes are copy and live in
 * messages/<locale>/pricing.json, taken verbatim from the guide PDF
 * (assets/guide/landing-in-barcelona.pdf, section 13). The PDF and this table
 * must agree figure for figure; tests/pricing.test.ts pins the figures.
 */
export const TIERS: readonly Tier[] = [
  {
    id: "ready-file",
    name: "The Ready File",
    tagline: "The paperwork, finished and in your hands, in 48 hours.",
    priceCents: { eu: 30_000, "non-eu": 36_000 },
  },
  {
    id: "soft-landing",
    name: "The Soft Landing",
    tagline: "The paperwork, plus the cards you should already be holding.",
    priceCents: { eu: 54_000, "non-eu": 60_000 },
    inherits: "ready-file",
    featured: true,
  },
  {
    id: "fixer",
    name: "The Fixer",
    tagline: "Everything above, plus we turn up.",
    priceCents: { eu: 96_000, "non-eu": 96_000 },
    inherits: "soft-landing",
    waitlist: true,
  },
] as const;

/**
 * Package ids as they appear in old `cases.tier_id` rows and in links already
 * sent out. `cases.tier_id` has no CHECK constraint, so historical values are
 * still on disk: resolving them here keeps every existing case priceable and
 * displayable rather than silently becoming "Invalid service tier" at checkout.
 *
 * A Map, not an object literal: `getTier("__proto__")` must be undefined, not
 * Object.prototype.
 */
const LEGACY_TIER_IDS = new Map<string, TierId>([
  ["baseline", "ready-file"],
  ["turnkey", "fixer"],
]);

export function getTier(id: string): Tier | undefined {
  const canonical = LEGACY_TIER_IDS.get(id) ?? id;
  return TIERS.find((t) => t.id === canonical);
}

/** EX-18 is the EU/EEA/Swiss route; EX-17 is everyone else. */
export function routeForForm(formId: string): ServiceRoute {
  return formId === "EX-18" ? "eu" : "non-eu";
}

export function isServiceRoute(value: unknown): value is ServiceRoute {
  return value === "eu" || value === "non-eu";
}

/** The price a given student pays for a given package, in cents. */
export function tierPriceCents(tier: Tier, route: ServiceRoute): number {
  return tier.priceCents[route];
}

/** True when a package charges the same on both routes. */
export function hasSinglePrice(tier: Tier): boolean {
  return tier.priceCents.eu === tier.priceCents["non-eu"];
}

export function formatEur(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
