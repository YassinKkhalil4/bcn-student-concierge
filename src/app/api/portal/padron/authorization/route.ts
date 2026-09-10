import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { portalCaseId } from "@/lib/portal/guard";
import { getCase } from "@/lib/server/storage";
import {
  authorizationInputSchema,
  fillPadronAuthorization,
  AuthorizationNotApplicableError,
  UnprintableCharactersError,
} from "@/lib/forms/padron-authorization";
import { TemplateNotFoundError } from "@/lib/forms/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generate Barcelona's official Padrón authorisation, pre-filled, for the
 * signed-in student's own address.
 *
 * The signer's details (usually the landlord's) are used to fill the form and
 * then discarded: never stored, never logged. The student uploads the signed
 * copy separately, and that upload is encrypted like every other document.
 */
export async function POST(request: Request): Promise<Response> {
  const limited = await enforceRateLimit(request, "portal-action");
  if (limited) return limited;

  const caseId = await portalCaseId();
  if (!caseId) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

  const parsed = authorizationInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 422 },
    );
  }

  const record = await getCase(caseId);
  if (!record?.intake) return NextResponse.json({ error: "File not found" }, { status: 404 });

  try {
    const pdf = await fillPadronAuthorization(record.intake, parsed.data);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Autoritzacio-padro-${record.ref}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationNotApplicableError || error instanceof UnprintableCharactersError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof TemplateNotFoundError) {
      return NextResponse.json(
        { error: "This form is temporarily unavailable. Please try again later or contact us." },
        { status: 503 },
      );
    }
    // Deliberately no input in the log line: it is a third party's data.
    console.error("[padron] authorisation generation failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not generate the form." }, { status: 500 });
  }
}
