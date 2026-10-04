import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LOCALES } from "@/i18n/routing";
import { Blocks } from "@/components/guide/Blocks";
import { Inline } from "@/components/guide/Inline";
import { Chip } from "@/components/guide/Visuals";
import { ArrowMark, DownloadMark } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { alternatesFor, pageUrl } from "@/lib/seo";
import { GUIDE_EDITION, GUIDE_PATH } from "@/lib/guide";
import { CHAPTERS, chapterNeighbours, chapterPath, getChapter } from "@/lib/guide/chapters";
import { localizeChapter } from "@/lib/guide/i18n";
import { breadcrumbs, faqPage, graph, guideArticle, organization, website } from "@/lib/structured-data";

/*
 * One chapter of Landing in Barcelona, read on the page, in the visitor's
 * language. The chapter is English data; localizeChapter swaps in the
 * translation of every string (src/lib/guide/i18n.ts). Each language has its
 * own URL, its own canonical and the full hreflang set.
 */

type Params = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => CHAPTERS.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const raw = getChapter(slug);
  if (!raw) return {};
  const c = localizeChapter(raw, locale);
  const page = chapterPath(slug);
  return {
    title: { absolute: c.metaTitle },
    description: c.description,
    alternates: alternatesFor(page, locale),
    openGraph: { type: "article", url: pageUrl(page, locale), title: c.metaTitle, description: c.description, siteName: "BCN Student Concierge" },
  };
}

