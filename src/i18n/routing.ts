import { defineRouting } from "next-intl/routing";

/**
 * Six languages, exactly — English is the site's main language.
 *
 *   English  /pricing        (no prefix)
 *   Others   /fr/pricing, /es/…, /ca/…, /it/…, /de/…
 *
 * No automatic redirect by browser language: every visitor lands on English
 * unless they choose otherwise (or follow a localized link). With detection
 * off, a locale cookie would have no job to do, so none is set — keeping the
 * privacy notice's "strictly necessary cookies only" true.
 */
export const LOCALES = ["en", "es", "ca", "fr", "it", "de"] as const;
export type SiteLocale = (typeof LOCALES)[number];

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});

/** Native names for the switcher — each language named in itself. */
export const LOCALE_NAMES: Record<SiteLocale, string> = {
  en: "English",
  es: "Español",
  ca: "Català",
  fr: "Français",
  it: "Italiano",
  de: "Deutsch",
};

export function isSiteLocale(value: unknown): value is SiteLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** "/portal" for English, "/fr/portal" for French — for redirects and email links. */
export function localizedPath(locale: string | null | undefined, path: string): string {
  const l = isSiteLocale(locale) ? locale : "en";
  return l === "en" ? path : `/${l}${path === "/" ? "" : path}`;
}

/** Split "/fr/portal/login" into { locale: "fr", path: "/portal/login" }. */
export function splitLocale(pathname: string): { locale: SiteLocale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (isSiteLocale(first) && first !== "en") {
    return { locale: first, path: `/${rest.join("/")}`.replace(/\/$/, "") || "/" };
  }
  if (first === "en") return { locale: "en", path: `/${rest.join("/")}`.replace(/\/$/, "") || "/" };
  return { locale: "en", path: pathname };
}
