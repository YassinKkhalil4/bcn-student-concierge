import type { Block, Chapter } from "./types";
import { CHAPTERS, chapterNeighbours, chapterPath } from "./chapters";
import { localizedPath } from "@/i18n/routing";
import { localizeChapter } from "./i18n";
import { toMarkdown, toPlain } from "./text";

/**
 * The guide as Markdown: one chapter per document for `/guide/<slug>.md`, and
 * the whole guide as one file for `/llms-full.txt`. Same source as the pages.
 */

const table = (head: string[], rows: string[][]) =>
  [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

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
      return [b.title ? `**${toPlain(b.title)}**${b.count ? ` (${b.count})` : ""}` : "", b.items.map((i) => `- [ ] ${toMarkdown(i, o)}`).join("\n")]
        .filter(Boolean)
        .join("\n\n");
    case "cards":
      return b.items
        .map((c) =>
          [
            `#### ${c.label ? `${c.label}: ` : ""}${toPlain(c.title)}${c.tag ? ` (${c.tag})` : ""}`,
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
        table([...b.head], b.rows.map((r) => [r.spanish, r.english])),
      ].join("\n\n");
    case "routecards":
      return b.items
        .map((r) =>
          [`#### ${r.label}: ${toPlain(r.title)}`, toMarkdown(r.lede, o), r.rows.map((x) => `- **${x.k}:** ${toMarkdown(x.v, o)}`).join("\n"), `[${r.cta}](${o}${r.href})`].join("\n\n"),
        )
        .join("\n\n");
    case "swimlanes":
      return b.lanes
        .map((l) => {
          const path = l.stops.map((s) => (s.sub ? `${s.label} (${s.sub})` : s.label)).join(" → ");
          return `- **${l.chip} · ${l.name}** (${l.sub}): ${path}${l.wait ? `. ${l.wait.label}` : ""}`;
        })
        .join("\n");
    case "bars2":
      return [
        `**${toPlain(b.title)}**`,
        table(["", b.legend[0], b.legend[1]], b.rows.map((r) => ("chips" in r ? [`${r.label}${r.sub ? ` (${r.sub})` : ""}`, r.chips[0], r.chips[1]] : [`${r.label}${r.sub ? ` (${r.sub})` : ""}`, r.eu.v, r.non.v]))),
      ].join("\n\n");
    case "gantt": {
      const kind = Object.fromEntries(b.legend.map((l) => [l.tone, l.label]));
      return [
        `**${toPlain(b.title)}** (${toPlain(b.sub)})`,
        table(["Task", "Note", "Days", "Type"], b.rows.map((r) => [`${r.label}${r.tag ? ` (${r.tag.label})` : ""}`, r.sub, r.value, kind[r.tone] ?? ""])),
        b.note ? `*${toMarkdown(b.note, o)}*` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    case "terms":
      return table(b.head as unknown as string[], b.rows.map((r) => [`**${r.term}** (${r.native}): ${r.kind}`, r.what.map((x) => toMarkdown(x, o)).join(" "), r.remember.map((x) => toMarkdown(x, o)).join(" ")]));
    case "controls":
      return [`**${toPlain(b.title)}**`, b.steps.map((s) => `1. **${s.n}:** ${s.sub} (${b.legend.find((l) => l.owner === s.owner)?.label})`).join("\n"), b.next ? toMarkdown(b.next, o) : ""].filter(Boolean).join("\n\n");
    case "kit":
      return [
        `**${toPlain(b.checklist.title)}** (${b.checklist.count})`,
        b.checklist.items.map((i) => `- [ ] ${toMarkdown(i, o)}`).join("\n"),
        `**${toPlain(b.photo.title)}:** ${b.photo.size}`,
        bullets(b.photo.rules, o),
        toMarkdown(b.photo.note, o),
      ].join("\n\n");
    case "strips":
      return [`**${toPlain(b.title)}**${b.tag ? ` (${b.tag})` : ""}`, b.rows.map((r) => `- ${r.label}: ${r.segs.map((s) => s.text).filter(Boolean).join(" → ")}`).join("\n"), b.note ? toMarkdown(b.note, o) : ""].filter(Boolean).join("\n\n");
    case "flow":
      return [
        `**${toPlain(b.title)}** (${b.aside})`,
        b.steps.map((s, n) => `${n + 1}. **${s.title}**${s.tag ? ` (${s.tag})` : ""}: ${toMarkdown(s.body, o)}`).join("\n"),
        `${b.example.label} ✕ ${b.example.bad} → ✓ ${b.example.good}`,
      ].join("\n\n");
    case "costbars":
      return [`**${toPlain(b.title)}** · ${toMarkdown(b.total, o)}`, table(["Item", "Applies to", "Cost"], b.rows.map((r) => [r.label, r.tag.label, r.value])), b.note].join("\n\n");
    case "cycle":
      return [`**${b.label}**`, b.rows.map((r) => `- ${r.label}: ${r.count}×`).join("\n")].join("\n\n");
    case "workload":
      return [`**${toPlain(b.title)}** (${b.sub})`, table(["Task", ...b.legend, "Total"], b.rows.map((r) => [r.label, String(r.d), String(r.s), String(r.v), r.total])), toMarkdown(b.note, o)].join("\n\n");
    case "statcards":
      return b.items.map((s) => [`#### ${s.big} ${s.unit}`, ...s.body.map((x) => toMarkdown(x, o))].join("\n\n")).join("\n\n");
    case "numbers":
      return [`**${toPlain(b.title)}**`, table(["Number", "Who"], b.rows.map((r) => [r.n, r.label]))].join("\n\n");
    case "packages": {
      const head = ["", ...b.tiers.map((t) => `${t.name} (${t.eu} / ${t.non} ${b.routes[0]} / ${b.routes[1]})`)];
      return [
        b.terms.join(" "),
        table(head, b.sections.flatMap((sec) => [[`**${sec.title}**`, "", ""], ...sec.rows.map((r) => [toMarkdown(r.label, o), ...r.has.map((h) => (h ? "✓" : "—"))])])),
        `**${b.addonsTitle}**`,
        b.addons.map((a) => `- **${a.name}** (${a.price}): ${a.body}`).join("\n"),
      ].join("\n\n");
    }
  }
}

/** The words around a chapter that are not the chapter: labels, not content. */
export interface ReaderUi {
  intro: string; // "Chapter {number} of the free guide “Landing in Barcelona”."
  webPage: string;
  pdf: string;
  shortAnswer: string;
  faq: string;
  sources: string;
  prev: string;
  next: string;
}

export function chapterBody(c: Chapter, origin: string, locale: string, ui: ReaderUi): string {
  const path = (slug: string) => `${origin}${localizedPath(locale, chapterPath(slug))}`;
  const nav = chapterNeighbours(c.slug);
  const parts = [
    `# ${c.title}`,
    `*${ui.intro.replace("{number}", c.number)} [${ui.webPage}](${path(c.slug)}) · [${ui.pdf}](${origin}/downloads/landing-in-barcelona.pdf?l=${locale})*`,
    toMarkdown(c.lede, origin),
    `## ${ui.shortAnswer}`,
    bullets(c.keyFacts, origin),
    ...c.blocks.map((b) => block(b, origin)),
  ];
  if (c.faq?.length) {
    parts.push(`## ${ui.faq}`, ...c.faq.flatMap((f) => [`### ${f.q}`, toMarkdown(f.a, origin)]));
  }
  if (c.sources.length) {
    parts.push(`## ${ui.sources}`, c.sources.map((s) => (s.url ? `- [${s.label}](${s.url})` : `- ${s.label}`)).join("\n"));
  }
  const links = [
    nav.prev ? `${ui.prev}: [${nav.prev.navTitle}](${path(nav.prev.slug)})` : "",
    nav.next ? `${ui.next}: [${nav.next.navTitle}](${path(nav.next.slug)})` : "",
  ].filter(Boolean);
  if (links.length) parts.push(links.join(" · "));
  return parts.filter(Boolean).join("\n\n");
}

/** The chapter list as Markdown, used by the hub's `.md` and llms.txt. */
export const chapterIndex = (origin: string, locale = "en"): string =>
  CHAPTERS.map((raw) => {
    const c = localizeChapter(raw, locale);
    return `- [${c.number} ${c.navTitle}](${origin}${localizedPath(locale, chapterPath(c.slug))}): ${c.description}`;
  }).join("\n");

export function llmsTxt(origin: string): string {
  return `${[
    "# BCN Student Concierge",
    "> Paperwork help for international students arriving in Barcelona, and a free, plain-English guide to the student paperwork: TIE (EX-17), EU registration certificate (EX-18), padrón, health insurance, costs. Not a law firm or gestoría.",
    "## The free guide, readable online",
    `Each chapter is a web page and a Markdown file: add \`.md\` to any chapter URL. Every chapter is also available in Spanish (/es/guide/…), Catalan (/ca/…), French (/fr/…), Italian (/it/…) and German (/de/…).`,
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

const EN_UI: ReaderUi = {
  intro: "Chapter {number} of the free guide “Landing in Barcelona”.",
  webPage: "Web page",
  pdf: "PDF",
  shortAnswer: "Key facts",
  faq: "Frequently asked questions",
  sources: "Sources",
  prev: "Previous",
  next: "Next",
};

export function llmsFullTxt(origin: string): string {
  return `${[
    "# Landing in Barcelona: the full guide",
    "> Free guide to student paperwork in Barcelona from BCN Student Concierge. Not legal advice. Each chapter also has its own page.",
    ...CHAPTERS.map((c) => chapterBody(c, origin, "en", EN_UI).replace(/^# /, "## ")),
  ].join("\n\n---\n\n")}\n`;
}
