import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sitemap from "../src/app/sitemap";
import { GET as llms } from "../src/app/llms.txt/route";
import { GET as llmsFull } from "../src/app/llms-full.txt/route";
import { GUIDE_CHAPTER_PATHS, PUBLIC_PAGES, isGuideChapterPath, isPublicPage, markdownPath } from "../src/lib/agents/pages";
import { renderPageMarkdown } from "../src/lib/agents/markdown";
import { LOCALES, localizedPath } from "../src/i18n/routing";
import { CHAPTERS, chapterNeighbours, chapterPath, getChapter } from "../src/lib/guide/chapters";
import { GUIDE_PRICES } from "../src/lib/guide/chapters/part-4";
import { chapterStrings, dictionary, localizeChapter, mdKey, missingStrings } from "../src/lib/guide/i18n";
import { chapterBody } from "../src/lib/guide/markdown";
import { parseInline, toMarkdown, toPlain } from "../src/lib/guide/text";
import { ADDONS, TIERS, tierPriceCents } from "../src/lib/pricing";
import { faqPage, guideArticle } from "../src/lib/structured-data";

/**
 * The guide, read on the site: one typed source rendered as the page, the
 * Markdown and the structured data, in six languages, with the same text as
 * the PDF. These tests pin the source, the translations and the three things
 * built from them.
 */

const OTHER = LOCALES.filter((l) => l !== "en");
const read = (f: string) => readFileSync(f, "utf8");

describe("the registry", () => {
  it("has unique slugs and numbers, in reading order, 01 to 15", () => {
    expect(CHAPTERS).toHaveLength(15);
    expect(new Set(CHAPTERS.map((c) => c.slug)).size).toBe(15);
    expect(CHAPTERS.map((c) => c.number)).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, "0")));
  });

  it("finds a chapter by slug and walks previous and next", () => {
    const first = CHAPTERS[0]!;
    expect(getChapter(first.slug)).toBe(first);
    expect(getChapter("nope")).toBeUndefined();
    expect(chapterNeighbours(first.slug).prev).toBeUndefined();
    expect(chapterNeighbours(first.slug).next).toBe(CHAPTERS[1]);
    expect(chapterNeighbours(CHAPTERS.at(-1)!.slug).next).toBeUndefined();
  });

  it("only links to pages that exist", () => {
    const ok = new Set(["/guide", "/triage", "/pricing", ...CHAPTERS.map((c) => chapterPath(c.slug))]);
    for (const c of CHAPTERS) {
      const hrefs = [...chapterStrings(c), ...(JSON.stringify(c).match(/"href":"[^"]+"/g) ?? []).map((h) => h.slice(8, -1))].flatMap((t) =>
        t.startsWith("/") ? [t] : parseInline(t).flatMap((n) => (n.t === "link" ? [n.href] : [])),
      );
      for (const href of hrefs) expect(ok.has(href), `${c.slug} → ${href}`).toBe(true);
    }
  });

  it("states the government fees one way everywhere", () => {
    const all = JSON.stringify(CHAPTERS);
    expect(all).toContain("€16.08");
    expect(all).not.toMatch(/€16\.8|€16,08/);
  });
});

describe("prices come from the site's pricing table", () => {
  it("the web chapters quote exactly the tiers and add-ons the checkout charges", () => {
    const ready = TIERS.find((t) => t.id === "ready-file")!;
    const soft = TIERS.find((t) => t.id === "soft-landing")!;
    const eur = (c: number) => `€${c / 100}`;
    expect(GUIDE_PRICES.READY).toEqual({ eu: eur(tierPriceCents(ready, "eu")), non: eur(tierPriceCents(ready, "non-eu")) });
    expect(GUIDE_PRICES.SOFT).toEqual({ eu: eur(tierPriceCents(soft, "eu")), non: eur(tierPriceCents(soft, "non-eu")) });
    const packages = getChapter("packages-and-pricing")!.blocks.find((b) => b.kind === "packages");
    expect(packages && packages.kind === "packages" && packages.addons.map((a) => [a.name, a.price])).toEqual(
      ADDONS.map((a) => [a.name, eur(a.priceCents)]),
    );
    // No package the site does not sell.
    expect(JSON.stringify(CHAPTERS)).not.toMatch(/The Fixer|€300|€360|€540|€600|€960/);
  });

  it("the PDF pages quote the same prices", () => {
    const pages = ["17", "18"].map((n) => read(`guide-pdf/pages/${n}.html`)).join("\n");
    for (const t of TIERS) {
      expect(pages).toContain(`${tierPriceCents(t, "eu") / 100} / €${tierPriceCents(t, "non-eu") / 100}`.replace(/^/, "€"));
    }
    for (const a of ADDONS) expect(pages).toContain(`€${a.priceCents / 100}`);
    expect(pages).not.toMatch(/The Fixer|€300|€360|€540|€600|€960|Bizum|Ley 39\/2015/);
  });
});

