import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { portalCaseId } from "@/lib/portal/guard";
import { markDocumentsSubmitted } from "@/lib/server/portal";
import { notifyDocumentsSubmitted } from "@/lib/notify/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Submit for review": the student says their documents are complete. */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, "portal-action");
  if (limited) return limited;

  const caseId = await portalCaseId();
  if (!caseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Notify staff only on the first submission, not on every click.
  if (await markDocumentsSubmitted(caseId)) await notifyDocumentsSubmitted(caseId);
  return NextResponse.redirect(new URL("/portal?submitted=1", process.env.PUBLIC_ORIGIN ?? request.url), {
    status: 303,
  });
}
