import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { getCase } from "@/lib/server/storage";
import {
  fillFormStrict,
  FieldOverflowError,
  TemplateNotFoundError,
  UncalibratedFormError,
} from "@/lib/forms/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generate the pre-filled EX-17 / EX-18 for a case, on demand. Never stored. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const record = await getCase(id);
  if (!record?.intake) {
    return NextResponse.json({ error: "Case not found or already purged" }, { status: 404 });
  }

  try {
    const result = await fillFormStrict(record.intake);
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        // Reference, not the applicant's name: filenames leak into download
        // histories and sync folders.
        "Content-Disposition": `attachment; filename="${result.formId}-${id.slice(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof TemplateNotFoundError || error instanceof UncalibratedFormError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof FieldOverflowError) {
      // A value too long to print legibly — staff must shorten it by hand.
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[admin] form generation failed", error);
    return NextResponse.json({ error: "Form generation failed" }, { status: 500 });
  }
}
