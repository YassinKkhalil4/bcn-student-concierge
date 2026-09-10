import { NextResponse, type NextRequest } from "next/server";
import {
  rateLimit,
  clientIdentifier,
  rateLimitHeaders,
  type LimitScope,
} from "@/lib/rate-limit";

/**
 * Middleware does two jobs: it issues the per-request CSP nonce, and it
 * enforces distributed rate limits on the write endpoints.
 *
 * Rate limiting lives here rather than in each route handler so a new API route
 * cannot ship unprotected by omission — the default is protected, and opting
 * out means editing this table.
 */

/**
 * Path prefix → limit scope. Ordered, first match wins.
 *
 * The Stripe webhook is deliberately ABSENT. Stripe retries with backoff on
 * non-2xx, so a 429 would cause it to redeliver, and a burst of legitimate
 * events (several checkouts closing at once) could throttle payment
 * confirmations. The webhook is protected by signature verification instead,
 * which is the appropriate control for a machine caller.
 */
const RATE_LIMITED_ROUTES: readonly { prefix: string; scope: LimitScope }[] = [
  { prefix: "/api/intake", scope: "intake" },
  { prefix: "/api/documents", scope: "upload" },
  { prefix: "/api/checkout", scope: "checkout" },
];

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

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, isDev);

  // ── Rate limiting ────────────────────────────────────────────────────
  // Only mutating requests consume a token. A GET to an API route (or a
  // preflight) should not burn a family's intake quota.
  const route = RATE_LIMITED_ROUTES.find((r) =>
    request.nextUrl.pathname.startsWith(r.prefix),
  );

  if (route && request.method === "POST") {
    const identifier = clientIdentifier(request.headers);
    const result = await rateLimit(identifier, route.scope);

    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Too many requests. Please wait and try again." },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders(result),
            "Retry-After": String(retryAfter),
            "Content-Security-Policy": csp,
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // Next reads x-nonce to stamp its inline scripts.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    for (const [key, value] of Object.entries(rateLimitHeaders(result))) {
      response.headers.set(key, value);
    }
    return response;
  }

  // ── Everything else: CSP only ────────────────────────────────────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  /**
   * Static assets are excluded — they carry no scripts and must not consume
   * Redis round-trips.
   *
   * NOTE: the prefetch `missing` conditions were removed. They were correct for
   * a CSP-only middleware, but skipping middleware on prefetches would also
   * skip rate limiting, and a prefetch header is trivially forgeable.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
