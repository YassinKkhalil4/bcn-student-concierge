import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PayButton } from "../src/components/portal/PayButton";
import { ADDONS, formatEur, ivaCents } from "../src/lib/pricing";
import { LOCALES } from "../src/i18n/routing";

/**
 * The pay panel is where the student first sees the sum with IVA on it, so a
 * missing string there is a student looking at a blank label next to a price.
 * Rendered for real, in every language, with a handler that fails on any
 * missing message.
 */
const messages = (locale: string) => ({
  portal: JSON.parse(readFileSync(path.join(process.cwd(), "messages", locale, "portal.json"), "utf8")),
  pricing: JSON.parse(readFileSync(path.join(process.cwd(), "messages", locale, "pricing.json"), "utf8")),
});

function render(locale: string, packageCents: number): string {
  const missing: string[] = [];
  const html = renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages: messages(locale),
      timeZone: "Europe/Madrid",
      onError: (e: { message: string }) => missing.push(e.message),
      children: createElement(PayButton, { packageName: "The Soft Landing", packageCents }),
    }),
  );
  expect(missing, locale).toEqual([]);
  return html;
}

describe("the pay panel", () => {
  it("lists every add-on with its price, in every language", () => {
    for (const locale of LOCALES) {
      const html = render(locale, 14_900);
      for (const addon of ADDONS) {
        expect(html, `${locale} ${addon.id}`).toContain(formatEur(addon.priceCents));
      }
      expect((html.match(/type="checkbox"/g) ?? []).length, locale).toBe(ADDONS.length);
    }
  });

  it("starts at the package price plus IVA, with nothing ticked", () => {
    const html = render("en", 14_900);
    const total = formatEur(14_900 + ivaCents(14_900));
    expect(html).toContain(total);
    expect(html).not.toContain("checked");
  });
});
