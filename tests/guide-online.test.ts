import { describe, it, expect } from "vitest";
import sitemap from "../src/app/sitemap";
import { GET as llms } from "../src/app/llms.txt/route";
import { GET as llmsFull } from "../src/app/llms-full.txt/route";
import { GUIDE_CHAPTER_PATHS, isAgentPage, isGuideChapterPath, isPublicPage, markdownPath } from "../src/lib/agents/pages";
import { renderPageMarkdown } from "../src/lib/agents/markdown";
import { CHAPTERS, chapterNeighbours, chapterPath, getChapter } from "../src/lib/guide/chapters";
import { chapterBody } from "../src/lib/guide/markdown";
import { parseInline, toMarkdown, toPlain } from "../src/lib/guide/text";
import type { Block, Chapter } from "../src/lib/guide/types";
import { faqPage, guideArticle } from "../src/lib/structured-data";

/**
 * The guide, read on the site. One typed source renders the page, the
 * Markdown and the structured data, so what these tests pin is the source and
 * the three things built from it.
 */

const texts = (c: Chapter): string[] => {
  const fromBlock = (b: Block): string[] => {
    switch (b.kind) {
      case "p":
      case "h3":
        return [b.text];
      case "list":
      case "checklist":
        return b.items;
      case "callout":
        return [b.title, ...b.body];
      case "steps":
        return b.items.flatMap((i) => [i.title, ...i.body, ...(i.tags ?? [])]);
      case "cards":
        return b.items.flatMap((i) => [i.title, ...i.body]);
      case "table":
        return [...b.rows.flat(), b.note ?? ""];
      case "phrases":
        return b.rows.flatMap((r) => [r.spanish, r.english]);
    }
  };
  return [c.title, c.lede, ...c.keyFacts, ...c.blocks.flatMap(fromBlock), ...(c.faq ?? []).flatMap((f) => [f.q, f.a])];
};

describe("the registry", () => {
  it("has unique slugs and unique numbers, in reading order", () => {
    expect(new Set(CHAPTERS.map((c) => c.slug)).size).toBe(CHAPTERS.length);
    expect(new Set(CHAPTERS.map((c) => c.number)).size).toBe(CHAPTERS.length);
    const numbers = CHAPTERS.map((c) => c.number);
    expect([...numbers].sort()).toEqual(numbers);
  });

  it("finds a chapter by slug and walks previous and next", () => {
    const first = CHAPTERS[0]!;
    expect(getChapter(first.slug)).toBe(first);
    expect(getChapter("nope")).toBeUndefined();
    expect(chapterNeighbours(first.slug).prev).toBeUndefined();
    expect(chapterNeighbours(first.slug).next).toBe(CHAPTERS[1]);
    expect(chapterNeighbours(CHAPTERS.at(-1)!.slug).next).toBeUndefined();
  });

  it("keeps titles and descriptions inside what a search result shows", () => {
    for (const c of CHAPTERS) {
      expect(c.metaTitle.length, `${c.slug} metaTitle`).toBeLessThanOrEqual(60);
      expect(c.description.length, `${c.slug} description`).toBeLessThanOrEqual(155);
      expect(c.description.length, `${c.slug} description`).toBeGreaterThanOrEqual(80);
      expect(c.keyFacts.length, c.slug).toBeGreaterThanOrEqual(3);
      expect(c.keyFacts.length, c.slug).toBeLessThanOrEqual(5);
    }
  });

  it("only links to chapters that exist", () => {
    for (const c of CHAPTERS) {
      const hrefs = [
        ...texts(c).flatMap((t) => parseInline(t).flatMap((n) => (n.t === "link" ? [n.href] : []))),
        ...c.blocks.flatMap((b) => (b.kind === "cards" ? b.items.flatMap((i) => (i.href ? [i.href] : [])) : [])),
      ];
      for (const href of hrefs) expect(getChapter(href.replace("/guide/", "")), `${c.slug} → ${href}`).toBeTruthy();
    }
  });

  it("publishes no price for the paid service and no stale pricing claims", () => {
    // The PDF prints package prices; the site's pricing table is the one
    // source for those. The chapters are the free guide, so they stay out.
    for (const c of CHAPTERS) {
      const all = texts(c).join(" ");
      expect(all, c.slug).not.toMatch(/Ready File|Soft Landing|The Fixer|€300|€360|€540|€600|€960/);
    }
  });

  it("states the government fees the same way everywhere", () => {
    const all = CHAPTERS.flatMap(texts).join(" ");
    expect(all).toContain("€16.08");
    expect(all).toContain("€12");
    expect(all).not.toMatch(/€16\.8|€16,08/);
  });

  it("has a question and an answer wherever it has a FAQ, and never an empty one", () => {
    for (const c of CHAPTERS) for (const f of c.faq ?? []) {
      expect(f.q.endsWith("?"), `${c.slug}: ${f.q}`).toBe(true);
      expect(f.a.length).toBeGreaterThan(40);
    }
  });
});

