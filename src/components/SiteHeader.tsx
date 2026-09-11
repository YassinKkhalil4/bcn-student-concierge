import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function SiteHeader() {
  const t = useTranslations("common");
  const nav = [
    { href: "/#how-it-works", label: t("nav.howItWorks") },
    { href: "/pricing", label: t("nav.pricing") },
    { href: "/#faq", label: t("nav.faq") },
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
          <Link href="/intake" className="btn-primary">
            {t("nav.beginIntake")}
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher />
          <Link href="/intake" className="btn-primary">
            {t("nav.begin")}
          </Link>
        </div>
      </div>
    </header>
  );
}
