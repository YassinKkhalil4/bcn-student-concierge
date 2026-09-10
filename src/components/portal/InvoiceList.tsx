import type { InvoiceSummary } from "@/lib/server/invoices";

const MONEY = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" });

/** The student's invoices (facturas and any rectificativas), each downloadable as PDF. */
export function InvoiceList({ invoices, hrefBase }: { invoices: InvoiceSummary[]; hrefBase: string }) {
  if (invoices.length === 0) {
    return <p className="mt-2 text-sm text-ink-muted">Your invoice appears here once payment is confirmed.</p>;
  }
  return (
    <ul className="mt-3 divide-y divide-bone-line text-sm">
      {invoices.map((inv) => (
        <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
          <div>
            <p className="font-medium text-ink">
              {inv.number}
              {inv.series === "RECT" && <span className="ml-2 text-xs font-normal text-ink-soft">refund</span>}
            </p>
            <p className="text-xs text-ink-soft">
              {DATE.format(new Date(inv.issuedAt))} · {MONEY.format(inv.totalCents / 100)}
            </p>
          </div>
          <a href={`${hrefBase}/${inv.id}`} className="rounded-md border border-bone-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-bone-warm">
            PDF
          </a>
        </li>
      ))}
    </ul>
  );
}
