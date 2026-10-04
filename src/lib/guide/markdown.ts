import type { Block, Chapter } from "./types";
import { CHAPTERS, chapterNeighbours, chapterPath } from "./chapters";
import { toMarkdown, toPlain } from "./text";

/**
 * The guide as Markdown: one chapter per document for `/guide/<slug>.md`, and
 * the whole guide as one file for `/llms-full.txt`. Same source as the pages.
 */

const bullets = (items: string[], o: string) => items.map((i) => `- ${toMarkdown(i, o)}`).join("\n");

function block(b: Block, o: string): string {
  switch (b.kind) {
    case "p":
      return toMarkdown(b.text, o);
    case "h3":
      return `### ${toPlain(b.text)}`;
    case "list":
      return b.ordered
        ? b.items.map((i, n) => `${n + 1}. ${toMarkdown(i, o)}`).join("\n")
        : bullets(b.items, o);
    case "callout":
      return [`> **${toPlain(b.title)}**`, ...b.body.map((p) => `> \n> ${toMarkdown(p, o)}`)].join("\n");
    case "steps":
      return b.items
        .map(
          (s, n) =>
            `${n + 1}. **${toPlain(s.title)}**${s.tags?.length ? ` (${s.tags.join(", ")})` : ""}\n\n${s.body
              .map((p) => `   ${toMarkdown(p, o)}`)
              .join("\n\n")}`,
        )
        .join("\n\n");
    case "checklist":
      return [b.title ? `**${toPlain(b.title)}**` : "", b.items.map((i) => `- [ ] ${toMarkdown(i, o)}`).join("\n")]
        .filter(Boolean)
        .join("\n\n");
    case "cards":
      return b.items
        .map((c) =>
          [
            `#### ${c.label ? `${c.label}: ` : ""}${toPlain(c.title)}`,
            c.subtitle ? `*${toPlain(c.subtitle)}*` : "",
            ...c.body.map((p) => toMarkdown(p, o)),
            c.href ? `[${c.cta ?? "Read the chapter"}](${o}${c.href})` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        )
        .join("\n\n");
    case "table": {
      const grid = [
        `| ${b.head.join(" | ")} |`,
        `| ${b.head.map(() => "---").join(" | ")} |`,
        ...b.rows.map((r) => `| ${r.map((c) => toMarkdown(c, o)).join(" | ")} |`),
      ].join("\n");
      return [b.caption ? `**${toPlain(b.caption)}**` : "", grid, b.note ? `*${toMarkdown(b.note, o)}*` : ""]
        .filter(Boolean)
        .join("\n\n");
    }
    case "phrases":
      return [
        `**${toPlain(b.title)}**`,
        "| Spanish | English |\n| --- | --- |\n" + b.rows.map((r) => `| ${r.spanish} | ${r.english} |`).join("\n"),
      ].join("\n\n");
  }
}

export function chapterBody(c: Chapter, origin: string): string {
  const parts = [
    `# ${c.title}`,
    `*Chapter ${c.number} of the free guide “Landing in Barcelona”. Read the same text as a [web page](${origin}${chapterPath(c.slug)}) or [download the PDF](${origin}/downloads/landing-in-barcelona.pdf).*`,
    toMarkdown(c.lede, origin),
    "## Key facts",
    bullets(c.keyFacts, origin),
    ...c.blocks.map((b) => block(b, origin)),
  ];
  if (c.faq?.length) {
    parts.push("## Frequently asked questions", ...c.faq.flatMap((f) => [`### ${f.q}`, toMarkdown(f.a, origin)]));
  }
  if (c.sources.length) {
    parts.push("## Sources", c.sources.map((s) => (s.url ? `- [${s.label}](${s.url})` : `- ${s.label}`)).join("\n"));
  }
  const { prev, next } = chapterNeighbours(c.slug);
  const nav = [
    prev ? `Previous: [${prev.navTitle}](${origin}${chapterPath(prev.slug)})` : "",
    next ? `Next: [${next.navTitle}](${origin}${chapterPath(next.slug)})` : "",
  ].filter(Boolean);
  if (nav.length) parts.push(nav.join(" · "));
  return parts.filter(Boolean).join("\n\n");
}

/** The chapter list as Markdown, used by the hub's `.md` and llms.txt. */
export const chapterIndex = (origin: string): string =>
  CHAPTERS.map((c) => `- [${c.number} ${c.navTitle}](${origin}${chapterPath(c.slug)}): ${c.description}`).join("\n");

export function llmsTxt(origin: string): string {
  return `${[
    "# BCN Student Concierge",
    "> Paperwork help for international students arriving in Barcelona, and a free, plain-English guide to the student paperwork: TIE (EX-17), EU registration certificate (EX-18), padrón, health insurance, costs. Not a law firm or gestoría.",
    "## The free guide, readable online",
    `Each chapter is a web page and a Markdown file: add \`.md\` to any chapter URL.`,
    chapterIndex(origin),
    "## Also",
    [
      `- [Guide overview and PDF download](${origin}/guide): the same guide as a PDF`,
      `- [Free triage](${origin}/triage): a free check of where a student's paperwork stands`,
      `- [Pricing](${origin}/pricing): fixed fees for the paid service`,
      `- [Full guide in one file](${origin}/llms-full.txt)`,
    ].join("\n"),
  ].join("\n\n")}\n`;
}

export function llmsFullTxt(origin: string): string {
  return `${[
    "# Landing in Barcelona: the full guide",
    "> Free guide to student paperwork in Barcelona from BCN Student Concierge. Not legal advice. Each chapter also has its own page.",
    ...CHAPTERS.map((c) => chapterBody(c, origin).replace(/^# /, "## ")),
  ].join("\n\n---\n\n")}\n`;
}
