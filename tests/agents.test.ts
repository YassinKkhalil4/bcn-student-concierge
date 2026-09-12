import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GET as robots } from "../src/app/robots.txt/route";
import sitemap from "../src/app/sitemap";
import { PRIVATE_PREFIXES, PUBLIC_PAGES, isPrivatePath, isPublicPage, markdownPath } from "../src/lib/agents/pages";
import { renderPageMarkdown } from "../src/lib/agents/markdown";
import { LOCALES, localizedPath } from "../src/i18n/routing";
import { TIERS, formatEur, priceWithIva } from "../src/lib/pricing";

/**
 * What automated readers see: robots.txt, the sitemap, and the Markdown
 * representation of the public pages. The rule these tests exist to keep is
 * that none of it ever reaches a page holding a student's data.
 */

const catalogue = (locale: string, ns: string) =>
  JSON.parse(readFileSync(path.join(process.cwd(), "messages", locale, `${ns}.json`), "utf8"));

describe("public surface", () => {
  it("never lists a page that holds personal data", () => {
    for (const page of PUBLIC_PAGES) expect(isPrivatePath(page), page).toBe(false);
    for (const prefix of PRIVATE_PREFIXES) expect(isPublicPage(prefix), prefix).toBe(false);
    // The intake form is public to people but not to crawlers: it collects
    // passport data and is noindex.
    expect(isPublicPage("/intake")).toBe(false);
    expect(isPrivatePath("/portal/login")).toBe(true);
  });
});

describe("robots.txt", () => {
  const body = async () => (await robots()).text();

  it("is plain text and points at the sitemap", async () => {
    const res = robots();
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(await res.text()).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  });

  it("closes every path that holds personal data, to every crawler", async () => {
    const text = await body();
    // Each group must carry the full set of Disallow lines, not just the first.
    // Groups are separated by a blank line (RFC 9309 §2.2.1).
    const groups = text.split(/\n\s*\n/).filter((g) => g.includes("User-agent:"));
    expect(groups.length).toBeGreaterThanOrEqual(3);
    for (const group of groups) {
      const closed = group.includes("Disallow: /\n") || group.trimEnd().endsWith("Disallow: /");
      for (const prefix of PRIVATE_PREFIXES) {
        expect(closed || group.includes(`Disallow: ${prefix}/`), `${prefix} in ${group.slice(0, 40)}`).toBe(true);
      }
    }
  });

  it("names AI crawlers explicitly and declares content signals", async () => {
    const text = await body();
    for (const agent of ["GPTBot", "OAI-SearchBot", "ClaudeBot", "Google-Extended"]) {
      expect(text).toContain(`User-agent: ${agent}`);
    }
    expect(text).toMatch(/^Content-Signal: ai-train=\w+, search=\w+, ai-input=\w+$/m);
  });
});

describe("sitemap", () => {
  const entries = sitemap();

  it("covers every public page in every language, and nothing else", () => {
    expect(entries).toHaveLength(PUBLIC_PAGES.length * LOCALES.length);
    for (const page of PUBLIC_PAGES) {
      for (const locale of LOCALES) {
        expect(entries.some((e) => e.url.endsWith(localizedPath(locale, page)))).toBe(true);
      }
    }
  });

  it("lists no private path", () => {
    for (const entry of entries) {
      const { pathname } = new URL(entry.url);
      const unprefixed = pathname.replace(/^\/(es|ca|fr|it|de)(?=\/|$)/, "") || "/";
      expect(isPrivatePath(unprefixed), entry.url).toBe(false);
    }
  });

  it("gives every entry its language alternates", () => {
    for (const entry of entries) {
      const languages = entry.alternates?.languages ?? {};
      for (const locale of LOCALES) expect(languages[locale], `${entry.url} ${locale}`).toBeTruthy();
      expect(languages["x-default"]).toBeTruthy();
    }
  });
});

describe("Markdown for agents", () => {
  it("renders every public page in every language", async () => {
    for (const page of PUBLIC_PAGES) {
      for (const locale of LOCALES) {
        const md = await renderPageMarkdown(page, locale);
        expect(md, `${locale} ${page}`).toBeTruthy();
        expect(md!.startsWith("# "), `${locale} ${page} starts with a heading`).toBe(true);
        expect(md!.length).toBeGreaterThan(400);
      }
    }
  });

  it("carries the scope-of-service disclaimer, whatever an assistant quotes", async () => {
    for (const locale of LOCALES) {
      const { disclaimer } = catalogue(locale, "common");
      for (const page of PUBLIC_PAGES) {
        expect((await renderPageMarkdown(page, locale))!, `${locale} ${page}`).toContain(disclaimer.body);
      }
    }
  });

  it("leaves no rich-text tag or untranslated key in the output", async () => {
    for (const page of PUBLIC_PAGES) {
      for (const locale of LOCALES) {
        const md = (await renderPageMarkdown(page, locale))!;
        expect(md, `${locale} ${page}`).not.toMatch(/<\/?[a-zA-Z]+>/);
        // A failed lookup prints the key path ("legal.terms.priceLine").
        expect(md, `${locale} ${page}`).not.toMatch(/^[a-z]+(\.[a-zA-Z0-9]+){2,}$/m);
      }
    }
  });

  it("quotes the prices from the pricing table, not from prose", async () => {
    const md = (await renderPageMarkdown("/pricing", "en"))!;
    for (const tier of TIERS) {
      const p = priceWithIva(tier.basePriceCents);
      expect(md, tier.id).toContain(formatEur(p.totalCents));
      expect(md, tier.id).toContain(formatEur(p.ivaCents));
    }
  });

  it("links each page to its canonical URL and its .md address", async () => {
    for (const page of PUBLIC_PAGES) {
      const md = (await renderPageMarkdown(page, "fr"))!;
      expect(md).toContain(localizedPath("fr", page));
      expect(markdownPath(page).endsWith(".md")).toBe(true);
    }
  });
});