describe("inline markup", () => {
  it("parses bold, italic and in-guide links, and nothing else", () => {
    expect(parseInline("a **b** *c* [d](/guide/getting-your-tie) <script>")).toEqual([
      { t: "text", v: "a " },
      { t: "strong", v: "b" },
      { t: "text", v: " " },
      { t: "em", v: "c" },
      { t: "text", v: " " },
      { t: "link", v: "d", href: "/guide/getting-your-tie" },
      { t: "text", v: " <script>" },
    ]);
  });

  it("refuses links that leave the guide", () => {
    expect(parseInline("[x](https://evil.test)")).toEqual([{ t: "text", v: "[x](https://evil.test)" }]);
    expect(toPlain("**a** [b](/guide/x)")).toBe("a b");
    expect(toMarkdown("[b](/guide/x)", "https://bcnstudent.com")).toBe("[b](https://bcnstudent.com/guide/x)");
  });
});

describe("agents and crawlers", () => {
  it("lists every chapter in the sitemap once, in English, with no alternates", () => {
    const entries = sitemap().filter((e) => new URL(e.url).pathname.startsWith("/guide/"));
    expect(entries.map((e) => new URL(e.url).pathname).sort()).toEqual([...GUIDE_CHAPTER_PATHS].sort());
    for (const e of entries) expect(e.alternates).toBeUndefined();
  });

  it("keeps chapters off the translated page list", () => {
    for (const path of GUIDE_CHAPTER_PATHS) {
      expect(isPublicPage(path)).toBe(false);
      expect(isGuideChapterPath(path)).toBe(true);
      expect(isAgentPage(path)).toBe(true);
      expect(markdownPath(path)).toBe(`${path}.md`);
    }
    expect(isAgentPage("/guide/not-a-chapter")).toBe(false);
    expect(isAgentPage("/intake")).toBe(false);
  });

  it("renders each chapter as Markdown with its key facts, sources and disclaimer", async () => {
    for (const c of CHAPTERS) {
      const md = await renderPageMarkdown(chapterPath(c.slug), "en");
      expect(md, c.slug).toBeTruthy();
      expect(md!.startsWith(`# ${c.title}`)).toBe(true);
      expect(md).toContain("## Key facts");
      for (const fact of c.keyFacts) expect(md).toContain(toPlain(fact).slice(0, 40));
      expect(md).toContain(`https://bcnstudent.com${chapterPath(c.slug)}`);
      expect(md).not.toMatch(/\]\(\/guide\//); // every link is absolute
    }
    expect(await renderPageMarkdown("/guide/nope", "en")).toBeNull();
  });

  it("renders tables as tables", () => {
    const md = chapterBody(getChapter("costs-bank-account-sim")!, "https://bcnstudent.com");
    expect(md).toMatch(/\| Item \| Applies to \| Cost \|\n\| --- \| --- \| --- \|\n\| Fee 790-012/);
  });

  it("mentions the chapters on the guide's own Markdown page", async () => {
    const md = await renderPageMarkdown("/guide", "en");
    for (const c of CHAPTERS) expect(md).toContain(`https://bcnstudent.com${chapterPath(c.slug)}`);
  });

  it("serves llms.txt and llms-full.txt as plain text naming every chapter", async () => {
    const short = await llms();
    expect(short.headers.get("content-type")).toContain("text/plain");
    const shortText = await short.text();
    const fullText = await (await llmsFull()).text();
    expect(shortText.startsWith("# BCN Student Concierge")).toBe(true);
    for (const c of CHAPTERS) {
      expect(shortText).toContain(chapterPath(c.slug));
      expect(fullText).toContain(c.title);
    }
  });
});

describe("structured data", () => {
  it("describes a chapter as a free article whose citations are real addresses", () => {
    const c = getChapter("getting-your-tie")!;
    const article = guideArticle(c, "2026-10-04") as Record<string, unknown>;
    expect(article["@type"]).toBe("Article");
    expect(article.isAccessibleForFree).toBe(true);
    expect(article.url).toBe("https://bcnstudent.com/guide/getting-your-tie");
    for (const cite of article.citation as { url: string }[]) expect(cite.url).toMatch(/^https:\/\//);
  });

  it("quotes the FAQ verbatim", () => {
    const c = getChapter("getting-your-tie")!;
    const json = JSON.stringify(faqPage(c.faq!));
    for (const f of c.faq!) expect(json).toContain(JSON.stringify(f.a).slice(1, -1));
  });
});
