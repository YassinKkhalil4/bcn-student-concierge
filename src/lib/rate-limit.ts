import { NextResponse } from "next/server";
import { sql, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { rateLimits } from "@/lib/db/schema";
import { pseudonymize } from "@/lib/crypto";

/**
 * Rate limiting backed by Postgres — no extra service to run on the VPS.
 *
 * Algorithm: sliding-window counter. Each (scope, client, window) has a counter
 * row; the effective count is the current window plus the previous window
 * weighted by how much of it still overlaps the sliding window. This avoids the
 * fixed-window flaw where a client bursts the full quota at the end of one
 * window and again at the start of the next.
 *
 * One round trip per check: an atomic INSERT … ON CONFLICT increments the
 * current window and reads the previous one in the same statement, so
 * concurrent requests from one client cannot both slip under the limit.
 *
 * Limits are enforced inside the route handlers, not middleware, because Next
 * middleware runs in the Edge sandbox, which cannot open a Postgres connection.
 * tests/rate-limit.test.ts fails if any POST route stops calling
 * enforceRateLimit(), so a new route cannot ship unprotected by omission.
 */

export type LimitScope = "intake" | "upload" | "checkout" | "admin-login";

interface Quota {
  tokens: number;
  windowMs: number;
  /** Deny when the limiter itself fails (production only). */
  failClosed?: boolean;
}

const MINUTE = 60_000;

export const QUOTAS: Record<LimitScope, Quota> = {
  // A family completing one intake, plus retries after validation errors.
  intake: { tokens: 5, windowMs: 60 * MINUTE },
  // Three document slots, allowing re-uploads of rejected scans.
  upload: { tokens: 20, windowMs: 60 * MINUTE },
  // Checkout is retried on card failures; tight but not hostile.
  checkout: { tokens: 10, windowMs: 15 * MINUTE },
  // Guessing the one credential that unlocks every passport scan. The only
  // scope that fails CLOSED: if the limiter breaks, refusing staff logins for a
  // while is a far better trade than allowing unlimited guesses.
  "admin-login": { tokens: 5, windowMs: 15 * MINUTE, failClosed: true },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window ends. */
  resetAt: number;
  /** True when the check itself failed and the fail-mode policy decided. */
  degraded: boolean;
}

export async function rateLimit(
  identifier: string,
  scope: LimitScope,
  now = Date.now(),
): Promise<RateLimitResult> {
  const { tokens, windowMs, failClosed } = QUOTAS[scope];
  const currentStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = currentStart + windowMs;

  try {
    const db = await getDb();
    // Never store the raw IP: it is personal data, and a counter needs only a
    // stable key.
    const key = pseudonymize(identifier, "rate-limit");
    const current = new Date(currentStart);
    const previous = new Date(currentStart - windowMs);

    const result = await db.execute<{ current: number; previous: number }>(sql`
      WITH hit AS (
        INSERT INTO ${rateLimits} (scope, key, window_start, count)
        VALUES (${scope}, ${key}, ${current.toISOString()}::timestamptz, 1)
        ON CONFLICT (scope, key, window_start)
        DO UPDATE SET count = ${rateLimits}.count + 1
        RETURNING count
      )
      SELECT
        (SELECT count FROM hit)::int AS current,
        COALESCE((
          SELECT count FROM ${rateLimits}
          WHERE scope = ${scope} AND key = ${key}
            AND window_start = ${previous.toISOString()}::timestamptz
        ), 0)::int AS previous
    `);

    const row = (result as unknown as { rows: { current: number; previous: number }[] }).rows[0]!;
    const overlap = 1 - (now - currentStart) / windowMs;
    const weighted = Number(row.current) + Number(row.previous) * overlap;

    return {
      allowed: weighted <= tokens,
      limit: tokens,
      remaining: Math.max(0, Math.floor(tokens - weighted)),
      resetAt,
      degraded: false,
    };
  } catch (error) {
    // FAIL MODE: open by default. Rate limiting is abuse protection, not
    // authentication — a limiter fault must not lock families out mid-
    // application. Login is the exception (failClosed), in production only so
    // local development can still sign in.
    const deny = Boolean(failClosed) && process.env.NODE_ENV === "production";
    console.error(`[rate-limit] check failed for ${scope}; failing ${deny ? "closed" : "open"}`, error);
    return { allowed: !deny, limit: tokens, remaining: 0, resetAt, degraded: true };
  }
}

/**
 * The client's IP, as reported by our own reverse proxy.
 *
 * The deployment (docs/DEPLOY.md) puts Caddy in front and never exposes the app
 * port, and Caddy OVERWRITES X-Real-IP with the socket address. So this header
 * can only have come from the proxy. If the app were reachable directly, a
 * client could set it and dodge every limit — which is why the app port must
 * stay unpublished.
 */
export function clientIdentifier(headers: Headers): string {
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
}

/**
 * Call first in a route handler. Returns a 429 response to send back, or null
 * to continue.
 */
export async function enforceRateLimit(
  request: Request,
  scope: LimitScope,
): Promise<NextResponse | null> {
  const result = await rateLimit(clientIdentifier(request.headers), scope);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(result),
        "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
        "Cache-Control": "no-store",
      },
    },
  );
}

/** Delete counters too old to matter (older than two of the longest window). */
export async function pruneRateLimits(now = Date.now()): Promise<number> {
  const longest = Math.max(...Object.values(QUOTAS).map((q) => q.windowMs));
  const db = await getDb();
  const deleted = await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, new Date(now - 2 * longest)))
    .returning({ key: rateLimits.key });
  return deleted.length;
}
