import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request nonce-based Content Security Policy.
 *
 * WHY THIS IS IN MIDDLEWARE AND NOT next.config:
 * Next.js injects inline <script> tags to bootstrap and hydrate the app. A
 * static CSP in next.config cannot know their content, so the only ways to let
 * them run are 'unsafe-inline' — which defeats the entire point of a script CSP
 * and would leave us exposed to exactly the XSS a document-upload site must not
 * be exposed to — or a per-request nonce. We use the nonce.
 *
 * 'strict-dynamic' lets the nonced bootstrap script load the chunks it needs
 * without us enumerating every hashed filename, while still blocking any script
 * an attacker manages to inject into the DOM.
 *
 * TRADEOFF, stated plainly: a per-request nonce makes responses dynamic, so
 * pages are not served from the full-page static cache. For a site whose
 * highest-traffic pages are marketing pages this costs some CDN efficiency. It
 * is the right trade here because the same origin serves the passport-upload
 * portal, and a CSP that is weak on one route is weak on all of them.
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    // React injects styles inline; there is no nonce path for those in Next's
    // style pipeline, so 'unsafe-inline' is scoped to style-src only. An
    // injected stylesheet cannot execute script.
    "style-src 'self' 'unsafe-inline'",
    // 'unsafe-eval' is dev-only: the webpack HMR runtime requires it, and it is
    // absent from every production response.
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

  // Next reads this request header and stamps the nonce onto the script tags
  // it generates. Without it the bootstrap script has no nonce and is blocked.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and images, which are served from disk
     * and carry no scripts. The Stripe webhook is deliberately included: it
     * costs nothing and keeps the policy uniform.
     */
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
