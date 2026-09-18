"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, LOCALE_NAMES, type SiteLocale } from "@/i18n/routing";

/**
 * Six languages, each named in itself. Switching keeps the visitor on the same
 * page (and its query string, e.g. ?tier=turnkey). A signed-in student's
 * choice is also saved to their file, so emails and guides follow it.
 */
export function LanguageSwitcher() {
  const t = useTranslations("common.language");
  const locale = useLocale() as SiteLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: SiteLocale) {
    const query = typeof window === "undefined" ? "" : window.location.search;
    if (pathname.startsWith("/portal")) {
      // Best-effort: remember the choice on the student's file.
      void fetch("/api/portal/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      }).catch(() => {});
    }
    startTransition(() => router.replace(`${pathname}${query}`, { locale: next }));
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => change(e.target.value as SiteLocale)}
        className="cursor-pointer appearance-none border border-paper-line bg-transparent py-2 pl-3 pr-7 font-sans text-[0.8125rem] font-semibold tracking-tight text-ink-muted transition-colors hover:border-paper-edge hover:text-ink focus:border-accent"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-2.5 text-[9px] text-ink-soft">▾</span>
    </label>
  );
}
