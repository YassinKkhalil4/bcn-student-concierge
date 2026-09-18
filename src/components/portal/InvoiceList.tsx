import type { InvoiceSummary } from "@/lib/server/invoices";

const MONEY = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export interface InvoiceListCopy {
  empty: string;
  refund: string;
  pdf: string;
}

/** English, for the staff dashboard; the portal passes its translation. */
const STAFF_COPY: InvoiceListCopy = {
  empty: "Your invoice appears here once payment is confirmed.",
  refund: "refund",
  pdf: "PDF",
};

/** The student's invoices (facturas and any rectificativas), each downloadable as PDF. */
export function InvoiceList({
  invoices,
  hrefBase,
  copy = STAFF_COPY,
  locale = "en-GB",
}: {
  invoices: InvoiceSummary[];
  hrefBase: string;
  copy?: InvoiceListCopy;
  locale?: string;
}) {
  if (invoices.length === 0) {
    return <p className="mt-2 text-sm text-ink-muted">{copy.empty}</p>;
  }
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" });
  return (
    <ul className="mt-3 divide-y divide-paper-line text-sm">
      {invoices.map((inv) => (
        <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
          <div>
            <p className="font-medium text-ink">
              {inv.number}
              {inv.series === "RECT" && <span className="ml-2 text-xs font-normal text-ink-soft">{copy.refund}</span>}
            </p>
            <p className="text-xs text-ink-soft">
              {date.format(new Date(inv.issuedAt))} · {MONEY.format(inv.totalCents / 100)}
            </p>
          </div>
          <a href={`${hrefBase}/${inv.id}`} className="border border-paper-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-paper-dim">
            {copy.pdf}
          </a>
        </li>
      ))}
    </ul>
  );
}
