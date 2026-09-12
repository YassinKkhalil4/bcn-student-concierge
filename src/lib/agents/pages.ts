/**
 * What an automated reader may see.
 *
 * One list, used by robots.txt, the sitemap and the Markdown representation,
 * so the three can never disagree about what is public. Everything else —
 * the intake form, the student portal, the staff dashboard and the whole API —
 * carries personal data and is closed to crawlers.
 */

/** Pages offered to crawlers and agents, unprefixed (English URLs). */
export const PUBLIC_PAGES = ["/", "/pricing", "/legal", "/privacy", "/terms"] as const;
export type PublicPage = (typeof PUBLIC_PAGES)[number];

/** Never crawled, never rendered as Markdown, in any language. */
export const PRIVATE_PREFIXES = ["/intake", "/portal", "/admin", "/api"] as const;

export function isPublicPage(path: string): path is PublicPage {
  return (PUBLIC_PAGES as readonly string[]).includes(path);
}

export function isPrivatePath(path: string): boolean {
  return PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Absolute origin for sitemap entries and Link headers. */
export const siteOrigin = (): string =>
  (process.env.PUBLIC_ORIGIN ?? "https://bcnstudent.com").replace(/\/+$/, "");

/** "/pricing" → "/pricing.md"; the homepage is "/index.md". */
export const markdownPath = (page: PublicPage): string =>
  page === "/" ? "/index.md" : `${page}.md`;
