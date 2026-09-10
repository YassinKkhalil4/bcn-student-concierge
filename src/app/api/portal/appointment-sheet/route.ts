import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { portalCaseId } from "@/lib/portal/guard";
import { appointmentSheetForCase } from "@/lib/guides/sheet-for-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in student's own appointment-day sheet. */
export async function GET(request: Request): Promise<Response> {
  const limited = await enforceRateLimit(request, "portal-action");
  if (limited) return limited;
  const caseId = await portalCaseId();
  if (!caseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sheet = await appointmentSheetForCase(caseId);
  if (!sheet) return NextResponse.json({ error: "Your appointment is not booked yet" }, { status: 404 });
  return new Response(new Uint8Array(sheet.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Appointment-day-${sheet.ref}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
