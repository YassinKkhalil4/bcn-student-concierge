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

const encoder = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(input: string): Uint8Array<ArrayBuffer> | null {
  try {
    const s = atob(input.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(new ArrayBuffer(s.length));
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Null when unconfigured or too short — admin is then disabled, not open. */
function secretBytes(): Uint8Array<ArrayBuffer> | null {
  const raw = process.env.ADMIN_SESSION_SECRET;
  if (!raw) return null;
  const bytes = fromB64url(raw.replace(/=+$/, ""));
  return bytes && bytes.length >= 32 ? bytes : null;
}

export function adminConfigured(): boolean {
  return secretBytes() !== null && Boolean(process.env.ADMIN_PASSWORD_HASH);
}

async function hmacKey(usage: "sign" | "verify"): Promise<CryptoKey | null> {
  const secret = secretBytes();
  if (!secret) return null;
  return crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, [
    usage,
  ]);
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const key = await hmacKey("sign");
  if (!key) throw new Error("ADMIN_SESSION_SECRET is not configured (min 32 bytes)");
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `v1.${expiresAt}.${nonce}`;
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${expiresAt}.${nonce}.${b64url(sig)}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiresRaw, nonce, sigRaw] = parts as [string, string, string];

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  // Refuse tokens claiming a lifetime longer than we ever issue.
  if (expiresAt > now + SESSION_TTL_SECONDS * 1000 + 60_000) return false;

  const sig = fromB64url(sigRaw);
  const key = await hmacKey("verify");
  if (!sig || !key) return false;

  // crypto.subtle.verify is constant-time; never compare signatures with ===.
  return crypto.subtle.verify("HMAC", key, sig, encoder.encode(`v1.${expiresAt}.${nonce}`));
}
