/**
 * Single source of truth for pricing. Every displayed figure and every Stripe
 * line item derives from here, so the site and the checkout can never drift.
 *
 * All prices are stored in cents and are EX-IVA: the figure on the site is the
 * taxable base. Spanish IVA (21 %) is added at checkout as its own line, and
 * the factura shows base, IVA and total — see `ivaCents` and `grossCents`.
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

export type TierId = "ready-file" | "soft-landing";

export interface Tier {
  id: TierId;
  /** Brand name — identical in every language, and on the invoice. */
  name: string;
  tagline: string;
  /**
   * Price in euro cents, per route, EX-IVA. A package may charge the same on
   * both routes; its card then shows one figure.
   */
  priceCents: Record<ServiceRoute, number>;
  /** Shown as "Everything in X, plus:" when set. */
  inherits?: TierId;
  /** The "Most chosen" package. */
  featured?: boolean;
}

/**
 * Features, taglines and card notes are copy and live in
 * messages/<locale>/pricing.json; tests/pricing.test.ts pins the figures.
 */
export const TIERS: readonly Tier[] = [
  {
    id: "ready-file",
    name: "The Ready File",
    tagline: "The paperwork, finished and in your hands, in 48 hours.",
    priceCents: { eu: 4_900, "non-eu": 7_900 },
  },
  {
    id: "soft-landing",
    name: "The Soft Landing",
    tagline: "The paperwork, plus the cards you should already be holding.",
    priceCents: { eu: 9_900, "non-eu": 14_900 },
    inherits: "ready-file",
    featured: true,
  },
] as const;

/**
 * Optional extras, ticked at checkout. Each is one price on both routes and is
 * delivered digitally (an app account, a wallet card or a QR code), so it can
 * be fulfilled remotely. Prices are EX-IVA, like the packages.
 *
 * Copy (what we deliver, how it arrives) is in messages/<locale>/pricing.json
 * under `addons.items.<id>`.
 */
export const ADDON_IDS = ["t-jove", "carnet-jove", "isic", "esim"] as const;
export type AddonId = (typeof ADDON_IDS)[number];

export interface Addon {
  id: AddonId;
  /** Brand/product name — identical in every language, and on the invoice. */
  name: string;
  priceCents: number;
}

export const ADDONS: readonly Addon[] = [
  { id: "t-jove", name: "T-jove Transit Pass (90 days)", priceCents: 6_500 },
  { id: "carnet-jove", name: "Carnet Jove Activation", priceCents: 1_900 },
  { id: "isic", name: "ISIC Digital Student ID", priceCents: 2_000 },
  { id: "esim", name: "Spanish eSIM Setup (+34 number)", priceCents: 2_500 },
] as const;

export function getAddon(id: string): Addon | undefined {
  return ADDONS.find((a) => a.id === id);
}

/**
 * Resolve a list of add-on ids that came from outside (a request body, Stripe
 * metadata, a database row). Returns null if ANY id is unknown, so a tampered
 * list is refused rather than quietly shortened. Duplicates collapse, and the
 * result is in catalogue order so the same selection always produces the same
 * invoice description and the same Stripe metadata.
 */
export function resolveAddons(ids: unknown): Addon[] | null {
  if (!Array.isArray(ids)) return null;
  if (!ids.every((id): id is string => typeof id === "string")) return null;
  const wanted = new Set(ids);
  const found = ADDONS.filter((a) => wanted.has(a.id));
  return found.length === wanted.size ? found : null;
}

/** Spanish IVA on these services, in basis points (21.00 %). */
export const IVA_RATE_BP = 2100;

/** IVA on an ex-IVA amount, rounded to the cent. */
export function ivaCents(baseCents: number): number {
  return Math.round((baseCents * IVA_RATE_BP) / 10_000);
}

/** What the student pays for a package and add-ons: base + IVA. */
export function totalCents(
  tier: Tier,
  route: ServiceRoute,
  addons: readonly Addon[] = [],
): { baseCents: number; ivaCents: number; grossCents: number } {
  const baseCents = tierPriceCents(tier, route) + addons.reduce((n, a) => n + a.priceCents, 0);
  const iva = ivaCents(baseCents);
  return { baseCents, ivaCents: iva, grossCents: baseCents + iva };
}

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
  // The Fixer was retired; its cases resolve to the nearest package so they
  // stay displayable. Amounts already invoiced are never recomputed from here.
  ["turnkey", "soft-landing"],
  ["fixer", "soft-landing"],
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
