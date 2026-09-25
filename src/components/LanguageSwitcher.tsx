"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, LOCALE_NAMES, type SiteLocale } from "@/i18n/routing";
import { ChevronMark } from "./icons";

/**
 * Six languages, each named in itself. Switching keeps the visitor on the same
 * page (and its query string, e.g. ?tier=turnkey). A signed-in student's
 * choice is also saved to their file, so emails and guides follow it.
 *
 * Two of these render at once below `xl` — one in the header row, one in the
 * disclosure panel — so the id is generated rather than written, or the two
 * labels would both point at whichever select the browser found first.
 */
export function LanguageSwitcher({
  showLabel = false,
  className = "",
}: {
  /** Visible label and full width, for the disclosure panel. */
  showLabel?: boolean;
  className?: string;
}) {
  const t = useTranslations("common.language");
  const locale = useLocale() as SiteLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();

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
    <div className={className}>
      <label htmlFor={id} className={showLabel ? "field-label" : "sr-only"}>
        {t("label")}
      </label>
      <div className={`relative ${showLabel ? "mt-2" : ""}`}>
        <select
          id={id}
          value={locale}
          disabled={pending}
          onChange={(e) => change(e.target.value as SiteLocale)}
          className={`min-h-[44px] cursor-pointer appearance-none border border-paper-line bg-transparent
                      py-2 pl-3 pr-9 font-sans text-[0.8125rem] font-semibold tracking-tight text-ink-muted
                      transition-colors hover:border-paper-edge hover:text-ink focus:border-accent
                      ${showLabel ? "w-full bg-white text-[0.9375rem] text-ink" : ""}`}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l} lang={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </select>
        <ChevronMark
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
        />
      </div>
    </div>
  );
}
