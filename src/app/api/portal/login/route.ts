import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIdentifier, rateLimit } from "@/lib/rate-limit";
import { findCasesByEmail } from "@/lib/server/portal";
import { emailIndexFor } from "@/lib/server/case-codec";
import { createLoginLinkToken } from "@/lib/portal/session";
import { sendEmail } from "@/lib/email/send";
import { loginLinkEmail } from "@/lib/email/templates";
import { formLocale, portalRedirect } from "@/lib/portal/redirect";
import { translatorFor } from "@/i18n/messages";
import { localizedPath, type SiteLocale } from "@/i18n/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailSchema = z.string().trim().toLowerCase().email().max(254);


/**
 * Request a sign-in link.
 *
 * The response is IDENTICAL whether or not a file exists for the address, and
 * the email is sent in the background after responding, so neither the answer
 * nor its timing reveals who is a client.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData().catch(() => null);
  const locale = formLocale(form);
  const back = (query: string) => portalRedirect(request, locale, `/portal/login?${query}`);

  if (!(await rateLimit(clientIdentifier(request.headers), "portal-link")).allowed) {
    return back("error=locked");
  }

  const parsed = emailSchema.safeParse(form?.get("email"));
  if (!parsed.success) return back("error=email");
  const email = parsed.data;

  // Per-address limit, keyed by the blind index rather than the address.
  if (!(await rateLimit(emailIndexFor(email), "portal-link-email")).allowed) {
    return back("sent=1");
  }

  void deliverLinks(email, locale).catch((error) =>
    console.error("[portal] sign-in email failed", error instanceof Error ? error.message : error),
  );
  return back("sent=1");
}

/** In the language of the page the link was requested from. */
async function deliverLinks(email: string, locale: SiteLocale): Promise<void> {
  const found = await findCasesByEmail(email);
  if (found.length === 0) return;
  const origin = process.env.PUBLIC_ORIGIN ?? "http://localhost:3000";
  const links = await Promise.all(
    found.map(async (c) => ({
      ref: c.ref,
      url: `${origin}${localizedPath(locale, "/portal/verify")}?token=${encodeURIComponent(await createLoginLinkToken(c.id))}`,
    })),
  );
  await sendEmail(loginLinkEmail(email, links, await translatorFor(locale, "email"), locale));
}
