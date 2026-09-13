import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { rateLimit, pruneRateLimits, QUOTAS, clientIdentifier } from "../src/lib/rate-limit";
import { __setDb, type Db } from "../src/lib/db/client";
import { useTestDb } from "./helpers/db";

let client: PGlite;
let db: Db;

beforeAll(async () => {
  process.env.DOCUMENT_MASTER_KEY = randomBytes(32).toString("base64");
  ({ db, client } = await useTestDb());
});

beforeEach(async () => {
  __setDb(db);
  await client.exec("TRUNCATE rate_limits");
});

const HOUR = 3_600_000;
// The start of an hour-aligned window, so window maths is deterministic.
const T0 = Math.floor(Date.now() / HOUR) * HOUR;

describe("sliding-window limiter", () => {
  it("allows up to the quota and then denies", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await rateLimit("198.51.100.1", "intake", T0 + 1000));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(results[4]!.remaining).toBe(0);
  });

  it("counts clients separately", async () => {
    for (let i = 0; i < 5; i++) await rateLimit("198.51.100.1", "intake", T0 + 1000);
    expect((await rateLimit("198.51.100.2", "intake", T0 + 1000)).allowed).toBe(true);
  });

  it("counts scopes separately", async () => {
    for (let i = 0; i < 5; i++) await rateLimit("198.51.100.1", "intake", T0 + 1000);
    expect((await rateLimit("198.51.100.1", "upload", T0 + 1000)).allowed).toBe(true);
  });

  it("budgets uploads per case, so students sharing a network do not share a quota", async () => {
    const { tokens } = QUOTAS["upload-case"];
    // Every slot in the intake and portal wizards, each replaced several times.
    expect(tokens).toBeGreaterThanOrEqual(7 * 5);
    for (let i = 0; i < tokens; i++) await rateLimit("case:first", "upload-case", T0 + 1000);
    expect((await rateLimit("case:first", "upload-case", T0 + 1000)).allowed).toBe(false);
    expect((await rateLimit("case:second", "upload-case", T0 + 1000)).allowed).toBe(true);
    // Documents route: counted against the case as well as the address.
    const route = readFileSync(path.join(process.cwd(), "src/app/api/documents/route.ts"), "utf8");
    expect(route).toMatch(/enforceRateLimit\(request, "upload-case", `case:\$\{caseId\}`\)/);
  });

  it("carries the previous window's weight across the boundary", async () => {
    // 5 hits late in window A. Just after the boundary, most of A still
    // overlaps the sliding window, so a burst must NOT get a fresh quota —
    // the flaw a fixed window has.
    for (let i = 0; i < 5; i++) await rateLimit("198.51.100.1", "intake", T0 + HOUR - 1000);
    expect((await rateLimit("198.51.100.1", "intake", T0 + HOUR + 1000)).allowed).toBe(false);
  });

  it("recovers as the previous window slides out", async () => {
    for (let i = 0; i < 5; i++) await rateLimit("198.51.100.1", "intake", T0 + 1000);
    // 90% through the next window only 10% of the old count still weighs in.
    expect((await rateLimit("198.51.100.1", "intake", T0 + HOUR + 0.9 * HOUR)).allowed).toBe(true);
  });

  it("never stores the client IP", async () => {
    await rateLimit("198.51.100.77", "intake", T0 + 1000);
    const dump = JSON.stringify((await client.query("SELECT * FROM rate_limits")).rows);
    expect(dump).not.toContain("198.51.100.77");
  });

  it("prunes counters older than two of the longest window", async () => {
    await rateLimit("198.51.100.1", "intake", T0 - 5 * HOUR);
    await rateLimit("198.51.100.1", "intake", T0 + 1000);
    expect(await pruneRateLimits(T0 + 2000)).toBe(1);
    expect((await client.query("SELECT count(*)::int AS n FROM rate_limits")).rows[0]).toEqual({ n: 1 });
  });
});

describe("fail modes", () => {
  const broken = () =>
    __setDb({ execute: () => Promise.reject(new Error("db down")) } as unknown as Db);

  it("fails open for public forms", async () => {
    broken();
    const r = await rateLimit("198.51.100.1", "intake");
    expect(r.allowed).toBe(true);
    expect(r.degraded).toBe(true);
  });

  it("fails closed for admin login in production", async () => {
    broken();
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      expect((await rateLimit("198.51.100.1", "admin-login")).allowed).toBe(false);
    } finally {
      env.NODE_ENV = previous;
    }
  });

  it("marks only admin login as fail-closed", () => {
    expect(Object.entries(QUOTAS).filter(([, q]) => q.failClosed).map(([s]) => s)).toEqual([
      "admin-login",
    ]);
  });
});

describe("client identifier", () => {
  it("reads the proxy-set X-Real-IP", () => {
    expect(clientIdentifier(new Headers({ "x-real-ip": " 203.0.113.9 " }))).toBe("203.0.113.9");
  });

  it("ignores X-Forwarded-For, which a client can prepend to", () => {
    expect(clientIdentifier(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("unknown");
  });
});

describe("every POST route is rate limited", () => {
  /**
   * Structural guard. Limits live in route handlers (middleware cannot reach
   * Postgres), so this test is what stops a new POST route shipping without
   * one. Exemptions are listed with their reason.
   */
  const EXEMPT: Record<string, string> = {
    "api/webhooks/stripe/route.ts":
      "Stripe retries on 429, so limiting would delay payment confirmations; protected by signature verification",
    "api/admin/logout/route.ts": "Only clears the caller's own cookie",
    "api/portal/logout/route.ts": "Only clears the caller's own cookie",
  };

  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "route.ts") routes.push(full);
    }
  };
  walk(path.join(process.cwd(), "src/app/api"));

  const postRoutes = routes.filter((f) => /export async function POST/.test(readFileSync(f, "utf8")));

  it("finds the POST routes", () => {
    expect(postRoutes.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of postRoutes) {
    const rel = path.relative(path.join(process.cwd(), "src/app"), file);
    it(rel, () => {
      if (EXEMPT[rel]) return;
      const source = readFileSync(file, "utf8");
      expect(
        /enforceRateLimit\(|rateLimit\(/.test(source),
        `${rel} has a POST handler with no rate limit`,
      ).toBe(true);
    });
  }
});
