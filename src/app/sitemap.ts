import type { MetadataRoute } from "next";
import { LOCALES, localizedPath } from "@/i18n/routing";
import { PUBLIC_PAGES, siteOrigin } from "@/lib/agents/pages";

export const dynamic = "force-dynamic";

/**
 * The public pages, in all six languages, each entry naming the others as
 * alternates so a search engine serves the right language rather than guessing.
 *
 * Only PUBLIC_PAGES appear: the intake form, the portal and the dashboard are
 * noindex and closed to crawlers.
 */

/**
 * The date the public copy last changed. Bumped by hand when the marketing or
 * legal text is edited — a build timestamp would claim every page changed on
 * every deploy, which search engines learn to ignore.
 */
const CONTENT_UPDATED = new Date("2026-09-16T00:00:00Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const url = (locale: string, page: string) => `${origin}${localizedPath(locale, page)}`;

  return PUBLIC_PAGES.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: url(locale, page),
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly" as const,
      priority: page === "/" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries([
          ...LOCALES.map((l) => [l, url(l, page)]),
          ["x-default", url("en", page)],
        ]),
      },
    })),
  );
}
