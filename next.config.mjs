/**
 * Security headers are defined here so they apply to every response, including
 * static assets and error pages.
 *
 * NOTE ON TLS: TLS 1.3 cannot be enforced from application code. It is a
 * termination-layer control. This config emits HSTS (which forces HTTPS on
 * repeat visits) but the minimum TLS version MUST be set at your edge:
 * see docs/SECURITY.md for the required Vercel / Cloudflare / nginx settings.
 */

/**
 * Static headers only. The Content-Security-Policy is NOT here — it needs a
 * per-request nonce for Next's inline bootstrap scripts, so it is generated in
 * src/middleware.ts. Defining it in both places would leave two competing
 * policies with the intersection silently applying.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["pdf-lib"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Never let intermediaries or browsers cache identity documents.
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};
