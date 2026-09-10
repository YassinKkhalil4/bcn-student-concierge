/**
 * Fixed-window rate limiter.
 *
 * ⚠️ SCOPE: this in-memory implementation is correct for a single instance
 * only. On Vercel or any multi-instance deploy each instance keeps its own
 * counter, so the effective limit multiplies by the instance count. Wire
 * `RATE_LIMIT_REDIS_URL` and swap the store before relying on this as a
 * security control rather than an abuse speed-bump. See docs/SECURITY.md.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Bounded so a flood of unique keys cannot exhaust memory. */
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      // Drop expired entries before admitting a new key.
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      if (windows.size >= MAX_TRACKED_KEYS) {
        return { allowed: false, remaining: 0, resetAt: now + windowMs };
      }
    }
    const resetAt = now + windowMs;
    windows.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/**
 * Derive a client key. Trusts the leftmost x-forwarded-for entry ONLY when
 * TRUST_PROXY is set — otherwise a client can spoof the header and evade the
 * limit entirely. Set it once you know your edge appends rather than replaces.
 */
export function clientKey(headers: Headers, scope: string): string {
  const trustProxy = process.env.TRUST_PROXY === "true";
  const ip = trustProxy
    ? (headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown")
    : (headers.get("x-real-ip")?.trim() ?? "unknown");
  return `${scope}:${ip}`;
}
