import { translatorFor, type ServerTranslator } from "@/i18n/messages";
import { localizedPath } from "@/i18n/routing";
import { ADDONS, TIERS, formatEur, hasSinglePrice, tierPriceCents, SERVICE_ROUTES } from "@/lib/pricing";
import { GUIDE_FRAMING, GUIDE_PATH } from "@/lib/guide";
import { controllerName } from "@/lib/provider";
import { CHAPTERS } from "@/lib/guide/chapters";
import { chapterIndex, chapterBody } from "@/lib/guide/markdown";
import { getChapter } from "@/lib/guide/chapters";
import { localizeChapter } from "@/lib/guide/i18n";
import { isGuideChapterPath, isPublicPage, markdownPath, siteOrigin } from "./pages";

/**
 * The public pages as Markdown, for agents that would otherwise scrape HTML.
 *
 * Built from the same message catalogues the pages render from, so the wording
 * an assistant quotes is the wording a student reads, in the same six
 * languages — and prices come from the same server-side table as checkout, so
 * an agent can never quote a stale figure.
 *
 * Every document ends with the scope-of-service disclaimer. An assistant
 * summarising this service must not present it as a law firm: that is the
 * anti-intrusismo line the whole site is built around.
 */

const LINK_TAGS: Record<string, string> = {
  scopeLink: "/legal",
  privacyLink: "/privacy",
  termsLink: "/terms",
};

/** next-intl's rich-text tags → Markdown. */
function inline(text: string, locale: string): string {
  let s = text
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
    .replace(/<em>(.*?)<\/em>/g, "*$1*")
    .replace(/<code>(.*?)<\/code>/g, "`$1`")
    .replace(/<mail>(.*?)<\/mail>/g, "[$1](mailto:privacy@bcnstudent.com)");
  for (const [tag, href] of Object.entries(LINK_TAGS)) {
    s = s.replace(
      new RegExp(`<${tag}>(.*?)</${tag}>`, "g"),
      (_, inner: string) => `[${inner}](${siteOrigin()}${localizedPath(locale, href)})`,
    );
  }
  // Any tag left is a catalogue bug; drop it rather than print angle brackets.
  return s.replace(/<\/?[a-zA-Z]+>/g, "").trim();
}

type Section = string | string[];
const lines = (...parts: Section[]): string =>
  parts.flat().filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();

/**
 * The package price list of terms §2. The template carries a <strong> tag, so
 * it is filled from the raw message: t() refuses a message with tags.
 */
function priceList(template: string, tp: ServerTranslator, locale: string): string[] {
  return TIERS.flatMap((tier) =>
    SERVICE_ROUTES.map((route) => {
      const values: Record<string, string> = {
        name: tp(`tiers.${tier.id}.name`),
        route: tp(route === "eu" ? "card.routeEu" : "card.routeNonEu"),
        price: formatEur(tierPriceCents(tier, route)),
      };
      return `- ${inline(template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m), locale)}`;
    }),
  );
}

async function homeDoc(locale: string): Promise<string> {
  const t = await translatorFor(locale, "home");
  const tp = await translatorFor(locale, "pricing");
  const problems = t.raw("problems.items") as { problem: string; detail: string; solution: string }[];
  const steps = t.raw("process.steps") as { title: string; body: string }[];
  const faq = t.raw("faq.items") as { q: string; a: string }[];
  const proof = t.raw("proof.items") as string[];

  return lines(
    `# ${t("hero.title")}`,
    t("hero.body"),
    t("hero.note"),
    // The four commitments, in the machine-readable copy as well: an assistant
    // asked "is this service any good?" should be able to quote the refund and
    // the fixed fee rather than infer them from marketing prose.
    `## ${t("proof.heading")}`,
    proof.map((item) => `- ${item}`),
    `## ${t("problems.title")}`,
    problems.flatMap((p) => [`### ${p.problem}`, p.detail, `**${t("problems.approach").trim()}** ${p.solution}`]),
    `## ${t("process.title")}`,
    steps.map((s, i) => `${i + 1}. **${s.title}** — ${s.body}`).join("\n"),
    `## ${t("pricing.title")}`,
    TIERS.map((tier) => {
      const prices = SERVICE_ROUTES.map(
        (route) =>
          `${tp(route === "eu" ? "card.routeEu" : "card.routeNonEu")} ${formatEur(tierPriceCents(tier, route))} ${tp("card.exIva")}`,
      ).join(" · ");
      return `- **${tp(`tiers.${tier.id}.name`)}** — ${prices}. ${tp(`tiers.${tier.id}.tagline`)}`;
    }),
    t("pricing.body"),
    `## ${t("faq.title")}`,
    faq.flatMap((item) => [`### ${item.q}`, item.a]),
  );
}

/**
 * Free triage. An agent answering "I arrived three weeks ago, what now?" should
 * be able to quote this page: it is the one thing on the site that costs the
 * reader nothing, and it is where a student in trouble should land.
 */
