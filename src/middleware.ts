import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { localizedPath, routing, splitLocale } from "@/i18n/routing";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/session";
import { SOURCE_COOKIE, SOURCE_PARAM, attributionCookieOptions, parseSource } from "@/lib/attribution";
import { isPublicPage, markdownPath, type PublicPage } from "@/lib/agents/pages";
import { PORTAL_COOKIE, verifyPortalSession } from "@/lib/portal/session";

/**
 * Middleware issues the per-request CSP nonce, routes public pages to their
 * language (next-intl), answers agents that ask for Markdown, and is the first
 * of two gates on both the staff dashboard and the student portal.
 *
 * Rate limiting is NOT here: middleware runs in the Edge sandbox, which cannot
 * reach Postgres. It is enforced in each route handler (src/lib/rate-limit.ts),
 * and a test fails if a POST route stops calling it.
 */

/** Admin surface. Login is the only unauthenticated entry point. */
function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}
const ADMIN_PUBLIC = new Set(["/admin/login", "/api/admin/login"]);

const intl = createIntlMiddleware(routing);

/** Student portal. Sign-in and link redemption are its only open entry points. */
function isPortalPath(pathname: string): boolean {
  return (
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/api/portal/")
  );
}
const PORTAL_PUBLIC = new Set([
  "/portal/login",
  "/portal/verify",
  "/api/portal/login",
  "/api/portal/verify",
  "/api/portal/logout",
]);

/**
 * Agents get the page as Markdown instead of HTML, either by asking for it
 * (`Accept: text/markdown`) or through the page's `.md` URL. Only the public
 * pages have one; nothing behind a session is ever rendered this way.
 */
function markdownRequest(
  request: NextRequest,
  unprefixed: string,
): { page: PublicPage; negotiated: boolean } | null {
  if (request.method !== "GET") return null;
  const asked = (request.headers.get("accept") ?? "").includes("text/markdown");
  const fromUrl = unprefixed.endsWith(".md")
    ? unprefixed === "/index.md"
      ? "/"
      : unprefixed.slice(0, -3)
    : null;
  const page = fromUrl ?? unprefixed;
  if (!isPublicPage(page)) return null;
  if (fromUrl !== null) return { page, negotiated: false };
  return asked ? { page, negotiated: true } : null;
}

function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // React injects styles inline and Next's style pipeline offers no nonce
    // path, so 'unsafe-inline' is scoped to style-src only. An injected
    // stylesheet cannot execute script.
    "style-src 'self' 'unsafe-inline'",
    // 'unsafe-eval' is dev-only for the webpack HMR runtime; it is absent from
    // every production response.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${
      isDev ? " 'unsafe-eval'" : ""
    }`,
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    `connect-src 'self' https://api.stripe.com${isDev ? " ws: http://localhost:*" : ""}`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Staff and portal pages carry personal data: never index, never cache. */
function markPrivate(response: NextResponse): void {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store, max-age=0");
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, isDev);
  const { pathname } = request.nextUrl;
  const admin = isAdminPath(pathname);
  // Public pages may carry a language prefix: "/fr/portal" is the portal too.
  const { locale, path: unprefixed } = splitLocale(pathname);
  const api = pathname.startsWith("/api/");
  // Files served by a handler (the guide PDF): no language, no page chrome.
  const download = pathname.startsWith("/downloads/");
  const portal = isPortalPath(api ? pathname : unprefixed);

  // ── Admin gate (first of two) ────────────────────────────────────────
  // Every admin handler verifies the session again itself; this gate is not
  // relied on alone. Pages go to the login screen, API calls get a bare 401.
  if (admin && !ADMIN_PUBLIC.has(pathname)) {
    const valid = await verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
    if (!valid) {
      const denied = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/admin/login", request.url));
      denied.headers.set("Content-Security-Policy", csp);
      markPrivate(denied);
      return denied;
    }
  }

  // ── Portal gate (first of two) ───────────────────────────────────────
  if (portal && !PORTAL_PUBLIC.has(api ? pathname : unprefixed)) {
    const caseId = await verifyPortalSession(request.cookies.get(PORTAL_COOKIE)?.value);
    if (!caseId) {
      // …to the sign-in page in the language they were browsing in.
      const denied = api
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL(localizedPath(locale, "/portal/login"), request.url));
      denied.headers.set("Content-Security-Policy", csp);
      markPrivate(denied);
      return denied;
    }
  }

  // Next reads the nonce from the REQUEST's Content-Security-Policy header and
  // stamps it onto every script it renders. x-nonce is for our own code.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // ── Markdown for agents ──────────────────────────────────────────────
  // Which page, and whether Accept asked for it, travel as request headers:
  // a rewrite's query string does not survive to the handler.
  const markdown = !admin && !api && !portal && !download ? markdownRequest(request, unprefixed) : null;
  if (markdown) {
    requestHeaders.set("x-agent-markdown-path", markdown.page);
    requestHeaders.set("x-agent-markdown-locale", locale);
    // Next overwrites Vary with its own router list, so a negotiated response
    // (same URL, HTML or Markdown depending on Accept) must not be stored by a
    // shared cache. The .md URLs are distinct and stay cacheable.
    if (markdown.negotiated) requestHeaders.set("x-agent-markdown-negotiated", "1");
    const served = NextResponse.rewrite(new URL("/api/agent/markdown", request.nextUrl.origin), {
      request: { headers: requestHeaders },
    });
    served.headers.set("Content-Security-Policy", csp);
    return served;
  }

  // Public pages go through next-intl, which rewrites "/pricing" to the "en"
  // route and handles "/fr/…". It copies the headers of the request it is
  // given into its rewrite, so it receives ours — nonce and CSP included.
  // Staff pages and the API have no language and skip it.
  const response =
    admin || api || download
      ? NextResponse.next({ request: { headers: requestHeaders } })
      : intl(new NextRequest(request, { headers: requestHeaders }));
  response.headers.set("Content-Security-Policy", csp);
  if (admin || portal) markPrivate(response);

  // ── Guide attribution ───────────────────────────────────────────────
  // A school's link (/guide?s=esade) is remembered for 30 days, so the
  // triage or intake it leads to can record where the reader came from.
  // Last link wins. Unknown values are ignored. See src/lib/attribution.ts.
  const source = !admin && !api && !download && request.method === "GET"
    ? parseSource(request.nextUrl.searchParams.get(SOURCE_PARAM))
    : null;
  if (source) response.cookies.set(SOURCE_COOKIE, source, attributionCookieOptions);

  // Tell agents the page has a machine-readable form (RFC 8288). Appended:
  // next-intl already put the hreflang alternates in this header.
  if (!admin && !api && !portal && !download && isPublicPage(unprefixed)) {
    const md = new URL(markdownPath(unprefixed), request.nextUrl.origin);
    response.headers.append(
      "Link",
      `<${md}>; rel="describedby"; type="text/markdown", <${md}>; rel="alternate"; type="text/markdown"`,
    );
    response.headers.append("Vary", "Accept");
  }
  return response;
}

export const config = {
  // Static assets carry no scripts and need neither a nonce nor the gate.
  // robots.txt, sitemap.xml and the site icon are skipped too: they have no
  // language, and next-intl would otherwise route "/robots.txt" to "/en/robots.txt".
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon\\.svg|robots\\.txt|sitemap\\.xml).*)"],
};
