import { translatorFor, type ServerTranslator } from "@/i18n/messages";
import { localizedPath } from "@/i18n/routing";
import { TIERS, formatEur, hasSinglePrice, tierPriceCents, SERVICE_ROUTES } from "@/lib/pricing";
import { GUIDE_FRAMING, GUIDE_PATH } from "@/lib/guide";
import { controllerName } from "@/lib/provider";
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
        (route) => `${tp(route === "eu" ? "card.routeEu" : "card.routeNonEu")} ${formatEur(tierPriceCents(tier, route))}`,
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
  const sections = t.raw("sections") as { number: string; title: string; detail?: string }[];

  return lines(
    `# ${t("title")}`,
    t(`framing.${GUIDE_FRAMING}.lead`),
    t("subtitle"),
    `[${t("download")}](${siteOrigin()}${GUIDE_PATH})`,
    `## ${t("insideTitle")}`,
    sections.map((s) => `- **${s.number}** ${s.title}${s.detail ? ` — ${s.detail}` : ""}`).join("\n"),
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
          return `- **${label}** — **${formatEur(tierPriceCents(tier, route ?? "eu"))}**`;
        }).join("\n"),
        tier.waitlist ? `**${t("card.waitlist")}**` : "",
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
export async function renderPageMarkdown(page: PublicPage, locale: string): Promise<string | null> {
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
