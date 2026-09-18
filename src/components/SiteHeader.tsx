import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function SiteHeader() {
  const t = useTranslations("common");
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
    <header className="sticky top-0 z-40 border-b border-paper-line bg-paper/90 backdrop-blur">
      {/*
        The nav has to hold five links, a language menu and a button on ONE
        line, in six languages, inside a 1144px content measure. Measured, the
        row needs 1038px in English but 1222px in Italian, so at `md` — and at
        `lg` — it wrapped into two rows in every language but English.

        Two things fix it. The full nav appears only at `xl`, and the header
        button uses the SHORT label in every language ("Verifica gratis", not
        "Controlla gratis la mia scadenza"), which is what the phone header
        already did. That is the right call regardless of width: the header
        button is a repeat of the hero's, and a repeat does not need the whole
        sentence. Italian now needs 1074px and every language fits on one line.
      */}
      <div className="container-x flex h-[68px] items-center justify-between gap-4 sm:h-[72px] sm:gap-6">
        {/*
          Below `sm` the wordmark is hidden and the mark stands alone. Spelled
          out, "BCN STUDENT CONCIERGE" wrapped to three lines on a 375px phone
          and pushed the header to 140px tall, which ate a fifth of the screen
          before the page had said anything.
        */}
        <Link href="/" className="flex flex-none items-center gap-3">
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

        <div className="flex items-center gap-3 xl:hidden">
          <LanguageSwitcher />
          <Link href="/triage" className="btn-primary whitespace-nowrap !px-4 !py-2.5 !text-[0.8125rem]">
            {t("nav.ctaPrimaryShort")}
          </Link>
        </div>
      </div>
    </header>
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
