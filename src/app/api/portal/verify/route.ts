import { NextResponse } from "next/server";
import { clientIdentifier, rateLimit } from "@/lib/rate-limit";
import { consumeLoginLink, setCaseLocale } from "@/lib/server/portal";
import {
  PORTAL_COOKIE,
  createPortalSession,
  portalCookieOptions,
  verifyLoginLinkToken,
} from "@/lib/portal/session";
import { formLocale, portalRedirect } from "@/lib/portal/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * Redeem a sign-in link. POST only: the emailed link opens a page with a
 * "Continue" button that posts here. Email security scanners fetch every link
 * in a message; if a GET redeemed the token, the scanner would use up the
 * student's single-use link before the student ever clicked it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData().catch(() => null);
  const locale = formLocale(form);
  const to = (path: string) => portalRedirect(request, locale, path);

  if (!(await rateLimit(clientIdentifier(request.headers), "portal-verify")).allowed) {
    return to("/portal/login?error=locked");
  }

  const token = form?.get("token");
  const link = await verifyLoginLinkToken(typeof token === "string" ? token : null);
  if (!link || !(await consumeLoginLink(link.caseId, link.issuedAt))) {
    return to("/portal/login?error=link");
  }

  // Signing in from a page in another language is a language choice too.
  await setCaseLocale(link.caseId, locale);
  const response = to("/portal");
  response.cookies.set(PORTAL_COOKIE, await createPortalSession(link.caseId), portalCookieOptions);
  return response;
}
