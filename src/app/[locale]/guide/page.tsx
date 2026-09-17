import type { Metadata } from "next";
import Image from "next/image";
import { Archivo, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SOURCE_PARAM, parseSource, type GuideSource } from "@/lib/attribution";
import { GUIDE_FILENAME, GUIDE_FRAMING, GUIDE_PATH } from "@/lib/guide";
import { alternatesFor } from "@/lib/seo";
import cover from "../../../../assets/guide/cover.png";

/*
 * The guide's own type: Archivo for headings and UI, Source Serif 4 for body,
 * JetBrains Mono for section numbers and form codes. next/font self-hosts the
 * files at build time, so the page makes no request to Google.
 */
const archivo = Archivo({ subsets: ["latin"], variable: "--font-guide-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-guide-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-guide-mono", display: "swap" });

const NAVY = "#16202B";
const RED = "#C2263C";

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
    <div
      className={`${archivo.variable} ${serif.variable} ${mono.variable}`}
      style={{ fontFamily: "var(--font-guide-serif), Georgia, serif" }}
    >
      <section style={{ backgroundColor: NAVY }} className="text-white">
        <div className="container-x grid items-center gap-8 py-8 sm:gap-10 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-20">
          {/* 1 — the cover, page 1 of the PDF itself */}
          <Image
            src={cover}
            alt={t("coverAlt")}
            priority
            // Served as the file itself: a 115 KB PNG gains nothing from the
            // optimiser, and the standalone server then needs no image library.
            unoptimized
            className="chamfer mx-auto w-[46%] max-w-[340px] shadow-2xl shadow-black/40 [--chamfer:14px] sm:w-[60%] sm:[--chamfer:22px] lg:w-full lg:max-w-[420px]"
          />

          <div>
            <p
              className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/70"
              style={{ fontFamily: "var(--font-guide-sans)" }}
            >
              <span aria-hidden="true" className="inline-block h-px w-10" style={{ backgroundColor: RED }} />
              {framing("eyebrow")}
            </p>

            {/* 2 — the promise */}
            <h1
              className="mt-4 text-[2.1rem] font-extrabold leading-[1.05] tracking-tight sm:mt-5 sm:text-5xl"
              style={{ fontFamily: "var(--font-guide-sans)" }}
            >
              {t("title")}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80 sm:mt-5 sm:text-lg">{t("subtitle")}</p>

            {/* 3 — the download: the one dominant action on the page */}
            <a
              href={downloadHref}
              download={GUIDE_FILENAME}
              className="chamfer mt-6 inline-flex w-full items-center justify-center gap-3 px-7 py-4 text-base font-bold text-white transition-[filter] hover:brightness-110 focus-visible:ring-white focus-visible:ring-offset-[#16202B] sm:w-auto"
              style={{ backgroundColor: RED, fontFamily: "var(--font-guide-sans)" }}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 flex-none" fill="currentColor">
                <path d="M10 2a1 1 0 0 1 1 1v8.6l2.8-2.8a1 1 0 1 1 1.4 1.4l-4.5 4.5a1 1 0 0 1-1.4 0L4.8 10.2a1 1 0 0 1 1.4-1.4L9 11.6V3a1 1 0 0 1 1-1ZM3 16a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z" />
              </svg>
              {t("download")}
            </a>

            <p className="mt-6 max-w-xl border-l-2 pl-4 text-sm italic leading-relaxed text-white/70" style={{ borderColor: RED }}>
              {framing("lead")}
            </p>
          </div>
        </div>
      </section>

      <section className="container-x py-14 sm:py-20">
        {/* 4 — what's inside */}
        <h2
          className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl"
          style={{ fontFamily: "var(--font-guide-sans)", color: NAVY }}
        >
          {t("insideTitle")}
        </h2>
        <ol className="mt-8 grid border-t border-bone-line sm:grid-cols-2 sm:gap-x-10">
          {sections.map((section) => (
            <li key={section.number} className="flex gap-4 border-b border-bone-line py-3.5">
              <span
                className="w-9 flex-none pt-0.5 text-sm font-semibold"
                style={{ fontFamily: "var(--font-guide-mono)", color: RED }}
              >
                {section.number}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink" style={{ fontFamily: "var(--font-guide-sans)" }}>
                  {section.title}
                </span>
                {section.detail && <span className="block text-sm leading-relaxed text-ink-muted">{section.detail}</span>}
              </span>
            </li>
          ))}
        </ol>

        {/* 5 — the edition */}
        <p className="mt-6 text-xs text-ink-soft" style={{ fontFamily: "var(--font-guide-mono)" }}>
          {t("edition")}
        </p>

        {/* 6 — beneath the download, never above it: one triage link */}
        <p className="mt-12 border-t border-bone-line pt-8">
          <Link
            href={{ pathname: "/triage", query: source ? { [SOURCE_PARAM]: source } : {} }}
            className="text-base font-semibold underline decoration-1 underline-offset-4 hover:no-underline"
            style={{ fontFamily: "var(--font-guide-sans)", color: NAVY }}
          >
            {t("triage")}
          </Link>
        </p>
      </section>
    </div>
  );
}
