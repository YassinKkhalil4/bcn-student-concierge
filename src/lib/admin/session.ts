/**
 * Admin session tokens — HMAC-signed, stateless.
 *
 * Uses Web Crypto only, so the SAME verification runs in Edge middleware (the
 * first gate) and in Node route handlers and server actions (the second gate).
 * Every admin handler re-verifies; the middleware matcher is not trusted alone,
 * because one wrong regex there would otherwise expose every passport scan.
 *
 * Token: `<expiresAtMs>.<nonce>.<signature>`, signed with ADMIN_SESSION_SECRET.
 *
 * Stateless tokens cannot be revoked individually. To end every session at
 * once (a leaked laptop, a departing staff member), rotate ADMIN_SESSION_SECRET.
 * The short TTL bounds the damage of a stolen cookie in the meantime.
 */

export const ADMIN_COOKIE = "bcn_admin";
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // one working day

import { hmacSign, hmacVerify, randomNonce, secretFromEnv } from "@/lib/auth/hmac";

/** Null when unconfigured or too short — admin is then disabled, not open. */
const secretBytes = () => secretFromEnv("ADMIN_SESSION_SECRET");

export function adminConfigured(): boolean {
  return secretBytes() !== null && Boolean(process.env.ADMIN_PASSWORD_HASH);
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const secret = secretBytes();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured (min 32 bytes)");
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  const nonce = randomNonce();
  return `${expiresAt}.${nonce}.${await hmacSign(secret, `v1.${expiresAt}.${nonce}`)}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiresRaw, nonce, sig] = parts as [string, string, string];

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  // Refuse tokens claiming a lifetime longer than we ever issue.
  if (expiresAt > now + SESSION_TTL_SECONDS * 1000 + 60_000) return false;

  const secret = secretBytes();
  if (!secret) return false;
  return hmacVerify(secret, `v1.${expiresAt}.${nonce}`, sig);
}
