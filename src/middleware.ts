import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/session";
import { PORTAL_COOKIE, verifyPortalSession } from "@/lib/portal/session";

/**
 * Middleware issues the per-request CSP nonce and is the first of two gates on
 * both the staff dashboard and the student portal.
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
  const portal = isPortalPath(pathname);

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
  if (portal && !PORTAL_PUBLIC.has(pathname)) {
    const caseId = await verifyPortalSession(request.cookies.get(PORTAL_COOKIE)?.value);
    if (!caseId) {
      const denied = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/portal/login", request.url));
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

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (admin || portal) markPrivate(response);
  return response;
}

export const config = {
  // Static assets carry no scripts and need neither a nonce nor the gate.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
