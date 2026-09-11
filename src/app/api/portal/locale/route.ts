import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { portalCaseId } from "@/lib/portal/guard";
import { setCaseLocale } from "@/lib/server/portal";
import { isSiteLocale } from "@/i18n/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save the language a signed-in student chose, on their own file (the case
 * comes from the session, never the body). JSON only: a cross-site form cannot
 * send it, and the session cookie is SameSite=Lax besides.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, "portal-action");
  if (limited) return limited;

  const caseId = await portalCaseId();
  if (!caseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  }
  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  if (!isSiteLocale(body?.locale)) {
    return NextResponse.json({ error: "Unknown language" }, { status: 400 });
  }

  await setCaseLocale(caseId, body.locale);
  return new NextResponse(null, { status: 204 });
}
