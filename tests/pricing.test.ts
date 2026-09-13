import { describe, it, expect } from "vitest";
import {
  TIERS,
  SERVICE_ROUTES,
  priceWithIva,
  tierPrice,
  tierPriceCents,
  formatEur,
  getTier,
  routeForForm,
  isServiceRoute,
  IVA_RATE,
} from "../src/lib/pricing";
import { routeForNationality } from "../src/lib/forms/field-map";
import { buildLineItems } from "../src/lib/server/stripe";

describe("IVA calculation", () => {
  it("computes 21% on the advertised ex-IVA prices, on both routes", () => {
    // The six figures published on the pricing page, to the cent.
    expect(priceWithIva(14_900)).toEqual({ baseCents: 14_900, ivaCents: 3_129, totalCents: 18_029 });
    expect(priceWithIva(19_900)).toEqual({ baseCents: 19_900, ivaCents: 4_179, totalCents: 24_079 });
    expect(priceWithIva(32_900)).toEqual({ baseCents: 32_900, ivaCents: 6_909, totalCents: 39_809 });
    expect(priceWithIva(37_900)).toEqual({ baseCents: 37_900, ivaCents: 7_959, totalCents: 45_859 });
    expect(priceWithIva(69_900)).toEqual({ baseCents: 69_900, ivaCents: 14_679, totalCents: 84_579 });
    expect(priceWithIva(79_900)).toEqual({ baseCents: 79_900, ivaCents: 16_779, totalCents: 96_679 });
  });

  it("returns whole cents, never fractional currency", () => {
    for (const tier of TIERS) {
      for (const route of SERVICE_ROUTES) {
        const p = tierPrice(tier, route);
        expect(Number.isInteger(p.ivaCents)).toBe(true);
        expect(Number.isInteger(p.totalCents)).toBe(true);
        expect(p.baseCents + p.ivaCents).toBe(p.totalCents);
      }
    }
  });

  it("rounds half-up at the cent, matching Stripe's exclusive-tax behaviour", () => {
    // 1.005 EUR base -> 21.105 cents IVA -> 21
    expect(priceWithIva(101).ivaCents).toBe(21);
  });
});

describe("tier table", () => {
  it("matches the advertised ex-IVA prices exactly, per route", () => {
    expect(getTier("ready-file")?.basePriceCents).toEqual({ eu: 14_900, "non-eu": 19_900 });
    expect(getTier("soft-landing")?.basePriceCents).toEqual({ eu: 32_900, "non-eu": 37_900 });
    expect(getTier("fixer")?.basePriceCents).toEqual({ eu: 69_900, "non-eu": 79_900 });
  });

  it("prices the EU route below the non-EU one on every package", () => {
    // The EU route is less work — no fingerprints, no Modelo 790 — and the
    // table must never drift into charging more for it.
    for (const tier of TIERS) {
      expect(tierPriceCents(tier, "eu"), tier.id).toBeLessThan(tierPriceCents(tier, "non-eu"));
    }
  });

  it("declares the inheritance chain used by the 'everything in X' copy", () => {
    expect(getTier("ready-file")?.inherits).toBeUndefined();
    expect(getTier("soft-landing")?.inherits).toBe("ready-file");
    expect(getTier("fixer")?.inherits).toBe("soft-landing");
  });

  it("resolves the pre-v3 package ids still stored on existing cases", () => {
    // cases.tier_id has no CHECK constraint, so rows created before the
    // rename are still on disk. They must stay priceable, not become
    // "Invalid service tier" at checkout.
    expect(getTier("baseline")?.id).toBe("ready-file");
    expect(getTier("turnkey")?.id).toBe("fixer");
    expect(getTier("soft-landing")?.id).toBe("soft-landing");
  });

  it("returns undefined for an unknown tier id rather than a default", () => {
    // Checkout relies on this: an unknown tier must not silently price as the
    // cheapest package.
    expect(getTier("free")).toBeUndefined();
    expect(getTier("__proto__")).toBeUndefined();
    expect(getTier("constructor")).toBeUndefined();
  });

  it("states what the cards-and-travel tiers include", () => {
    expect(getTier("ready-file")?.includedCardsCents).toBeUndefined();
    expect(getTier("soft-landing")?.includedCardsCents).toBe(7_500);
    expect(getTier("fixer")?.includedCardsCents).toBe(7_500);
  });
});

describe("service route", () => {
  it("follows the form the student files, so price and paperwork cannot disagree", () => {
    expect(routeForForm("EX-18")).toBe("eu");
    expect(routeForForm("EX-17")).toBe("non-eu");
  });

  it("treats an unknown form as non-EU rather than granting the cheaper price", () => {
    expect(routeForForm("")).toBe("non-eu");
    expect(routeForForm("EX-99")).toBe("non-eu");
  });

  it("derives the same route from nationality as the form does", () => {
    expect(routeForNationality("FR")).toBe("eu");
    expect(routeForNationality("DE")).toBe("eu");
    expect(routeForNationality("NO")).toBe("eu"); // EEA
    expect(routeForNationality("CH")).toBe("eu"); // Switzerland
    expect(routeForNationality("US")).toBe("non-eu");
    expect(routeForNationality("IN")).toBe("non-eu");
    expect(routeForNationality("GB")).toBe("non-eu"); // post-Brexit
  });

  it("recognises only the two routes", () => {
    expect(isServiceRoute("eu")).toBe(true);
    expect(isServiceRoute("non-eu")).toBe(true);
    expect(isServiceRoute("EU")).toBe(false);
    expect(isServiceRoute(undefined)).toBe(false);
  });
});

describe("Stripe line items", () => {
  it("states base and IVA as separate lines, as a Spanish invoice requires", () => {
    const items = buildLineItems(getTier("fixer")!, "non-eu");
    expect(items).toHaveLength(2);
    expect(items[0]!.price_data!.unit_amount).toBe(79_900);
    expect(items[1]!.price_data!.unit_amount).toBe(16_779);
    expect(items[1]!.price_data!.product_data!.name).toMatch(/IVA/);
  });

  it("charges the route's own price, not a single list price", () => {
    expect(buildLineItems(getTier("fixer")!, "eu")[0]!.price_data!.unit_amount).toBe(69_900);
    expect(buildLineItems(getTier("fixer")!, "non-eu")[0]!.price_data!.unit_amount).toBe(79_900);
  });

  it("charges in euro", () => {
    for (const item of buildLineItems(getTier("ready-file")!, "eu")) {
      expect(item.price_data!.currency).toBe("eur");
    }
  });

  it("sums to the total shown to the customer, on both routes", () => {
    for (const tier of TIERS) {
      for (const route of SERVICE_ROUTES) {
        const total = buildLineItems(tier, route).reduce(
          (sum, i) => sum + (i.price_data!.unit_amount ?? 0),
          0,
        );
        expect(total, `${tier.id} ${route}`).toBe(tierPrice(tier, route).totalCents);
      }
    }
  });
});

describe("formatting", () => {
  it("renders euro amounts for a Spanish locale", () => {
    // es-ES puts a narrow no-break space before the symbol; normalise the
    // whole no-break family to a plain space before asserting.
    const plain = (cents: number) => formatEur(cents).replace(/[\u00A0\u202F]/g, " ");
    expect(plain(14_900)).toBe("149 €");
    expect(plain(18_029)).toBe("180,29 €");
  });

  it("uses the statutory Spanish rate", () => {
    expect(IVA_RATE).toBe(0.21);
  });
});
