import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PROVIDER, PROVIDER_FIELDS } from "@/lib/provider";
import { LegalDisclaimer } from "./LegalDisclaimer";

/**
 * The back cover.
 *
 * Navy, like the hero and like the guide's cover. Those are the only two dark
 * surfaces on the site: the document opens on cover stock, runs on paper, and
 * closes on cover stock. Nothing in between inverts.
 */
export function SiteFooter() {
  const t = useTranslations("common");
  return (
    <footer className="on-ink mt-auto">
      <div className="container-x py-16 sm:py-20">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="chamfer block h-[18px] w-[18px] flex-none bg-accent [--chamfer:6px]"
              />
              <span className="font-sans text-[0.8125rem] font-extrabold uppercase leading-none tracking-[0.1em] text-onink">
                {t("brand")}
              </span>
            </p>
            <p className="mt-5 max-w-sm font-serif text-read text-onink-muted">{t("footer.tagline")}</p>
          </div>

          <FooterColumn title={t("footer.services")}>
            <FooterLink href="/triage">{t("footer.triage")}</FooterLink>
            <FooterLink href="/pricing">{t("footer.packages")}</FooterLink>
            <FooterLink href="/guide">{t("footer.guide")}</FooterLink>
            <FooterLink href="/portal">{t("footer.intake")}</FooterLink>
            <FooterLink href="/#how-it-works">{t("footer.process")}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t("footer.legal")}>
            <FooterLink href="/terms">{t("footer.terms")}</FooterLink>
            <FooterLink href="/privacy">{t("footer.privacy")}</FooterLink>
            <FooterLink href="/legal">{t("footer.scope")}</FooterLink>
          </FooterColumn>
        </div>

        {/*
          The anti-intrusismo disclaimer appears on every page via the footer,
          not only on the terms page. Spanish regulation of reserved legal
          activities turns on how the service is HELD OUT to the public, so the
          disclaimer has to sit where every visitor sees it — in their language.
        */}
        <div className="mt-14 border-t border-ink-line pt-8">
          <LegalDisclaimer variant="footer" />
          <ProviderIdentification />
          <p className="mt-8 font-mono text-xs text-onink-soft">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-sans text-[0.625rem] font-bold uppercase tracking-[0.2em] text-onink-soft">
        {title}
      </h2>
      {/* Was `space-y-3` around 16px-tall inline links: a 28px pitch made of
          12px of gap and a target too small to aim at. The height now belongs
          to the link instead of to the gap, so the column reads at the same
          density and every row is something a thumb can hit. */}
      <ul className="mt-4 space-y-0.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="inline-flex min-h-[32px] items-center py-1 font-sans text-sm font-medium
                   text-onink-muted transition-colors hover:text-onink
                   [@media(pointer:coarse)]:min-h-[44px]"
      >
        {children}
      </Link>
    </li>
  );
}

/**
 * LSSI art. 10 provider identification, on every page. Fields come from
 * src/lib/provider.ts and each appears once it has a value — an empty "NIF:"
 * label on a live page would be worse than the block not showing yet.
 */
function ProviderIdentification() {
  const t = useTranslations("common.footer.provider");
  const filled = PROVIDER_FIELDS.filter((field) => PROVIDER[field]);
  if (filled.length === 0) return null;
  return (
    <section aria-label={t("heading")} className="mt-8">
      <h2 className="font-sans text-[0.625rem] font-bold uppercase tracking-[0.2em] text-onink-soft">
        {t("heading")}
      </h2>
      <dl className="mt-3 grid gap-x-10 gap-y-1.5 font-sans text-xs text-onink-muted sm:grid-cols-2">
        {filled.map((field) => (
          <div key={field} className="flex flex-wrap gap-x-1.5">
            <dt className="text-onink-soft">{t(field)}:</dt>
            <dd>
              {field === "email" ? (
                <a href={`mailto:${PROVIDER.email}`} className="underline underline-offset-2 hover:text-onink">
                  {PROVIDER.email}
                </a>
              ) : (
                PROVIDER[field]
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
