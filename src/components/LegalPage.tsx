import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

export function LegalPage({
  label,
  title,
  updated,
  children,
}: {
  label: string;
  title: string;
  /** ISO date, formatted in the reader's language. */
  updated: string;
  children: ReactNode;
}) {
  const t = useTranslations("common.legalPage");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(updated));
  return (
    <div className="container-x py-16 sm:py-20 lg:py-24">
      <div className="max-w-3xl border-t-3 border-accent pt-8">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-accent-deep">{label}</p>
        <h1 className="mt-5 text-display-lg text-ink">{title}</h1>
        <p className="mt-4 font-mono text-xs text-ink-soft">{t("lastUpdated", { date })}</p>
        {locale !== "en" && (
          <p className="mt-6 border-l-2 border-paper-edge bg-paper-dim px-4 py-3 font-sans text-xs leading-relaxed text-ink-muted">
            {t("translationNotice")}
          </p>
        )}
        <div className="mt-12 space-y-10">{children}</div>
      </div>
    </div>
  );
}

export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-display-sm text-ink">{heading}</h2>
      <div className="mt-4 space-y-4 font-serif text-read text-ink-muted">{children}</div>
    </section>
  );
}
