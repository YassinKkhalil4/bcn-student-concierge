import { hmacSign, hmacVerify, secretFromEnv } from "@/lib/auth/hmac";

/**
 * Student portal tokens: the session cookie and the emailed sign-in link.
 *
 * Both are HMAC-signed with PORTAL_SESSION_SECRET but under DIFFERENT purpose
 * strings, so a session cookie can never be replayed as a link and a link can
 * never be presented as a session. Web Crypto only, so middleware (Edge) and
 * route handlers (Node) verify with the same code.
 *
 *   session: <caseId>.<expiresAt>.<sig>             purpose "portal-session"
 *   link:    <caseId>.<issuedAt>.<expiresAt>.<sig>  purpose "portal-link"
 *
 * Case ids are base64url tokens, which never contain ".", so the split is
 * unambiguous.
 *
 * A link is single-use without a token table: it is only accepted if it was
 * issued after the case's last successful sign-in (cases.portal_login_at, see
 * consumeLoginLink). Using any link therefore invalidates every older one.
 */

export const PORTAL_COOKIE = "bcn_portal";
/** Students come back over weeks; a day balances that against shared laptops. */
export const PORTAL_SESSION_TTL_SECONDS = 24 * 60 * 60;
export const LOGIN_LINK_TTL_SECONDS = 30 * 60;

const secret = () => secretFromEnv("PORTAL_SESSION_SECRET");
const CASE_ID = /^[A-Za-z0-9_-]{16,64}$/;

export function portalConfigured(): boolean {
  return secret() !== null;
}

function requireSecret() {
  const s = secret();
  if (!s) throw new Error("PORTAL_SESSION_SECRET is not configured (min 32 bytes)");
  return s;
}

export async function createPortalSession(caseId: string, now = Date.now()): Promise<string> {
  const expiresAt = now + PORTAL_SESSION_TTL_SECONDS * 1000;
  const sig = await hmacSign(requireSecret(), `portal-session.v1.${caseId}.${expiresAt}`);
  return `${caseId}.${expiresAt}.${sig}`;
}

/** The case this session belongs to, or null if absent, forged or expired. */
export async function verifyPortalSession(
  token: string | undefined | null,
  now = Date.now(),
): Promise<string | null> {
  const parts = token?.split(".");
  if (!parts || parts.length !== 3) return null;
  const [caseId, expiresRaw, sig] = parts as [string, string, string];
  const expiresAt = Number(expiresRaw);
  if (!CASE_ID.test(caseId) || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return null;
  if (expiresAt > now + PORTAL_SESSION_TTL_SECONDS * 1000 + 60_000) return null;
  const s = secret();
  if (!s) return null;
  return (await hmacVerify(s, `portal-session.v1.${caseId}.${expiresAt}`, sig)) ? caseId : null;
}

export async function createLoginLinkToken(caseId: string, now = Date.now()): Promise<string> {
  const expiresAt = now + LOGIN_LINK_TTL_SECONDS * 1000;
  const sig = await hmacSign(requireSecret(), `portal-link.v1.${caseId}.${now}.${expiresAt}`);
  return `${caseId}.${now}.${expiresAt}.${sig}`;
}

export interface LoginLink {
  caseId: string;
  issuedAt: Date;
}

/**
 * Checks signature and expiry only. Whether the link has already been used is
 * decided by consumeLoginLink() against the database, atomically.
 */
export async function verifyLoginLinkToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<LoginLink | null> {
  const parts = token?.split(".");
  if (!parts || parts.length !== 4) return null;
  const [caseId, issuedRaw, expiresRaw, sig] = parts as [string, string, string, string];
  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);
  if (!CASE_ID.test(caseId) || !Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) {
    return null;
  }
  if (expiresAt <= now || expiresAt - issuedAt !== LOGIN_LINK_TTL_SECONDS * 1000) return null;
  if (issuedAt > now + 60_000) return null; // from the future: forged or clock-broken
  const s = secret();
  if (!s) return null;
  const ok = await hmacVerify(s, `portal-link.v1.${caseId}.${issuedAt}.${expiresAt}`, sig);
  return ok ? { caseId, issuedAt: new Date(issuedAt) } : null;
}

export const portalCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Lax, not Strict (unlike admin): a student opening the portal from a link in
  // their email arrives by cross-site navigation, and Strict would drop the
  // cookie and bounce them to sign-in. Lax still withholds the cookie from
  // cross-site POSTs, which is what CSRF needs.
  sameSite: "lax" as const,
  path: "/",
  maxAge: PORTAL_SESSION_TTL_SECONDS,
};
