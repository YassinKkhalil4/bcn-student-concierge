import { describe, it, expect } from "vitest";
import { tierIdSchema } from "../src/lib/schema";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  TIERS,
  SERVICE_ROUTES,
  tierPriceCents,
  hasSinglePrice,
  formatEur,
  getTier,
  routeForForm,
  isServiceRoute,
} from "../src/lib/pricing";
import { routeForNationality } from "../src/lib/forms/field-map";
import { buildLineItems } from "../src/lib/server/stripe";

describe("tier table", () => {
  it("matches the advertised final prices exactly, per route", () => {
    expect(getTier("ready-file")?.priceCents).toEqual({ eu: 30_000, "non-eu": 36_000 });
    expect(getTier("soft-landing")?.priceCents).toEqual({ eu: 54_000, "non-eu": 60_000 });
    expect(getTier("fixer")?.priceCents).toEqual({ eu: 96_000, "non-eu": 96_000 });
  });

  it("stores whole cents, never fractional currency", () => {
    for (const tier of TIERS) {
      for (const route of SERVICE_ROUTES) {
        expect(Number.isInteger(tierPriceCents(tier, route)), `${tier.id} ${route}`).toBe(true);
      }
    }
  });

  it("never charges more for the EU route, and only The Fixer charges one price", () => {
    // The EU route is less work — no fingerprints, no Modelo 790 — and the
    // table must never drift into charging more for it.
    for (const tier of TIERS) {
      expect(tierPriceCents(tier, "eu"), tier.id).toBeLessThanOrEqual(tierPriceCents(tier, "non-eu"));
      expect(hasSinglePrice(tier), tier.id).toBe(tier.id === "fixer");
    }
  });

  it("sells The Fixer by waitlist only", () => {
    expect(TIERS.filter((t) => t.waitlist).map((t) => t.id)).toEqual(["fixer"]);
    expect(TIERS.filter((t) => t.featured).map((t) => t.id)).toEqual(["soft-landing"]);
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

  it("never mentions tax in the package copy: prices are final", () => {
    // Every language's pricing catalogue, which is all the pricing display renders.
    for (const locale of ["en", "es", "ca", "fr", "it", "de"]) {
      const text = readFileSync(path.join(process.cwd(), "messages", locale, "pricing.json"), "utf8");
      expect(text, locale).not.toMatch(/\b(IVA|VAT|TVA|MwSt|IVA)\b/);
    }
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
  it("charges the published price as a single line, with nothing added on top", () => {
    for (const tier of TIERS) {
      for (const route of SERVICE_ROUTES) {
        const items = buildLineItems(tier, route);
        expect(items, `${tier.id} ${route}`).toHaveLength(1);
        expect(items[0]!.price_data!.unit_amount, `${tier.id} ${route}`).toBe(tierPriceCents(tier, route));
      }
    }
  });

  it("charges the route's own price, not a single list price", () => {
    expect(buildLineItems(getTier("fixer")!, "eu")[0]!.price_data!.unit_amount).toBe(96_000);
    expect(buildLineItems(getTier("ready-file")!, "eu")[0]!.price_data!.unit_amount).toBe(30_000);
    expect(buildLineItems(getTier("ready-file")!, "non-eu")[0]!.price_data!.unit_amount).toBe(36_000);
  });

  it("charges in euro", () => {
    for (const item of buildLineItems(getTier("ready-file")!, "eu")) {
      expect(item.price_data!.currency).toBe("eur");
    }
  });
});

describe("formatting", () => {
  it("renders euro amounts for a Spanish locale", () => {
    // es-ES puts a narrow no-break space before the symbol; normalise the
    // whole no-break family to a plain space before asserting.
    const plain = (cents: number) => formatEur(cents).replace(/[\u00A0\u202F]/g, " ");
    expect(plain(30_000)).toBe("300 €");
    expect(plain(18_029)).toBe("180,29 €");
  });
});

/*
  The intake schema once carried its own hand-written list of package ids. It
  fell behind this table when the packages were renamed, and the effect was
  silent: the pricing page happily linked to /intake?tier=ready-file, the wizard
  collected every answer, and the submission was refused at the last step with
  "some answers need correcting" — pointing the student at fields that were all
  valid. The Ready File could not be bought at all. These tests fail if the two
  ever drift apart again.
*/
describe("the intake schema accepts exactly the packages on sale", () => {
  it("accepts every package in this table", () => {
    for (const tier of TIERS) {
      const parsed = tierIdSchema.safeParse(tier.id);
      expect(parsed.success, `${tier.id} must be a valid tierId`).toBe(true);
      expect(parsed.success && parsed.data).toBe(tier.id);
    }
  });

  it("still accepts the ids used in links sent out before the rename", () => {
    expect(tierIdSchema.parse("baseline")).toBe("ready-file");
    expect(tierIdSchema.parse("turnkey")).toBe("fixer");
  });

  it("refuses anything that is not a package", () => {
    for (const value of ["", "gold", "__proto__", "constructor"]) {
      expect(tierIdSchema.safeParse(value).success, `${value} must be refused`).toBe(false);
    }
  });
});
