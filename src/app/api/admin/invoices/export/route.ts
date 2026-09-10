import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { listInvoicesForExport } from "@/lib/server/invoices";
import { invoicesToCsv } from "@/lib/invoicing/csv";
import { madridRange } from "@/lib/invoicing/numbering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Invoice register for [from, to] inclusive, as Spanish-Excel CSV. */
export async function GET(request: Request): Promise<Response> {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || from > to) {
    return NextResponse.json({ error: "Use ?from=YYYY-MM-DD&to=YYYY-MM-DD" }, { status: 400 });
  }

  // Madrid calendar days, inclusive of the whole "to" day (DST-safe).
  const { start, end } = madridRange(from, to);
  const rows = await listInvoicesForExport(start, end);
  console.info(`[admin] invoice export ${from}..${to} (${rows.length} rows)`);

  return new Response(invoicesToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="facturas_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
