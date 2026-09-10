import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { portalCaseId } from "@/lib/portal/guard";
import { getInvoice } from "@/lib/server/invoices";
import { getCase } from "@/lib/server/storage";
import { renderInvoicePdf } from "@/lib/invoicing/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in student's own invoice, as a PDF. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const limited = await enforceRateLimit(request, "portal-action");
  if (limited) return limited;

  const caseId = await portalCaseId();
  if (!caseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await getInvoice((await params).id);
  // Same 404 for "no such invoice" and "someone else's invoice": the answer
  // must not confirm that another client's invoice id exists.
  if (!invoice || invoice.caseId !== caseId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const record = await getCase(caseId);
  const pdf = await renderInvoicePdf(invoice, record?.ref);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
