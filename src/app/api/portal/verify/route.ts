import { NextResponse } from "next/server";
import { clientIdentifier, rateLimit } from "@/lib/rate-limit";
import { consumeLoginLink } from "@/lib/server/portal";
import {
  PORTAL_COOKIE,
  createPortalSession,
  portalCookieOptions,
  verifyLoginLinkToken,
} from "@/lib/portal/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const to = (request: Request, path: string) =>
  NextResponse.redirect(new URL(path, process.env.PUBLIC_ORIGIN ?? request.url), { status: 303 });

/**
 * Redeem a sign-in link. POST only: the emailed link opens a page with a
 * "Continue" button that posts here. Email security scanners fetch every link
 * in a message; if a GET redeemed the token, the scanner would use up the
 * student's single-use link before the student ever clicked it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await rateLimit(clientIdentifier(request.headers), "portal-verify")).allowed) {
    return to(request, "/portal/login?error=locked");
  }

  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  const link = await verifyLoginLinkToken(typeof token === "string" ? token : null);
  if (!link || !(await consumeLoginLink(link.caseId, link.issuedAt))) {
    return to(request, "/portal/login?error=link");
  }

  const response = to(request, "/portal");
  response.cookies.set(PORTAL_COOKIE, await createPortalSession(link.caseId), portalCookieOptions);
  return response;
}
