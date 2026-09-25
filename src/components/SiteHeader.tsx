import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ArrowMark, CloseMark, MenuMark } from "./icons";

export function SiteHeader() {
  const t = useTranslations("common");
  const locale = useLocale();
  /**
   * The header's one button used to be "Start intake" — the most expensive,
   * highest-commitment step on the site, offered to a visitor who has read
   * nothing yet. On a phone it was the only button there was. Every other part
   * of the page architecture says the free check comes first, so the button
   * now says that, and intake keeps a text link for the people who have
   * already decided.
   */
  const nav = [
    { href: "/#how-it-works", label: t("nav.howItWorks") },
    { href: "/pricing", label: t("nav.pricing") },
    { href: "/#faq", label: t("nav.faq") },
    { href: "/intake", label: t("nav.beginIntake") },
    { href: "/portal", label: t("nav.myFile") },
  ];

  return (
    <header
      className="sticky top-0 z-40 border-b border-paper-line bg-paper/90 backdrop-blur
                 has-[details[open]]:bg-paper has-[details[open]]:backdrop-blur-none"
    >
      {/*
        The nav has to hold five links, a language menu and a button on ONE
        line, in six languages, inside a 1144px content measure. Measured, the
        row needs 1038px in English but 1222px in Italian, so at `md` — and at
        `lg` — it wrapped into two rows in every language but English.

        The full nav therefore appears only at `xl`, and below that the same
        five links live in the disclosure panel underneath. They used to live
        nowhere: between 768px and 1280px — every tablet, every phone — the
        header carried a language select and a button, and How it works,
        Pricing, FAQ, Start intake and My file simply did not exist. A student
        coming back to their own file on a phone had no path to it.

        The row is min-height, not height, so that at 200% browser text it grows
        instead of pushing the document sideways. At that size it was 489px wide
        inside a 375px viewport, and every page on the site scrolled
        horizontally because of this one row.
      */}
      {/*
        The three controls are siblings rather than a brand and a group, so
        that when 200% text stops them fitting on one line it is the CTA — the
        one that repeats a button the page already carries — that drops to the
        second row, and not the wordmark.
      */}
      <div className="container-x flex min-h-[68px] flex-wrap items-center gap-x-4 gap-y-2 py-2 sm:min-h-[72px] sm:gap-x-6">
        {/*
          Below `sm` the wordmark is hidden and the mark stands alone. Spelled
          out, "BCN STUDENT CONCIERGE" wrapped to three lines on a 375px phone
          and pushed the header to 140px tall, which ate a fifth of the screen
          before the page had said anything. The mark is 18px, so the link is
          padded out to a 44px target rather than asking a thumb to find it.
        */}
        <Link
          href="/"
          className="-ml-2 mr-auto flex min-h-[44px] min-w-[44px] flex-none items-center gap-3 px-2"
        >
          <BrandMark />
          <span className="hidden whitespace-nowrap font-sans text-[0.8125rem] font-extrabold uppercase leading-none tracking-[0.1em] text-ink sm:inline">
            {t("brand")}
          </span>
        </Link>

        <nav aria-label={t("nav.main")} className="hidden items-center gap-6 xl:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap font-sans text-[0.8125rem] font-semibold tracking-tight
                         text-ink-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          <span aria-hidden="true" className="h-5 w-px bg-paper-edge" />
          <LanguageSwitcher />
          <Link href="/triage" className="btn-primary whitespace-nowrap !px-5 !py-2.5">
            {t("nav.ctaPrimaryShort")}
          </Link>
        </nav>

        <MobileNav nav={nav} locale={locale} />
        {/*
          No `whitespace-nowrap` here, unlike its `xl` twin: this is the widest
          thing in the row, and letting the label break at its space is what
          keeps the row inside a 320px phone at 200% text.
        */}
        <Link
          href="/triage"
          className="btn-primary !px-4 !py-2.5 !text-[0.8125rem] xl:hidden"
        >
          {t("nav.ctaPrimaryShort")}
        </Link>
      </div>
    </header>
  );
}

/**
 * The index, below `xl`.
 *
 * A `<details>`, so it opens without a line of JavaScript on a page that is
 * otherwise served whole from the server — and so it keeps `<summary>`'s own
 * button semantics and expanded state rather than an imitation of them.
 *
 * It is not a drawer and it does not dim the page. The site's argument is that
 * it is a document, and the way a document lists its own contents is a ruled
 * index on the same paper — which is already how /guide lists its sections and
 * how the home page lists its four stages. A floating panel with rounded
 * corners would be the one rounded thing on the site.
 *
 * The language control sits ABOVE the links, and that order is deliberate:
 * routing.ts turns browser-language detection off, so every visitor lands on
 * English whatever they read. This control is the only way out of that, and a
 * reader who needs it cannot read the five labels underneath it yet.
 */
function MobileNav({
  nav,
  locale,
}: {
  nav: { href: string; label: string }[];
  locale: string;
}) {
  const t = useTranslations("common");

  return (
    <details className="disclosure-overlay group xl:hidden">
      <summary
        className="flex min-h-[44px] cursor-pointer list-none items-center gap-2.5 border
                   border-paper-edge px-3 text-ink transition-colors
                   hover:border-ink hover:bg-ink hover:text-paper"
      >
        {/* Named before the code, so the accessible name is "Menu EN" and
            contains the label a voice-control user can actually see. */}
        <span className="sr-only">{t("nav.menu")}</span>
        <MenuMark className="h-5 w-5 flex-none group-open:hidden" />
        <CloseMark className="hidden h-5 w-5 flex-none group-open:block" />
        <span aria-hidden="true" className="h-4 w-px flex-none bg-paper-edge group-hover:bg-paper/40" />
        <span className="whitespace-nowrap font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em]">
          {locale}
        </span>
      </summary>

      <div className="absolute inset-x-0 top-full max-h-[calc(100dvh-72px)] overflow-y-auto border-b border-paper-edge bg-paper">
        <div className="container-x py-6">
          <LanguageSwitcher showLabel className="w-full" />

          <ul className="mt-6 border-t border-paper-edge">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-4 border-b border-paper-line py-4
                             font-sans text-base font-bold tracking-tight text-ink transition-colors
                             hover:text-accent-deep"
                >
                  {item.label}
                  <ArrowMark className="h-4 w-4 flex-none text-accent" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

/**
 * The mark from the guide's cover: a crimson square with the corner cut away.
 * It is the same 45° chamfer as the primary buttons, at 4px, so the smallest
 * element on the page and the largest one are visibly the same idea.
 */
function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="chamfer block h-[18px] w-[18px] flex-none bg-accent [--chamfer:6px]"
    />
  );
}
