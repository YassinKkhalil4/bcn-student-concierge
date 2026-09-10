import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { appointmentSheetForCase } from "@/lib/guides/sheet-for-case";
import { SheetOverflowError } from "@/lib/guides/appointment-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const sheet = await appointmentSheetForCase(id);
    if (!sheet) return NextResponse.json({ error: "No police appointment recorded" }, { status: 404 });
    return new Response(new Uint8Array(sheet.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Appointment-day-${sheet.ref}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof SheetOverflowError) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }
}

