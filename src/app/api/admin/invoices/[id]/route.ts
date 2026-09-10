import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { getInvoice } from "@/lib/server/invoices";
import { getCase } from "@/lib/server/storage";
import { renderInvoicePdf } from "@/lib/invoicing/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const invoice = await getInvoice((await params).id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const record = await getCase(invoice.caseId);
  const pdf = await renderInvoicePdf(invoice, record?.ref);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
