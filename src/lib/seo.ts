/**
 * Canonical and hreflang metadata for the public pages.
 *
 * next-intl's middleware already emits the hreflang set as an RFC 8288 `Link`
 * header, and the sitemap carries the same set as `<xhtml:link>` alternates.
 * Neither of those carries a canonical, and a page without one leaves the
 * search engine to pick between `/pricing`, `/es/pricing` and the `.md`
 * representation on its own. Worse, hreflang is only honoured when the
 * canonical URL is itself a member of the hreflang set — so a missing
 * canonical quietly weakens the annotations that are there.
 *
 * All three sources derive their URLs from `localizedPath`, so they cannot
 * disagree; a disagreement makes Google drop the pair outright.
 */
import type { Metadata } from "next";
import { LOCALES, localizedPath } from "@/i18n/routing";
import { siteOrigin, type PublicPage } from "@/lib/agents/pages";

/**
 * Self-referencing canonical plus the full hreflang set, including
 * `x-default`. `x-default` is English, which is where an unmatched visitor
 * lands anyway: routing has locale detection off.
 */
export function alternatesFor(page: PublicPage, locale: string): Metadata["alternates"] {
  const origin = siteOrigin();
  const url = (l: string) => `${origin}${localizedPath(l, page)}`;
  return {
    canonical: url(locale),
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, url(l)])),
      "x-default": url("en"),
    },
  };
}

/** The absolute URL of a public page in one language. */
export const pageUrl = (page: PublicPage, locale: string): string =>
  `${siteOrigin()}${localizedPath(locale, page)}`;
