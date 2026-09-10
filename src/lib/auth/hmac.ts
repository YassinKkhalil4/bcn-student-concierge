/**
 * HMAC signing primitives on Web Crypto — shared by the admin and student
 * session tokens. Web Crypto (not node:crypto) so the same code verifies tokens
 * in Edge middleware and in Node handlers.
 */

const encoder = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(input: string): Uint8Array<ArrayBuffer> | null {
  try {
    const s = atob(input.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(new ArrayBuffer(s.length));
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * A signing secret from the environment, or null when unset or shorter than
 * 32 bytes. Callers treat null as "feature disabled" — never as "unsigned OK".
 */
export function secretFromEnv(name: string): Uint8Array<ArrayBuffer> | null {
  const raw = process.env[name];
  if (!raw) return null;
  const bytes = fromB64url(raw.replace(/=+$/, ""));
  return bytes && bytes.length >= 32 ? bytes : null;
}

async function importKey(secret: Uint8Array<ArrayBuffer>, usage: "sign" | "verify") {
  return crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function hmacSign(secret: Uint8Array<ArrayBuffer>, payload: string): Promise<string> {
  const key = await importKey(secret, "sign");
  return b64url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

/** Constant-time: crypto.subtle.verify, never a string comparison. */
export async function hmacVerify(
  secret: Uint8Array<ArrayBuffer>,
  payload: string,
  signature: string,
): Promise<boolean> {
  const sig = fromB64url(signature);
  if (!sig) return false;
  const key = await importKey(secret, "verify");
  return crypto.subtle.verify("HMAC", key, sig, encoder.encode(payload));
}

export function randomNonce(bytes = 16): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
