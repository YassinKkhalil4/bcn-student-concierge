import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Blocks } from "@/components/guide/Blocks";
import { Inline } from "@/components/guide/Inline";
import { ArrowMark, DownloadMark } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { siteOrigin } from "@/lib/agents/pages";
import { GUIDE_EDITION, GUIDE_PATH } from "@/lib/guide";
import { CHAPTERS, chapterNeighbours, chapterPath, getChapter } from "@/lib/guide/chapters";
import { breadcrumbs, faqPage, graph, guideArticle, organization, website } from "@/lib/structured-data";

/*
 * One chapter of Landing in Barcelona, read on the page.
 *
 * English only. The guide is not translated, so the other five languages have
 * no page to show: middleware sends /fr/guide/<slug> to /guide/<slug>, and the
 * page carries a canonical and no hreflang set, because an alternates list
 * that points at English from every language would be a false one.
 */

type Params = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = true;
export function generateStaticParams() {
  return CHAPTERS.map((c) => ({ locale: "en", slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const c = getChapter(slug);
  if (!c) return {};
  const url = `${siteOrigin()}${chapterPath(c.slug)}`;
  return {
    title: { absolute: c.metaTitle },
    description: c.description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: c.metaTitle, description: c.description, siteName: "BCN Student Concierge" },
  };
}

export default async function ChapterPage({ params }: Params) {
  const { locale, slug } = await params;
  const c = getChapter(slug);
  if (!c) notFound();
  if (locale !== "en") redirect(chapterPath(c.slug));
  setRequestLocale(locale);

  const tc = await getTranslations({ locale, namespace: "common" });
  const brand = tc("brand");
  const { prev, next } = chapterNeighbours(c.slug);
  const origin = siteOrigin();

  return (
    <>
      <JsonLd
        json={graph(
          organization(brand, c.description),
          website(brand, locale),
          guideArticle(c, GUIDE_EDITION),
          breadcrumbs(
            [
              { name: brand, page: "/" },
              { name: "Free guide", page: "/guide" },
              { name: c.navTitle, page: chapterPath(c.slug) },
            ],
            "en",
          ),
          ...(c.faq?.length ? [faqPage(c.faq)] : []),
        )}
      />

      <div className="container-x grid gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-16">
        {/* Contents: the whole guide, this chapter marked. */}
        <nav aria-label="Guide chapters" className="lg:sticky lg:top-24 lg:self-start">
          <p className="rule-label">
            <Link href="/guide">Landing in Barcelona</Link>
          </p>
          <ol className="mt-4 border-t-2 border-ink">
            {CHAPTERS.map((ch) => (
              <li key={ch.slug} className="border-b border-paper-line">
                <Link
                  href={chapterPath(ch.slug)}
                  aria-current={ch.slug === c.slug ? "page" : undefined}
                  className={`flex gap-3 py-2 text-sm ${
                    ch.slug === c.slug ? "font-bold text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <span className="w-8 flex-none font-mono text-xs text-accent">{ch.number}</span>
                  <span>{ch.navTitle}</span>
                </Link>
              </li>
            ))}
          </ol>
          <a href={GUIDE_PATH} download className="btn-quiet mt-5 !text-sm">
            <DownloadMark className="h-4 w-4 flex-none" />
            Prefer the PDF? Download it
          </a>
        </nav>

        <article className="min-w-0 max-w-3xl">
          <p className="rule-label">{c.kicker}</p>
          <h1 className="mt-5 text-display-lg text-ink">{c.title}</h1>
          <p className="mt-5 font-serif text-lede text-ink-muted">
            <Inline text={c.lede} />
          </p>

          <section aria-labelledby="key-facts" className="mt-8 border-y-2 border-ink py-5">
            <h2 id="key-facts" className="font-mono text-xs font-medium uppercase tracking-wider text-accent">
              The short answer
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
            <Blocks blocks={c.blocks} />
          </div>

          {c.faq && c.faq.length > 0 && (
            <section aria-labelledby="faq" className="mt-14">
              <h2 id="faq" className="text-display-lg text-ink [font-size:clamp(1.4rem,1.1rem+1.2vw,2rem)]">
                Questions people ask
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

          {c.sources.length > 0 && (
            <section aria-labelledby="sources" className="mt-12">
              <h2 id="sources" className="font-mono text-xs font-medium uppercase tracking-wider text-ink-soft">
                Official sources
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
              <p className="mt-4 text-sm text-ink-soft">
                Edition of {new Date(GUIDE_EDITION).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.
                Rules and fees change: check the official page before you pay or travel. This guide is general information, not legal advice.
              </p>
            </section>
          )}

          <nav aria-label="Previous and next chapter" className="mt-12 grid gap-px border border-paper-edge bg-paper-edge sm:grid-cols-2">
            {prev ? (
              <Link href={chapterPath(prev.slug)} rel="prev" className="bg-paper px-5 py-4 hover:bg-paper-dim">
                <span className="font-mono text-xs text-ink-soft">Previous · {prev.number}</span>
                <span className="mt-1 block font-sans font-bold text-ink">{prev.navTitle}</span>
              </Link>
            ) : (
              <span className="hidden bg-paper sm:block" />
            )}
            {next ? (
              <Link href={chapterPath(next.slug)} rel="next" className="bg-paper px-5 py-4 text-left hover:bg-paper-dim sm:text-right">
                <span className="font-mono text-xs text-ink-soft">Next · {next.number}</span>
                <span className="mt-1 block font-sans font-bold text-ink">{next.navTitle}</span>
              </Link>
            ) : (
              <Link href="/triage" className="bg-paper px-5 py-4 hover:bg-paper-dim sm:text-right">
                <span className="font-mono text-xs text-ink-soft">Finished?</span>
                <span className="mt-1 block font-sans font-bold text-ink">
                  Check where your paperwork stands <ArrowMark className="inline h-4 w-4" />
                </span>
              </Link>
            )}
          </nav>
        </article>
      </div>
    </>
  );
}
