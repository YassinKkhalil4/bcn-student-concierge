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
    <header className="sticky top-0 z-40 border-b border-bone-line/70 bg-bone/85 backdrop-blur">
      <div className="container-x flex h-[72px] items-center justify-between gap-4">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            {t("brand")}
          </span>
        </Link>

        <nav aria-label={t("nav.main")} className="hidden items-center gap-7 md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
          <LanguageSwitcher />
          <Link href="/triage" className="btn-primary">
            {t("nav.ctaPrimary")}
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher />
          <Link href="/triage" className="btn-primary">
            {t("nav.ctaPrimaryShort")}
          </Link>
        </div>
      </div>
    </header>
  );
}