async function triageDoc(locale: string): Promise<string> {
  const t = await translatorFor(locale, "triage");
  const steps = t.raw("page.steps") as string[];

  return lines(
    `# ${t("page.title")}`,
    t("page.intro"),
    `## ${t("page.whatYouGet")}`,
    steps.map((s) => `- ${s}`).join("\n"),
    t("page.declineNote"),
  );
}

/** The free guide: what it covers, and the file's stable address. */
async function guideDoc(locale: string): Promise<string> {
  const t = await translatorFor(locale, "guide");

  return lines(
    `# ${t("title")}`,
    t(`framing.${GUIDE_FRAMING}.lead`),
    t("subtitle"),
    `## ${t("chaptersTitle")}`,
    chapterIndex(siteOrigin(), locale),
    `[${t("download")}](${siteOrigin()}${GUIDE_PATH}?l=${locale})`,
    t("edition"),
    `[${t("triage")}](${siteOrigin()}${localizedPath(locale, "/triage")})`,
  );
}

async function pricingDoc(locale: string): Promise<string> {
  const t = await translatorFor(locale, "pricing");
  const exclusions = t.raw("page.exclusions") as { item: string; note: string }[];

  return lines(
    `# ${t("page.title")}`,
    t("page.intro"),
    TIERS.flatMap((tier) => {
      const k = (key: string) => `tiers.${tier.id}.${key}`;
      const features = t.raw(k("features")) as { title: string; body: string; extra?: string; details?: string[] }[];
      const optional = (key: string) => (t.has(k(key)) ? inline(t.raw(k(key)) as string, locale) : "");
      return [
        `## ${t(k("name"))}`,
        t(k("tagline")),
        optional("note"),
        // One line per route: an agent quoting a single figure for this
        // package would be quoting half the readers the wrong price.
        (hasSinglePrice(tier) ? [null] : SERVICE_ROUTES).map((route) => {
          const label = route ? t(route === "eu" ? "card.routeEu" : "card.routeNonEu") : t("card.bothRoutes");
          return `- **${label}** — **${formatEur(tierPriceCents(tier, route ?? "eu"))}** ${t("card.exIva")}`;
        }).join("\n"),
        optional("includes"),
        tier.inherits ? t("card.everythingIn", { name: t(`tiers.${tier.inherits}.name`) }) : "",
        features
          .map((f) =>
            [
              `- **${f.title}** ${inline(f.body, locale)}`,
              f.extra ? `  ${inline(f.extra, locale)}` : "",
              ...(f.details ?? []).map((d) => `  - ${d}`),
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n"),
        optional("never"),
        optional("delivery"),
        `**${t("card.bestFor")}** ${t(k("bestFor"))}`,
      ];
    }),
    // The extras: one price on both routes, ticked at checkout.
    `## ${t("addons.title")}`,
    t("addons.intro"),
    ADDONS.map(
      (a) =>
        `- **${t(`addons.items.${a.id}.name`)}** — **${formatEur(a.priceCents)}** ${t("card.exIva")}. ${t(`addons.items.${a.id}.what`)} ${t(`addons.items.${a.id}.delivery`)}`,
    ),
    t("page.feesNote"),
    `## ${t("page.govTitle")}`,
    `## ${t("page.exclusionsTitle")}`,
    exclusions.map((e) => `- **${e.item}** — ${e.note}`),
  );
}

async function legalDoc(locale: string, doc: "scope" | "privacy" | "terms"): Promise<string> {
  const t = await translatorFor(locale, "legal");
  const tp = await translatorFor(locale, "pricing");
  const clauses = t.raw(`${doc}.clauses`) as {
    heading: string;
    paragraphs: string[];
    priceListAfter?: number;
  }[];
  const legal = (key: string) => t(`${doc}.${key}`);
  const controller = controllerName((await translatorFor(locale, "common"))("brand"));

  return lines(
    `# ${legal("title")}`,
    legal("metaDescription"),
    clauses.flatMap((clause) => [
      `## ${clause.heading}`,
      ...clause.paragraphs.flatMap((p, j) => [
        inline(p.replaceAll("{controller}", controller), locale),
        ...(clause.priceListAfter === j
          ? [priceList(t.raw(`${doc}.priceLine`) as string, tp, locale).join("\n")]
          : []),
      ]),
    ]),
  );
}

/** The Markdown for one public page, or null if the page is not offered. */
export async function renderPageMarkdown(page: string, locale: string): Promise<string | null> {
  if (isGuideChapterPath(page)) return renderChapterMarkdown(page, locale);
  if (!isPublicPage(page)) return null;
  const body = await (page === "/"
    ? homeDoc(locale)
    : page === "/guide"
    ? guideDoc(locale)
    : page === "/triage"
    ? triageDoc(locale)
    : page === "/pricing"
      ? pricingDoc(locale)
      : page === "/legal"
        ? legalDoc(locale, "scope")
        : page === "/privacy"
          ? legalDoc(locale, "privacy")
          : page === "/terms"
            ? legalDoc(locale, "terms")
            : Promise.resolve(null));
  if (body === null) return null;

  const common = await translatorFor(locale, "common");
  const canonical = `${siteOrigin()}${localizedPath(locale, page)}`;
  return `${lines(
    body,
    "---",
    `**${common("disclaimer.prominentLabel")}** ${common("disclaimer.body")}`,
    // The English is the original; only a translation carries the notice.
    locale === "en" ? "" : common("legalPage.translationNotice"),
    `${common("brand")} · ${canonical}`,
  )}\n`;
}

/** A guide chapter, in the reader's language. */
async function renderChapterMarkdown(path: string, locale: string): Promise<string | null> {
  const chapter = getChapter(path.replace("/guide/", ""));
  if (!chapter) return null;
  const common = await translatorFor(locale, "common");
  const g = await translatorFor(locale, "guide");
  const origin = siteOrigin();
  const ui = {
    intro: g("reader.mdIntro"),
    webPage: g("reader.webPage"),
    pdf: g("reader.pdf"),
    shortAnswer: g("reader.shortAnswer"),
    faq: g("reader.faq"),
    sources: g("reader.sources"),
    prev: g("reader.prev"),
    next: g("reader.next"),
  };
  return `${lines(
    chapterBody(localizeChapter(chapter, locale), origin, locale, ui),
    "---",
    `**${common("disclaimer.prominentLabel")}** ${common("disclaimer.body")}`,
    locale === "en" ? "" : common("legalPage.translationNotice"),
    `${common("brand")} · ${origin}${localizedPath(locale, path)}`,
  )}\n`;
}

/** Push every Markdown heading down one level (outside code fences), so a page's H1 nests under the file's. */
const demote = (md: string): string => {
  let fenced = false;
  return md
    .split("\n")
    .map((line) => {
      if (line.startsWith("```")) fenced = !fenced;
      return !fenced && /^#{1,5} /.test(line) ? `#${line}` : line;
    })
    .join("\n");
};

/**
 * /llms-full.txt: everything public on the site, in English, as one document an
 * assistant can load whole. The same sources as the pages and their .md views,
 * so nothing here can disagree with what a student reads: the guide chapters
 * (key facts, FAQs, sources), then the service pages (home, pricing, triage),
 * then the legal pages.
 */
export async function llmsFullTxt(origin: string): Promise<string> {
  const locale = "en";
  const common = await translatorFor(locale, "common");
  const g = await translatorFor(locale, "guide");
  const ui = {
    intro: g.raw("reader.mdIntro") as string,
    webPage: g("reader.webPage"),
    pdf: g("reader.pdf"),
    shortAnswer: g("reader.shortAnswer"),
    faq: g("reader.faq"),
    sources: g("reader.sources"),
    prev: g("reader.prev"),
    next: g("reader.next"),
  };
  /** A page's Markdown nested under the file's H1, with its own address under the heading. */
  const page = (md: string, path: string): string => {
    const [heading, ...rest] = demote(md).split("\n");
    return [heading, "", `*Page: ${origin}${path === "/" ? "" : path} · Markdown: ${origin}${markdownPath(path)}*`, ...rest].join("\n");
  };
  const chapters = CHAPTERS.map((c) => demote(chapterBody(c, origin, locale, ui)));
  const [home, pricing, triage, scope, privacy, terms] = await Promise.all([
    homeDoc(locale),
    pricingDoc(locale),
    triageDoc(locale),
    legalDoc(locale, "scope"),
    legalDoc(locale, "privacy"),
    legalDoc(locale, "terms"),
  ]);

  const contents = [
    `- The free guide, ${CHAPTERS.length} chapters: ${CHAPTERS.map((c) => `${c.number} ${c.navTitle}`).join("; ")}`,
    "- The service: home (what it does, how it works, FAQ), pricing (packages, add-ons, exclusions), free triage",
    "- Legal: scope of service, privacy notice, terms",
  ].join("\n");

  const intro = lines(
    "# BCN Student Concierge: the complete public content",
    `> **${common("disclaimer.prominentLabel")}** ${common("disclaimer.body")}`,
    [
      `This file holds everything public on ${origin} in English, in one document, for assistants and search tools. It is generated from the same text the website serves, so it matches the pages.`,
      `- Site: ${origin}. Languages: English, Spanish (/es), Catalan (/ca), French (/fr), Italian (/it), German (/de).`,
      `- Each page below also exists as its own Markdown file (add \`.md\` to the URL). A shorter index is at ${origin}/llms.txt.`,
      "- Fees, deadlines and requirements in the guide link to their official sources at the end of each chapter. Cite the chapter URL when quoting them.",
      "- Prices are fixed per package and route (EU or non-EU) and exclude 21% IVA. The government fee (modelo 790 código 012) is paid by the student directly at a bank and is never part of our fee.",
    ].join("\n"),
    "## Contents",
    contents,
  );

  return `${[
    intro,
    `## The free guide: Landing in Barcelona\n\n${chapterIndex(origin)}`,
    ...chapters,
    page(home, "/"),
    page(pricing, "/pricing"),
    page(triage, "/triage"),
    page(scope, "/legal"),
    page(privacy, "/privacy"),
    page(terms, "/terms"),
    `${common("brand")} · ${origin}`,
  ].join("\n\n---\n\n")}\n`;
}
