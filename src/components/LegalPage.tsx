import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  /** ISO date, formatted in the reader's language. */
  updated: string;
  children: ReactNode;
}) {
  const t = useTranslations("common.legalPage");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(updated));
  return (
    <div className="container-x py-16 sm:py-20">
      <div className="max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 text-xs text-ink-soft">{t("lastUpdated", { date })}</p>
        {locale !== "en" && (
          <p className="mt-4 rounded-lg bg-bone-warm px-4 py-3 text-xs leading-relaxed text-ink-muted">
            {t("translationNotice")}
          </p>
        )}
        <div className="prose-legal mt-10 space-y-8">{children}</div>
      </div>
    </div>
  );
}

export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-ink">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}
