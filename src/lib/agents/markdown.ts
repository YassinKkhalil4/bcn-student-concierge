import { translatorFor, type ServerTranslator } from "@/i18n/messages";
import { localizedPath } from "@/i18n/routing";
import { IVA_RATE, TIERS, formatEur, priceWithIva } from "@/lib/pricing";
import { siteOrigin, type PublicPage } from "./pages";

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
  return TIERS.map((tier) => {
    const p = priceWithIva(tier.basePriceCents);
    const values: Record<string, string> = {
      name: tp(`tiers.${tier.id}.name`),
      base: formatEur(p.baseCents),
      iva: formatEur(p.ivaCents),
      total: formatEur(p.totalCents),
    };
    return `- ${inline(template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m), locale)}`;
  });
}

async function homeDoc(locale: string): Promise<string> {
  const t = await translatorFor(locale, "home");
  const tp = await translatorFor(locale, "pricing");
  const problems = t.raw("problems.items") as { problem: string; detail: string; solution: string }[];
  const steps = t.raw("process.steps") as { title: string; body: string }[];
  const faq = t.raw("faq.items") as { q: string; a: string }[];

  return lines(
    `# ${t("hero.title")}`,
    t("hero.body"),
    t("hero.note"),
    `## ${t("problems.title")}`,
    problems.flatMap((p) => [`### ${p.problem}`, p.detail, `**${t("problems.approach").trim()}** ${p.solution}`]),
    `## ${t("process.title")}`,
    steps.map((s, i) => `${i + 1}. **${s.title}** — ${s.body}`).join("\n"),
    `## ${t("pricing.title")}`,
    TIERS.map((tier) => {
      const p = priceWithIva(tier.basePriceCents);
      return `- **${tp(`tiers.${tier.id}.name`)}** — ${formatEur(p.baseCents)} + ${formatEur(
        p.ivaCents,
      )} IVA = **${formatEur(p.totalCents)}**. ${tp(`tiers.${tier.id}.tagline`)}`;
    }),
    t("pricing.body"),
    `## ${t("faq.title")}`,
    faq.flatMap((item) => [`### ${item.q}`, item.a]),
  );
}

async function pricingDoc(locale: string): Promise<string> {
  const t = await translatorFor(locale, "pricing");
  const exclusions = t.raw("page.exclusions") as { item: string; note: string }[];

  return lines(
    `# ${t("page.title")}`,
    t("page.intro", { rate: String(Math.round(IVA_RATE * 100)) }),
    TIERS.flatMap((tier) => {
      const p = priceWithIva(tier.basePriceCents);
      const features = t.raw(`tiers.${tier.id}.features`) as string[];
      return [
        `## ${t(`tiers.${tier.id}.name`)} — ${formatEur(p.totalCents)}`,
        t(`tiers.${tier.id}.tagline`),
        `${formatEur(p.baseCents)} + ${formatEur(p.ivaCents)} IVA (${Math.round(IVA_RATE * 100)}%) = **${formatEur(p.totalCents)}**`,
        `**${t("card.bestFor")}** ${t(`tiers.${tier.id}.bestFor`)}`,
        features.map((f) => `- ${f}`).join("\n"),
      ];
    }),
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

  return lines(
    `# ${legal("title")}`,
    legal("metaDescription"),
    clauses.flatMap((clause) => [
      `## ${clause.heading}`,
      ...clause.paragraphs.flatMap((p, j) => [
        inline(p, locale),
        ...(clause.priceListAfter === j
          ? [priceList(t.raw(`${doc}.priceLine`) as string, tp, locale).join("\n")]
          : []),
      ]),
    ]),
  );
}

/** The Markdown for one public page, or null if the page is not offered. */
export async function renderPageMarkdown(page: PublicPage, locale: string): Promise<string | null> {
  const body = await (page === "/"
    ? homeDoc(locale)
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
