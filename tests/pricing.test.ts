import { describe, it, expect } from "vitest";
import { tierIdSchema } from "../src/lib/schema";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ADDONS,
  ADDON_IDS,
  TIERS,
  SERVICE_ROUTES,
  getAddon,
  ivaCents,
  resolveAddons,
  totalCents,
  tierPriceCents,
  hasSinglePrice,
  formatEur,
  getTier,
  routeForForm,
  isServiceRoute,
} from "../src/lib/pricing";
import { routeForNationality } from "../src/lib/forms/field-map";
import { buildLineItems } from "../src/lib/server/stripe";
import { splitGross } from "../src/lib/invoicing/numbering";

describe("tier table", () => {
  it("matches the advertised prices exactly, per route, ex-IVA", () => {
    expect(getTier("ready-file")?.priceCents).toEqual({ eu: 4_900, "non-eu": 7_900 });
    expect(getTier("soft-landing")?.priceCents).toEqual({ eu: 9_900, "non-eu": 14_900 });
  });

  it("sells exactly two packages", () => {
    expect(TIERS.map((t) => t.id)).toEqual(["ready-file", "soft-landing"]);
  });

  it("stores whole cents, never fractional currency", () => {
    for (const tier of TIERS) {
      for (const route of SERVICE_ROUTES) {
        expect(Number.isInteger(tierPriceCents(tier, route)), `${tier.id} ${route}`).toBe(true);
      }
    }
    for (const addon of ADDONS) expect(Number.isInteger(addon.priceCents), addon.id).toBe(true);
  });

  it("never charges more for the EU route", () => {
    // The EU route is less work — no fingerprints, no Modelo 790 — and the
    // table must never drift into charging more for it.
    for (const tier of TIERS) {
      expect(tierPriceCents(tier, "eu"), tier.id).toBeLessThanOrEqual(tierPriceCents(tier, "non-eu"));
      expect(hasSinglePrice(tier), tier.id).toBe(false);
    }
  });

  it("marks The Soft Landing as the most chosen, and nothing as waitlist-only", () => {
    expect(TIERS.filter((t) => t.featured).map((t) => t.id)).toEqual(["soft-landing"]);
  });

  it("declares the inheritance chain used by the 'everything in X' copy", () => {
    expect(getTier("ready-file")?.inherits).toBeUndefined();
    expect(getTier("soft-landing")?.inherits).toBe("ready-file");
  });

  it("resolves the earlier package ids still stored on existing cases", () => {
    // cases.tier_id has no CHECK constraint, so rows created before the
    // renames are still on disk. They must stay priceable, not become
    // "Invalid service tier" at checkout.
    expect(getTier("baseline")?.id).toBe("ready-file");
    expect(getTier("soft-landing")?.id).toBe("soft-landing");
    // The Fixer was retired; its cases resolve to the nearest package.
    expect(getTier("turnkey")?.id).toBe("soft-landing");
    expect(getTier("fixer")?.id).toBe("soft-landing");
  });

  it("returns undefined for an unknown tier id rather than a default", () => {
    // Checkout relies on this: an unknown tier must not silently price as the
    // cheapest package.
    expect(getTier("free")).toBeUndefined();
    expect(getTier("__proto__")).toBeUndefined();
    expect(getTier("constructor")).toBeUndefined();
  });

  it("says in every language that the prices are ex-IVA", () => {
    // The figures are the taxable base; IVA is added at checkout. A language
    // that dropped the label would quote a price lower than the one charged.
    for (const locale of ["en", "es", "ca", "fr", "it", "de"]) {
      const pricing = JSON.parse(
        readFileSync(path.join(process.cwd(), "messages", locale, "pricing.json"), "utf8"),
      ) as { card: { exIva: string } };
      expect(pricing.card.exIva, locale).toMatch(/IVA/);
    }
  });
});

describe("add-ons", () => {
  it("matches the advertised prices exactly, ex-IVA", () => {
    expect(Object.fromEntries(ADDONS.map((a) => [a.id, a.priceCents]))).toEqual({
      "t-jove": 6_500,
      "carnet-jove": 1_900,
      isic: 2_000,
      esim: 2_500,
    });
    expect(ADDONS.map((a) => a.id)).toEqual([...ADDON_IDS]);
  });

  it("resolves a list of ids in catalogue order, collapsing duplicates", () => {
    expect(resolveAddons([])?.map((a) => a.id)).toEqual([]);
    expect(resolveAddons(["esim", "t-jove", "esim"])?.map((a) => a.id)).toEqual(["t-jove", "esim"]);
  });

  it("refuses a list containing anything that is not an add-on, rather than shortening it", () => {
    expect(resolveAddons(["t-jove", "free-laptop"])).toBeNull();
    expect(resolveAddons(["__proto__"])).toBeNull();
    expect(resolveAddons("t-jove")).toBeNull();
    expect(resolveAddons([1])).toBeNull();
    expect(resolveAddons(undefined)).toBeNull();
  });

  it("looks up by id and not by prototype", () => {
    expect(getAddon("isic")?.priceCents).toBe(2_000);
    expect(getAddon("constructor")).toBeUndefined();
  });
});