describe("inline markup", () => {
  it("parses bold, italic and in-site links, and nothing else", () => {
    expect(parseInline("a **b** *c* [d](/guide/getting-your-tie) [e](/triage) <script>")).toEqual([
      { t: "text", v: "a " },
      { t: "strong", v: "b" },
      { t: "text", v: " " },
      { t: "em", v: "c" },
      { t: "text", v: " " },
      { t: "link", v: "d", href: "/guide/getting-your-tie" },
      { t: "text", v: " " },
      { t: "link", v: "e", href: "/triage" },
      { t: "text", v: " <script>" },
    ]);
    expect(parseInline("[x](https://evil.test)")).toEqual([{ t: "text", v: "[x](https://evil.test)" }]);
    expect(toPlain("**a** [b](/guide/x)")).toBe("a b");
    expect(toMarkdown("[b](/guide/x)", "https://bcnstudent.com")).toBe("[b](https://bcnstudent.com/guide/x)");
  });

  it("turns a PDF text unit into the same key the chapters use", () => {
    expect(mdKey('Fill in <span style="x">EX-17</span> and <b>pay</b> the <i>fee</i><br>now &amp; later')).toBe("Fill in EX-17 and **pay** the *fee* now & later");
  });
});

describe("translations", () => {
  it.each(OTHER)("%s translates every string of every chapter", (locale) => {
    const missing = CHAPTERS.flatMap((c) => missingStrings(c, locale).map((s) => `${c.slug}: ${s.slice(0, 70)}`));
    expect(missing).toEqual([]);
  });

  it.each(OTHER)("%s keeps each string's markup and links intact", (locale) => {
    const shape = (s: string) => [s.split("**").length, (s.match(/(?<!\*)\*(?!\*)/g) ?? []).length, (s.match(/\]\(\/[^)]*\)/g) ?? []).sort().join()];
    const d = dictionary(locale);
    for (const c of CHAPTERS) for (const en of chapterStrings(c)) expect(shape(d[en]!), `${locale} ${c.slug}: ${en.slice(0, 50)}`).toEqual(shape(en));
  });

  it.each(OTHER)("%s leaves structure, numbers and links alone", (locale) => {
    CHAPTERS.forEach((c, i) => {
      const t = localizeChapter(c, locale);
      expect(t.slug).toBe(c.slug);
      expect(t.number).toBe(c.number);
      expect(t.blocks.map((b) => b.kind)).toEqual(c.blocks.map((b) => b.kind));
      expect(t.faq?.length).toBe(c.faq?.length);
      expect(i).toBeGreaterThanOrEqual(0);
    });
  });

  it("keeps the search titles and descriptions inside what a result shows, in every language", () => {
    for (const locale of LOCALES) {
      for (const raw of CHAPTERS) {
        const c = localizeChapter(raw, locale);
        expect(c.metaTitle.length, `${locale} ${c.slug} metaTitle`).toBeLessThanOrEqual(66);
        expect(c.description.length, `${locale} ${c.slug} description`).toBeLessThanOrEqual(190);
        expect(c.keyFacts.length, c.slug).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("covers every text unit of the PDF in every language", () => {
    // Pages 1 to 20 carry about 650 units; a dictionary that shrinks has lost some.
    for (const l of OTHER) {
      const d = JSON.parse(read(`src/lib/guide/i18n/pdf-${l}.json`)) as Record<string, string>;
      expect(Object.keys(d).length, l).toBeGreaterThanOrEqual(640);
      for (const [en, tr] of Object.entries(d)) {
        const tags = (s: string) => (s.match(/<\/?(b|i|br|span)\b/g) ?? []).sort().join();
        expect(tags(tr), `${l}: ${en.slice(0, 50)}`).toBe(tags(en));
      }
    }
  });
});

describe("the PDF files", () => {
  const files = ["landing-in-barcelona.pdf", ...OTHER.map((l) => `landing-in-barcelona.${l}.pdf`)];
  it("has one real, text-based PDF per language, small enough to download quickly", () => {
    expect(readdirSync("assets/guide").filter((f) => f.endsWith(".pdf")).sort()).toEqual([...files].sort());
    for (const f of files) {
      const buf = readFileSync(path.join("assets/guide", f));
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(statSync(path.join("assets/guide", f)).size, f).toBeLessThan(2_500_000);
      expect(buf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length, f).toBe(20);
    }
  });
  it("has a cover image per language", () => {
    for (const f of ["cover.png", ...OTHER.map((l) => `cover-${l}.png`)]) expect(statSync(path.join("assets/guide", f)).size).toBeGreaterThan(50_000);
  });
});

describe("agents and crawlers", () => {
  it("lists every chapter in the sitemap in all six languages, with alternates", () => {
    const entries = sitemap().filter((e) => new URL(e.url).pathname.replace(/^\/(es|ca|fr|it|de)(?=\/)/, "").startsWith("/guide/"));
    expect(entries).toHaveLength(CHAPTERS.length * LOCALES.length);
    for (const e of entries) {
      for (const l of LOCALES) expect(e.alternates?.languages?.[l], `${e.url} ${l}`).toBeTruthy();
      expect(e.alternates?.languages?.["x-default"]).toBeTruthy();
    }
  });

  it("treats chapters as ordinary public pages", () => {
    for (const p of GUIDE_CHAPTER_PATHS) {
      expect(isPublicPage(p)).toBe(true);
      expect(isGuideChapterPath(p)).toBe(true);
      expect(markdownPath(p)).toBe(`${p}.md`);
      expect(PUBLIC_PAGES).toContain(p);
    }
    expect(isPublicPage("/guide/not-a-chapter")).toBe(false);
    expect(isPublicPage("/intake")).toBe(false);
  });

  it.each(LOCALES)("renders each chapter as Markdown in %s, with its key facts and absolute links", async (locale) => {
    for (const raw of CHAPTERS) {
      const c = localizeChapter(raw, locale);
      const md = await renderPageMarkdown(chapterPath(c.slug), locale);
      expect(md, c.slug).toBeTruthy();
      expect(md!.startsWith(`# ${c.title}`)).toBe(true);
      for (const fact of c.keyFacts) expect(md).toContain(toMarkdown(fact, "https://bcnstudent.com"));
      expect(md).toContain(`https://bcnstudent.com${localizedPath(locale, chapterPath(c.slug))}`);
      expect(md).not.toMatch(/\]\(\/(guide|triage|pricing)/);
    }
    expect(await renderPageMarkdown("/guide/nope", locale)).toBeNull();
  });

  it("renders charts as tables an assistant can read", () => {
    const ui = { intro: "", webPage: "", pdf: "", shortAnswer: "", faq: "", sources: "", prev: "", next: "" };
    const costs = chapterBody(getChapter("costs-bank-account-sim")!, "https://bcnstudent.com", "en", ui);
    expect(costs).toMatch(/\| Item \| Applies to \| Cost \|\n\| --- \| --- \| --- \|\n\| Fee 790-012, EU registration \| EU \| €12\.00 \|/);
    const clock = chapterBody(getChapter("the-30-day-clock")!, "https://bcnstudent.com", "en", ui);
    expect(clock).toMatch(/\| Task \| Note \| Days \| Type \|/);
    const packages = chapterBody(getChapter("packages-and-pricing")!, "https://bcnstudent.com", "en", ui);
    expect(packages).toContain("The Ready File (€49 / €79");
  });

  it("lists the chapters, in every language, on the guide's own Markdown page", async () => {
    for (const l of LOCALES) {
      const md = await renderPageMarkdown("/guide", l);
      for (const c of CHAPTERS) expect(md).toContain(`https://bcnstudent.com${localizedPath(l, chapterPath(c.slug))}`);
    }
  });

  it("serves llms.txt and llms-full.txt as plain text naming every chapter", async () => {
    const short = await llms();
    expect(short.headers.get("content-type")).toContain("text/plain");
    const shortText = await short.text();
    const fullText = await (await llmsFull()).text();
    expect(shortText.startsWith("# BCN Student Concierge")).toBe(true);
    expect(shortText).toContain("/es/guide/");
    for (const c of CHAPTERS) {
      expect(shortText).toContain(chapterPath(c.slug));
      expect(fullText).toContain(c.title);
    }
  });

  it("puts every public page in llms-full.txt, with its own address, and no template leftovers", async () => {
    const fullText = await (await llmsFull()).text();
    for (const page of ["/", "/pricing", "/triage", "/legal", "/privacy", "/terms"]) {
      expect(fullText).toContain(`Markdown: https://bcnstudent.com${markdownPath(page)}`);
    }
    expect(fullText).toContain("The short answer");
    expect(fullText).toContain("Questions people ask");
    expect(fullText).not.toMatch(/undefined|\[object|\{number\}|<\/?[a-z]+>/);
    // One H1: the pages nest under it.
    expect(fullText.match(/^# /gm)).toHaveLength(1);
  });
});

describe("structured data", () => {
  it("describes a chapter as a free article, in its language, with real citations", () => {
    const c = getChapter("getting-your-tie")!;
    const article = guideArticle(localizeChapter(c, "es"), "2026-10-04", "es") as Record<string, unknown>;
    expect(article["@type"]).toBe("Article");
    expect(article.inLanguage).toBe("es");
    expect(article.isAccessibleForFree).toBe(true);
    expect(article.url).toBe("https://bcnstudent.com/es/guide/getting-your-tie");
    for (const cite of article.citation as { url: string }[]) expect(cite.url).toMatch(/^https:\/\//);
  });

  it("quotes the FAQ verbatim", () => {
    const c = localizeChapter(getChapter("getting-your-tie")!, "de");
    const json = JSON.stringify(faqPage(c.faq!));
    for (const f of c.faq!) expect(json).toContain(JSON.stringify(f.a).slice(1, -1));
  });
});
