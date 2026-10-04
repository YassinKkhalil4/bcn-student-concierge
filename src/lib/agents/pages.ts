import { CHAPTERS, chapterPath } from "@/lib/guide/chapters";

/**
 * What an automated reader may see.
 *
 * One list, used by robots.txt, the sitemap and the Markdown representation,
 * so the three can never disagree about what is public. Everything else —
 * the intake form, the student portal, the staff dashboard and the whole API —
 * carries personal data and is closed to crawlers.
 */

/** The guide's chapters, read online at /guide/<slug>, in every language. */
export const GUIDE_CHAPTER_PATHS: readonly string[] = CHAPTERS.map((c) => chapterPath(c.slug));

/** Pages offered to crawlers and agents, unprefixed (English URLs). */
export const PUBLIC_PAGES: readonly string[] = [
  "/",
  "/guide",
  ...GUIDE_CHAPTER_PATHS,
  "/triage",
  "/pricing",
  "/legal",
  "/privacy",
  "/terms",
];
export type PublicPage = string;

/** Never crawled, never rendered as Markdown, in any language. */
export const PRIVATE_PREFIXES = ["/intake", "/portal", "/admin", "/api"] as const;

export function isPublicPage(path: string): path is PublicPage {
  return (PUBLIC_PAGES as readonly string[]).includes(path);
}

export const isGuideChapterPath = (path: string): boolean => GUIDE_CHAPTER_PATHS.includes(path);

export function isPrivatePath(path: string): boolean {
  return PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Absolute origin for sitemap entries and Link headers. */
export const siteOrigin = (): string =>
  (process.env.PUBLIC_ORIGIN ?? "https://bcnstudent.com").replace(/\/+$/, "");

/** "/pricing" → "/pricing.md"; the homepage is "/index.md". */
export const markdownPath = (page: string): string =>
  page === "/" ? "/index.md" : `${page}.md`;
