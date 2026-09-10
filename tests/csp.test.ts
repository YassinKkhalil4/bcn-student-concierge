import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The CSP allows only scripts carrying the per-request nonce. A statically
 * pre-rendered page is built before any request exists, so its scripts carry
 * no nonce and the browser blocks them all. Every page must therefore render
 * per request — enforced once, at the root layout.
 */
describe("nonce CSP invariants", () => {
  it("forces per-request rendering for every page", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toMatch(/export const dynamic = "force-dynamic";/);
  });

  it("hands Next the CSP on the request, where it looks for the nonce", () => {
    const mw = readFileSync("src/middleware.ts", "utf8");
    expect(mw).toMatch(/requestHeaders\.set\("Content-Security-Policy", csp\)/);
    expect(mw).toMatch(/'strict-dynamic'/);
  });
});
