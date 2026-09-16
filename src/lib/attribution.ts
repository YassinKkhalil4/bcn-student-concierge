/**
 * Guide attribution: which school's link a reader arrived through, and whether
 * they downloaded the guide — so download → triage conversion can be measured
 * per source, not just download counts.
 *
 *   /guide?s=esade          middleware stores the source (bcn_src, 30 days)
 *   GET /downloads/…pdf     records a download event and gives the browser an
 *                           anonymous download id (bcn_guide, 30 days)
 *   POST /api/triage        both cookies are read server-side and stored on
 *   POST /api/intake        the enquiry / case
 *
 * The conversion query joins downloads to enquiries on that id
 * (src/lib/server/guide-analytics.ts).
 *
 * Edge-safe: no Node imports, because middleware uses it.
 */

export const GUIDE_SOURCES = [
  "esade",
  "iese",
  "eada",
  "eubs",
  "uic",
  "harbourspace",
  "ied",
  "gbsb",
  "geneva",
  "esei",
  "bts",
  "other",
] as const;
export type GuideSource = (typeof GUIDE_SOURCES)[number];

/** Query parameter: /guide?s=esade */
export const SOURCE_PARAM = "s";
export const SOURCE_COOKIE = "bcn_src";
export const GUIDE_VISITOR_COOKIE = "bcn_guide";
export const ATTRIBUTION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const attributionCookieOptions = {
  // Read only by our own route handlers; no script needs them.
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ATTRIBUTION_MAX_AGE_SECONDS,
};

/**
 * A supported source, or null. Unknown values are dropped rather than stored
 * as "other": a mistyped campaign link should show up as missing attribution,
 * not be silently folded into a real bucket.
 */
export function parseSource(value: unknown): GuideSource | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return (GUIDE_SOURCES as readonly string[]).includes(v) ? (v as GuideSource) : null;
}

/** The anonymous download id: an opaque token, nothing derived from the visitor. */
export function isGuideVisitorId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

export interface Attribution {
  source: GuideSource | null;
  guideVisitorId: string | null;
}

export const NO_ATTRIBUTION: Attribution = { source: null, guideVisitorId: null };

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** What a submission records about where its sender came from. */
export function attributionFromRequest(request: Request): Attribution {
  const header = request.headers.get("cookie");
  const visitor = cookieValue(header, GUIDE_VISITOR_COOKIE);
  return {
    source: parseSource(cookieValue(header, SOURCE_COOKIE)),
    guideVisitorId: isGuideVisitorId(visitor) ? visitor : null,
  };
}