describe("IVA", () => {
  it("is 21 % on the base, rounded to the cent", () => {
    expect(ivaCents(4_900)).toBe(1_029);
    expect(ivaCents(7_900)).toBe(1_659);
    expect(ivaCents(0)).toBe(0);
  });

  it("totals package, add-ons and IVA", () => {
    const soft = getTier("soft-landing")!;
    expect(totalCents(soft, "eu")).toEqual({ baseCents: 9_900, ivaCents: 2_079, grossCents: 11_979 });
    const everything = ADDONS.map((a) => a.id);
    expect(totalCents(soft, "non-eu", resolveAddons(everything)!)).toEqual({
      baseCents: 14_900 + 6_500 + 1_900 + 2_000 + 2_500,
      ivaCents: ivaCents(27_800),
      grossCents: 27_800 + ivaCents(27_800),
    });
  });

  it("splits back into the same base on the invoice, for every possible basket", () => {
    // Stripe collects base + IVA; the factura is issued from that total by
    // splitGross. If the two roundings ever disagreed by a cent the invoice
    // would show a base the student was never quoted.
    const subsets = 1 << ADDONS.length;
    for (const tier of TIERS) {
      for (const route of SERVICE_ROUTES) {
        for (let mask = 0; mask < subsets; mask++) {
          const addons = ADDONS.filter((_, i) => mask & (1 << i));
          const t = totalCents(tier, route, addons);
          const split = splitGross(t.grossCents);
          expect(split.baseCents, `${tier.id} ${route} ${addons.map((a) => a.id)}`).toBe(t.baseCents);
          expect(split.ivaCents).toBe(t.ivaCents);
        }
      }
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
  const amounts = (items: ReturnType<typeof buildLineItems>) => items.map((i) => i.price_data!.unit_amount);

  it("charges the package at its published price, then IVA as its own line", () => {
    for (const tier of TIERS) {
      for (const route of SERVICE_ROUTES) {
        const items = buildLineItems(tier, route);
        expect(items, `${tier.id} ${route}`).toHaveLength(2);
        expect(items[0]!.price_data!.unit_amount, `${tier.id} ${route}`).toBe(tierPriceCents(tier, route));
        expect(items[1]!.price_data!.product_data!.name).toBe("IVA (21 %)");
        expect(items[1]!.price_data!.unit_amount).toBe(ivaCents(tierPriceCents(tier, route)));
      }
    }
  });

  it("charges the route's own price", () => {
    expect(amounts(buildLineItems(getTier("ready-file")!, "eu"))).toEqual([4_900, 1_029]);
    expect(amounts(buildLineItems(getTier("ready-file")!, "non-eu"))).toEqual([7_900, 1_659]);
    expect(amounts(buildLineItems(getTier("soft-landing")!, "eu"))).toEqual([9_900, 2_079]);
    expect(amounts(buildLineItems(getTier("soft-landing")!, "non-eu"))).toEqual([14_900, 3_129]);
  });

  it("adds one line per add-on and charges IVA on the whole basket", () => {
    const addons = resolveAddons(["t-jove", "esim"])!;
    const items = buildLineItems(getTier("soft-landing")!, "eu", addons);
    expect(amounts(items)).toEqual([9_900, 6_500, 2_500, ivaCents(18_900)]);
    // What Stripe will collect is exactly what the webhook expects.
    const sum = amounts(items).reduce((n, a) => n! + a!, 0);
    expect(sum).toBe(totalCents(getTier("soft-landing")!, "eu", addons).grossCents);
  });

  it("charges in euro", () => {
    for (const item of buildLineItems(getTier("ready-file")!, "eu", resolveAddons(["isic"])!)) {
      expect(item.price_data!.currency).toBe("eur");
    }
  });
});

describe("formatting", () => {
  it("renders euro amounts for a Spanish locale", () => {
    // es-ES puts a narrow no-break space before the symbol; normalise the
    // whole no-break family to a plain space before asserting.
    const plain = (cents: number) => formatEur(cents).replace(/[\u00A0\u202F]/g, " ");
    expect(plain(4_900)).toBe("49 €");
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
    expect(tierIdSchema.parse("turnkey")).toBe("soft-landing");
    expect(tierIdSchema.parse("fixer")).toBe("soft-landing");
  });

  it("refuses anything that is not a package", () => {
    for (const value of ["", "gold", "__proto__", "constructor"]) {
      expect(tierIdSchema.safeParse(value).success, `${value} must be refused`).toBe(false);
    }
  });
});
