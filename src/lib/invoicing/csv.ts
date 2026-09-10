import type { Invoice } from "@/lib/server/invoices";
import { centsToSpanishDecimal } from "./numbering";

/**
 * Invoice register as CSV, formatted for Spanish Excel:
 *   - ";" separator and "," decimal mark (what es-ES Excel expects)
 *   - UTF-8 with BOM, so accents in names survive opening by double-click
 *   - CRLF line endings
 *
 * FORMULA INJECTION. Payer names come from the Stripe checkout form — anyone
 * can type "=HYPERLINK(...)" as their name. A text cell starting with = + - @
 * (or tab/CR) is executed by Excel as a formula, so such values are prefixed
 * with an apostrophe. Amounts are NOT prefixed: they are our own numbers, and a
 * refund's "-540,00" must stay a number.
 */

const HEADER = [
  "Número",
  "Serie",
  "Fecha de expedición",
  "Rectifica a",
  "Motivo",
  "Nombre o razón social",
  "NIF / VAT",
  "Tipo de identificación",
  "País",
  "Dirección",
  "Concepto",
  "Base imponible",
  "Tipo IVA (%)",
  "Cuota IVA",
  "Total",
];

const DATE = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Text cell: neutralise formulas, then quote. */
export function csvText(value: string | null | undefined): string {
  let v = (value ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

function address(a: Invoice["billing"]["address"]): string {
  if (!a) return "";
  return [a.line1, a.line2, [a.postalCode, a.city].filter(Boolean).join(" "), a.state]
    .filter(Boolean)
    .join(", ");
}

export function invoicesToCsv(rows: Invoice[]): string {
  const lines = [HEADER.map(csvText).join(";")];
  for (const inv of rows) {
    lines.push(
      [
        csvText(inv.number),
        csvText(inv.series),
        csvText(DATE.format(new Date(inv.issuedAt))),
        csvText(inv.rectifiesNumber),
        csvText(inv.reason),
        csvText(inv.billing.name),
        csvText(inv.billing.taxId?.value),
        csvText(inv.billing.taxId?.type),
        csvText(inv.billing.address?.country),
        csvText(address(inv.billing.address)),
        csvText(inv.description),
        centsToSpanishDecimal(inv.baseCents),
        centsToSpanishDecimal(inv.ivaRateBp), // 2100 bp → "21,00"
        centsToSpanishDecimal(inv.ivaCents),
        centsToSpanishDecimal(inv.totalCents),
      ].join(";"),
    );
  }
  // Explicit escape: a literal BOM character is invisible and easily lost.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