export default async function ChapterPage({ params }: Params) {
  const { locale, slug } = await params;
  const raw = getChapter(slug);
  if (!raw) notFound();
  setRequestLocale(locale);

  const c = localizeChapter(raw, locale);
  const t = await getTranslations({ locale, namespace: "guide" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const brand = tc("brand");
  const { prev, next } = chapterNeighbours(c.slug);
  const nav = CHAPTERS.map((ch) => localizeChapter(ch, locale));
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(GUIDE_EDITION));
  const callouts = { key: t("reader.callKey"), note: t("reader.callNote"), warning: t("reader.callWarning"), tip: t("reader.callTip") };
  const downloadHref = `${GUIDE_PATH}?l=${locale}`;

  return (
    <>
      <JsonLd
        json={graph(
          organization(brand, c.description),
          website(brand, locale),
          guideArticle(c, GUIDE_EDITION, locale),
          breadcrumbs([{ name: brand, page: "/" }, { name: t("reader.breadcrumb"), page: "/guide" }, { name: c.navTitle, page: chapterPath(c.slug) }], locale),
          ...(c.faq?.length ? [faqPage(c.faq)] : []),
        )}
      />

      <div className="container-x grid gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-14">
        <nav aria-label={t("reader.contents")} className="lg:sticky lg:top-24 lg:self-start">
          <p className="rule-label">
            <Link href="/guide">Landing in Barcelona</Link>
          </p>
          <ol className="mt-4 border-t-2 border-ink">
            {nav.map((ch, i) => (
              <li key={ch.slug} className="border-b border-paper-line">
                {(i === 0 || nav[i - 1]!.part !== ch.part) && (
                  <span className="block pt-3 font-mono text-[0.625rem] uppercase tracking-wider text-ink-soft">{ch.part}</span>
                )}
                <Link
                  href={chapterPath(ch.slug)}
                  aria-current={ch.slug === c.slug ? "page" : undefined}
                  className={`flex gap-3 py-2 text-sm ${ch.slug === c.slug ? "font-bold text-ink" : "text-ink-muted hover:text-ink"}`}
                >
                  <span className="w-6 flex-none font-mono text-xs text-accent">{ch.number}</span>
                  <span>{ch.navTitle}</span>
                </Link>
              </li>
            ))}
          </ol>
          <a href={downloadHref} download className="btn-quiet mt-5 !text-sm">
            <DownloadMark className="h-4 w-4 flex-none" />
            {t("reader.pdfLink")}
          </a>
        </nav>

        <article className="min-w-0 max-w-3xl">
          <p className="flex flex-wrap items-center gap-2">
            <span className="rule-label">{c.kicker}</span>
            {c.audience.map((a) => (
              <Chip key={a.label} tone={a.tone}>{a.label}</Chip>
            ))}
          </p>
          <h1 className="mt-5 text-display-lg text-ink">{c.title}</h1>
          <p className="mt-5 font-serif text-lede text-ink-muted">
            <Inline text={c.lede} />
          </p>

          <section aria-labelledby="key-facts" className="mt-8 border-y-2 border-ink py-5">
            <h2 id="key-facts" className="font-mono text-xs font-medium uppercase tracking-wider text-accent">
              {t("reader.shortAnswer")}
            </h2>
            <ul className="mt-3 space-y-2">
              {c.keyFacts.map((fact) => (
                <li key={fact} className="prose-body flex gap-3">
                  <span aria-hidden className="mt-2.5 h-1.5 w-1.5 flex-none bg-accent" />
                  <span>
                    <Inline text={fact} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-10">
            <Blocks blocks={c.blocks} callouts={callouts} />
          </div>

          {c.faq && c.faq.length > 0 && (
            <section aria-labelledby="faq" className="mt-14">
              <h2 id="faq" className="text-display-lg text-ink [font-size:clamp(1.4rem,1.1rem+1.2vw,2rem)]">
                {t("reader.faq")}
              </h2>
              <dl className="mt-5 border-t-2 border-ink">
                {c.faq.map((f) => (
                  <div key={f.q} className="border-b border-paper-line py-5">
                    <dt className="font-sans text-lg font-bold tracking-tight text-ink">{f.q}</dt>
                    <dd className="prose-body mt-2">
                      <Inline text={f.a} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section aria-labelledby="sources" className="mt-12">
            {c.sources.length > 0 && (
              <>
                <h2 id="sources" className="font-mono text-xs font-medium uppercase tracking-wider text-ink-soft">
                  {t("reader.sources")}
                </h2>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {c.sources.map((s) => (
                    <li key={s.label}>
                      {s.url ? (
                        <a href={s.url} rel="noopener noreferrer" className="text-accent-deep underline underline-offset-2">
                          {s.label}
                        </a>
                      ) : (
                        s.label
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-4 text-sm text-ink-soft">{t("reader.edition", { date })}</p>
          </section>

          <nav aria-label={t("reader.contents")} className="mt-12 grid gap-px border border-paper-edge bg-paper-edge sm:grid-cols-2">
            {prev ? (
              <Link href={chapterPath(prev.slug)} rel="prev" className="bg-paper px-5 py-4 hover:bg-paper-dim">
                <span className="font-mono text-xs text-ink-soft">{t("reader.prev")} · {prev.number}</span>
                <span className="mt-1 block font-sans font-bold text-ink">{nav.find((n) => n.slug === prev.slug)!.navTitle}</span>
              </Link>
            ) : (
              <span className="hidden bg-paper sm:block" />
            )}
            {next ? (
              <Link href={chapterPath(next.slug)} rel="next" className="bg-paper px-5 py-4 text-left hover:bg-paper-dim sm:text-right">
                <span className="font-mono text-xs text-ink-soft">{t("reader.next")} · {next.number}</span>
                <span className="mt-1 block font-sans font-bold text-ink">{nav.find((n) => n.slug === next.slug)!.navTitle}</span>
              </Link>
            ) : (
              <Link href="/triage" className="bg-paper px-5 py-4 hover:bg-paper-dim sm:text-right">
                <span className="font-mono text-xs text-ink-soft">{t("reader.finished")}</span>
                <span className="mt-1 block font-sans font-bold text-ink">
                  {t("reader.triageCta")} <ArrowMark className="inline h-4 w-4" />
                </span>
              </Link>
            )}
          </nav>
        </article>
      </div>
    </>
  );
}
