import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Distributed rate limiting backed by Upstash Redis.
 *
 * Replaces the previous in-memory limiter, which kept a counter per instance —
 * on a serverless deploy that meant the effective limit multiplied by the
 * number of running instances, making it an abuse speed-bump rather than a
 * control. Redis gives one shared counter across every instance and region.
 *
 * Upstash is used over a raw Redis client because middleware runs on the Edge
 * runtime, which has no TCP sockets. Upstash speaks HTTP, so it works there.
 *
 * Sliding-window, not fixed-window: a fixed window lets a caller burst the full
 * quota at the end of one window and again at the start of the next, yielding
 * 2x the intended rate across the boundary.
 */

export type LimitScope = "intake" | "upload" | "checkout";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
  /** True when Redis is unconfigured and the request was allowed unchecked. */
  degraded: boolean;
}

/** Quotas per scope. Tuned to real client behaviour, not round numbers. */
const QUOTAS: Record<LimitScope, { tokens: number; window: `${number} ${"s" | "m" | "h"}` }> = {
  // A family completing one intake, plus retries after validation errors.
  intake: { tokens: 5, window: "1 h" },
  // Three document slots, allowing re-uploads of rejected scans.
  upload: { tokens: 20, window: "1 h" },
  // Checkout is retried on card failures; keep it tight but not hostile.
  checkout: { tokens: 10, window: "15 m" },
};

function redisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

let redis: Redis | null = null;
const limiters = new Map<LimitScope, Ratelimit>();

function getLimiter(scope: LimitScope): Ratelimit | null {
  if (!redisConfigured()) return null;

  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  let limiter = limiters.get(scope);
  if (!limiter) {
    const { tokens, window } = QUOTAS[scope];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(tokens, window),
      // Namespaced so the three scopes never share a counter.
      prefix: `bcn:rl:${scope}`,
      // Caches allow/deny decisions in instance memory for the duration of the
      // window, cutting Redis round-trips on repeat callers.
      ephemeralCache: new Map(),
      analytics: false,
    });
    limiters.set(scope, limiter);
  }
  return limiter;
}

/**
 * Check and consume one token.
 *
 * FAILURE MODE — deliberately fail-open, and loudly:
 * If Redis is unreachable we allow the request and set `degraded`. Rate
 * limiting protects against abuse; it is not an authentication control. Failing
 * closed would turn an Upstash outage into a total outage of the intake portal,
 * blocking legitimate families mid-application. The `degraded` flag is logged so
 * an outage is visible rather than silently disabling protection.
 *
 * If your threat model makes abuse costlier than downtime, invert this — but do
 * it deliberately, not by accident.
 */
export async function rateLimit(
  identifier: string,
  scope: LimitScope,
): Promise<RateLimitResult> {
  const { tokens } = QUOTAS[scope];
  const limiter = getLimiter(scope);

  if (!limiter) {
    // Unconfigured: development, or a misconfigured deploy.
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[rate-limit] Redis is not configured; ${scope} is UNPROTECTED. ` +
          "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      );
    }
    return {
      allowed: true,
      limit: tokens,
      remaining: tokens,
      resetAt: Date.now(),
      degraded: true,
    };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      allowed: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.reset,
      degraded: false,
    };
  } catch (error) {
    console.error(`[rate-limit] Redis unavailable for ${scope}; failing open`, error);
    return {
      allowed: true,
      limit: tokens,
      remaining: 0,
      resetAt: Date.now(),
      degraded: true,
    };
  }
}

/**
 * Derive the client identifier.
 *
 * `x-forwarded-for` is only trusted when TRUST_PROXY is set, because a client
 * can send that header directly. If an untrusted value were used as the rate
 * limit key, an attacker would simply vary it per request and never be limited.
 */
export function clientIdentifier(headers: Headers): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = headers.get("x-forwarded-for");
    // Leftmost entry is the original client when the edge APPENDS to the chain.
    const client = forwarded?.split(",")[0]?.trim();
    if (client) return client;
  }
  return headers.get("x-real-ip")?.trim() ?? "unknown";
}

/** Standard headers so clients can back off instead of hammering. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
}
