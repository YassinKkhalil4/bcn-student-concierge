import { describe, it, expect } from "vitest";
import { TIERS, priceWithIva, formatEur, getTier, IVA_RATE } from "../src/lib/pricing";
import { buildLineItems } from "../src/lib/server/stripe";

describe("IVA calculation", () => {
  it("computes 21% on the advertised tier prices", () => {
    expect(priceWithIva(29_900)).toEqual({
      baseCents: 29_900,
      ivaCents: 6_279,
      totalCents: 36_179,
    });
    expect(priceWithIva(54_000)).toEqual({
      baseCents: 54_000,
      ivaCents: 11_340,
      totalCents: 65_340,
    });
    expect(priceWithIva(110_000)).toEqual({
      baseCents: 110_000,
      ivaCents: 23_100,
      totalCents: 133_100,
    });
  });

  it("returns whole cents, never fractional currency", () => {
    for (const tier of TIERS) {
      const p = priceWithIva(tier.basePriceCents);
      expect(Number.isInteger(p.ivaCents)).toBe(true);
      expect(Number.isInteger(p.totalCents)).toBe(true);
      expect(p.baseCents + p.ivaCents).toBe(p.totalCents);
    }
  });

  it("rounds half-up at the cent, matching Stripe's exclusive-tax behaviour", () => {
    // 1.005 EUR base -> 21.105 cents IVA -> 21
    expect(priceWithIva(101).ivaCents).toBe(21);
  });
});

describe("tier table", () => {
  it("matches the advertised ex-IVA prices exactly", () => {
    expect(getTier("baseline")?.basePriceCents).toBe(29_900);
    expect(getTier("soft-landing")?.basePriceCents).toBe(54_000);
    expect(getTier("turnkey")?.basePriceCents).toBe(110_000);
  });

  it("declares the inheritance chain used by the 'everything in X' copy", () => {
    expect(getTier("baseline")?.inherits).toBeUndefined();
    expect(getTier("soft-landing")?.inherits).toBe("baseline");
    expect(getTier("turnkey")?.inherits).toBe("soft-landing");
  });

  it("returns undefined for an unknown tier id rather than a default", () => {
    // Checkout relies on this: an unknown tier must not silently price as the
    // cheapest package.
    expect(getTier("free")).toBeUndefined();
    expect(getTier("__proto__")).toBeUndefined();
  });
});

describe("Stripe line items", () => {
  it("states base and IVA as separate lines, as a Spanish invoice requires", () => {
    const items = buildLineItems(getTier("turnkey")!);
    expect(items).toHaveLength(2);
    expect(items[0]!.price_data!.unit_amount).toBe(110_000);
    expect(items[1]!.price_data!.unit_amount).toBe(23_100);
    expect(items[1]!.price_data!.product_data!.name).toMatch(/IVA/);
  });

  it("charges in euro", () => {
    for (const item of buildLineItems(getTier("baseline")!)) {
      expect(item.price_data!.currency).toBe("eur");
    }
  });

  it("sums to the total shown to the customer", () => {
    const tier = getTier("soft-landing")!;
    const total = buildLineItems(tier).reduce(
      (sum, i) => sum + (i.price_data!.unit_amount ?? 0),
      0,
    );
    expect(total).toBe(priceWithIva(tier.basePriceCents).totalCents);
  });
});

describe("formatting", () => {
  it("renders euro amounts for a Spanish locale", () => {
    // Non-breaking space before the symbol in es-ES; normalise before asserting.
    expect(formatEur(29_900).replace(/ /g, " ")).toBe("299 €");
    expect(formatEur(36_179).replace(/ /g, " ")).toBe("361,79 €");
  });

  it("uses the statutory Spanish rate", () => {
    expect(IVA_RATE).toBe(0.21);
  });
});
