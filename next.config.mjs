/**
 * Security headers are defined here so they apply to every response, including
 * static assets and error pages.
 *
 * NOTE ON TLS: TLS 1.3 is enforced by the reverse proxy, not here — see the
 * `protocols tls1.3` line in deploy/Caddyfile. This config adds HSTS so
 * browsers refuse plain HTTP on every visit after the first.
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
  // Self-contained server bundle (.next/standalone) for the Docker image: only
  // the files the server actually needs, no full node_modules.
  output: "standalone",
  // PGlite ships WASM that webpack cannot bundle; load it from node_modules.
  serverExternalPackages: ["pdf-lib", "@electric-sql/pglite", "pg"],
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
