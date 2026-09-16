/**
 * Single source of truth for pricing. Every displayed figure and every Stripe
 * line item derives from here, so the site and the checkout can never drift.
 *
 * All prices are stored in cents and are the final amount the student pays:
 * nothing is added on top at checkout.
 *
 * TWO PRICES PER PACKAGE
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
  /** Final price in euro cents, per route. Nothing is added at checkout. */
  priceCents: Record<ServiceRoute, number>;
  /** Shown as "Everything in X, plus:" when set. */
  inherits?: TierId;
  /**
   * Cards and travel we buy and hand over (T-mobilitat + T-jove, Carnet Jove,
   * ISIC), in cents. Shown so the fee reads against what is inside it.
   */
  includedCardsCents?: number;
  features: string[];
  bestFor: string;
  featured?: boolean;
}

export const TIERS: readonly Tier[] = [
  {
    id: "ready-file",
    name: "The Ready File",
    tagline: "The paperwork, finished and in your hands, in 48 hours.",
    priceCents: { eu: 30_000, "non-eu": 36_000 },
    bestFor: "Students who can run their own appointments once the file is right.",
    features: [
      "Route confirmed against your own authorisation and entry stamp",
      "EX-17 or EX-18 generated, flattened and print-ready",
      "Modelo 790 Código 012 configured for cash, with a named branch",
      "Padrón file prepared for the council you actually live in",
      "Padrón and TIE/CUE appointments searched and booked in your name",
      "Every copy made, collated, and audited against the official list",
    ],
  },
  {
    id: "soft-landing",
    name: "The Soft Landing",
    tagline: "The paperwork, plus the cards you should already be holding.",
    priceCents: { eu: 54_000, "non-eu": 60_000 },
    inherits: "ready-file",
    includedCardsCents: 7_500,
    featured: true,
    bestFor: "Most students who landed in the last few weeks.",
    features: [
      "T-mobilitat card in your name with 90 days loaded (T-jove under 30)",
      "Carnet Jove applied for, paid, and chased through activation",
      "ISIC card bought and issued against your enrolment evidence",
      "A bank account that receives money from home — or why you need none",
      "SIM or eSIM matched to real usage, 28-day renewal trap explained",
      "A WhatsApp line for 30 days, and a live line during your appointment",
    ],
  },
  {
    id: "fixer",
    name: "The Fixer",
    tagline: "Everything above, plus we turn up.",
    priceCents: { eu: 96_000, "non-eu": 99_900 },
    inherits: "soft-landing",
    includedCardsCents: 7_500,
    bestFor: "Students stuck on the padrón, or still signing for a flat.",
    features: [
      "We come to the town hall with you and translate",
      "The padrón unlock: hostels, sublets, refusing landlords, wrong council",
      "Health card and a local GP who speaks English, once the padrón is through",
      "Same-day contract review before you sign, and registry ownership check",
      "Move-in condition report, photographed and sent the same day",
      "90-day tracking through to collection, and a completion report",
    ],
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

export function formatEur(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
