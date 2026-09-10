import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { portalCaseId } from "@/lib/portal/guard";
import { getCase } from "@/lib/server/storage";
import { listAppointments } from "@/lib/server/appointments";
import { fillFormStrict, FieldOverflowError, TemplateNotFoundError, UncalibratedFormError } from "@/lib/forms/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The student's pre-filled EX-17 / EX-18. Offered only once staff have booked
 * the police appointment — by then they have checked the file, so the student
 * is not printing a form built from data nobody has reviewed yet.
 */
export async function GET(request: Request): Promise<Response> {
  const limited = await enforceRateLimit(request, "portal-action");
  if (limited) return limited;
  const caseId = await portalCaseId();
  if (!caseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await getCase(caseId);
  if (!record?.intake) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!(await listAppointments(caseId)).some((a) => a.kind === "police")) {
    return NextResponse.json({ error: "Your form will be ready once your appointment is booked" }, { status: 409 });
  }

  try {
    const result = await fillFormStrict(record.intake);
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.formId}-${record.ref}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof TemplateNotFoundError || error instanceof UncalibratedFormError) {
      return NextResponse.json({ error: "Your form is temporarily unavailable. Please contact us." }, { status: 503 });
    }
    if (error instanceof FieldOverflowError) {
      return NextResponse.json({ error: "We need to adjust your form by hand. We will send it to you." }, { status: 422 });
    }
    throw error;
  }
}
