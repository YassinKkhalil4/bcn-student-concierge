import type { Metadata } from "next";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SOURCE_PARAM, parseSource, type GuideSource } from "@/lib/attribution";
import { GUIDE_FILENAME, GUIDE_FRAMING, GUIDE_PATH } from "@/lib/guide";
import { alternatesFor } from "@/lib/seo";
import { DownloadMark } from "@/components/icons";
import cover from "../../../../assets/guide/cover.png";

/*
 * This page used to declare its own three typefaces and its own navy and red
 * as local constants, because it was the only part of the site that looked
 * like the brand. It is now the other way round: the guide's language became
 * the site's design system, so the page just uses the tokens.
 */

type Params = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guide" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/guide", locale),
  };
}

export default async function GuidePage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = (await searchParams)[SOURCE_PARAM];
  return <Guide locale={locale} source={parseSource(Array.isArray(s) ? s[0] : s)} />;
}

interface Section {
  number: string;
  title: string;
  detail?: string;
}

/**
 * /guide — the lead magnet, UNGATED. No email, no form, no modal before the
 * file: the guide tells readers they can do all of this themselves, and
 * /triage already asks for far more than an email ever would.
 *
 * Order is fixed: the cover, the promise, the download (the dominant action),
 * what is inside, the edition — and only then, beneath the download, one
 * triage link. Do not move the triage link above the download.
 */
function Guide({ locale, source }: { locale: string; source: GuideSource | null }) {
  const t = useTranslations("guide");
  const framing = (key: "eyebrow" | "lead") => t(`framing.${GUIDE_FRAMING}.${key}`);
  const sections = t.raw("sections") as Section[];

  // The link itself carries the school and the language, so a download is
  // attributed even where the browser keeps no cookie.
  const query = new URLSearchParams({ ...(source ? { [SOURCE_PARAM]: source } : {}), l: locale });
  const downloadHref = `${GUIDE_PATH}?${query}`;

  return (
    <div>
      <section className="on-ink">
        <div className="container-x grid items-center gap-8 py-8 sm:gap-10 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-20">
          {/* 1 — the cover, page 1 of the PDF itself */}
          <Image
            src={cover}
            alt={t("coverAlt")}
            priority
            // Served as the file itself: a 115 KB PNG gains nothing from the
            // optimiser, and the standalone server then needs no image library.
            unoptimized
            className="chamfer mx-auto w-[46%] max-w-[340px] shadow-2xl shadow-ink-deep/70 [--chamfer:14px] sm:w-[60%] sm:[--chamfer:22px] lg:w-full lg:max-w-[420px]"
          />

          <div>
            <p className="rule-label">{framing("eyebrow")}</p>

            {/* 2 — the promise */}
            <h1 className="mt-6 max-w-[20ch] text-display-lg text-onink">{t("title")}</h1>
            <p className="mt-5 max-w-xl font-serif text-lede text-onink-muted">{t("subtitle")}</p>

            {/* 3 — the download: the one dominant action on the page */}
            <a
              href={downloadHref}
              download={GUIDE_FILENAME}
              className="btn-primary mt-8 w-full !px-8 !py-4 !text-base sm:w-auto"
            >
              <DownloadMark className="h-5 w-5 flex-none" />
              {t("download")}
            </a>

            <p className="mt-7 max-w-xl border-l-2 border-accent pl-4 font-serif text-read italic text-onink-muted">
              {framing("lead")}
            </p>
          </div>
        </div>
      </section>

      <section className="container-x section-band">
        {/* 4 — what's inside */}
        <h2 className="max-w-2xl text-display-lg text-ink">{t("insideTitle")}</h2>
        <ol className="mt-10 grid border-t-2 border-ink sm:grid-cols-2 sm:gap-x-14">
          {sections.map((section) => (
            <li key={section.number} className="flex gap-5 border-b border-paper-line py-4">
              <span className="w-8 flex-none pt-0.5 font-mono text-sm font-medium text-accent">
                {section.number}
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-sm font-bold tracking-tight text-ink">
                  {section.title}
                </span>
                {section.detail && <span className="prose-body mt-1 block">{section.detail}</span>}
              </span>
            </li>
          ))}
        </ol>

        {/* 5 — the edition */}
        <p className="mt-7 font-mono text-xs text-ink-soft">{t("edition")}</p>

        {/* 6 — beneath the download, never above it: one triage link */}
        <p className="mt-14 border-t border-paper-line pt-8">
          <Link
            href={{ pathname: "/triage", query: source ? { [SOURCE_PARAM]: source } : {} }}
            className="btn-quiet !text-base"
          >
            {t("triage")}
          </Link>
        </p>
      </section>
    </div>
  );
}
