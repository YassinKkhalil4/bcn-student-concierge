import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LegalDisclaimer } from "./LegalDisclaimer";

export function SiteFooter() {
  const t = useTranslations("common");
  return (
    <footer className="mt-24 border-t border-bone-line bg-bone-warm">
      <div className="container-x py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="font-display text-lg font-semibold text-ink">{t("brand")}</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">{t("footer.tagline")}</p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">{t("footer.services")}</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
              <li><Link href="/pricing" className="hover:text-ink">{t("footer.packages")}</Link></li>
              <li><Link href="/intake" className="hover:text-ink">{t("footer.intake")}</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-ink">{t("footer.process")}</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">{t("footer.legal")}</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
              <li><Link href="/terms" className="hover:text-ink">{t("footer.terms")}</Link></li>
              <li><Link href="/privacy" className="hover:text-ink">{t("footer.privacy")}</Link></li>
              <li><Link href="/legal" className="hover:text-ink">{t("footer.scope")}</Link></li>
            </ul>
          </div>
        </div>

        {/*
          The anti-intrusismo disclaimer appears on every page via the footer,
          not only on the terms page. Spanish regulation of reserved legal
          activities turns on how the service is HELD OUT to the public, so the
          disclaimer has to sit where every visitor sees it — in their language.
        */}
        <div className="mt-12 border-t border-bone-line pt-8">
          <LegalDisclaimer variant="footer" />
          <p className="mt-6 text-xs text-ink-soft">{t("footer.copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
