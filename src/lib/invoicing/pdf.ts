import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Invoice } from "@/lib/server/invoices";
import { embedUnicodeFonts } from "@/lib/pdf/fonts";

/**
 * Invoice PDF (factura / factura rectificativa), A4, drawn with pdf-lib.
 *
 * Carries every element RD 1619/2012 art. 6 lists for a full invoice: number
 * and series, date of issue, issuer's name, NIF and address, recipient's name
 * (and tax ID and address where given), description, taxable base, IVA rate,
 * IVA amount and total — and, for a rectificativa, the invoice it corrects and
 * why. Spanish first, with English underneath for the international payer.
 */

const INK = rgb(0.06, 0.09, 0.07);
const MUTED = rgb(0.29, 0.33, 0.32);
const RULE = rgb(0.89, 0.87, 0.83);
const OLIVE = rgb(0.18, 0.31, 0.24);

const MONEY = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const DATE = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const eur = (cents: number) => MONEY.format(cents / 100);

interface Pen {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
}

function text(pen: Pen, value: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: typeof INK; right?: number } = {}) {
  const font = opts.bold ? pen.bold : pen.regular;
  const size = opts.size ?? 9.5;
  const drawX = opts.right !== undefined ? opts.right - font.widthOfTextAtSize(value, size) : x;
  pen.page.drawText(value, { x: drawX, y, size, font, color: opts.color ?? INK });
}

/** Label in Spanish with the English gloss beneath, then the value lines. */
function block(pen: Pen, x: number, y: number, es: string, en: string, lines: string[]): number {
  text(pen, es.toUpperCase(), x, y, { size: 7.5, bold: true, color: MUTED });
  text(pen, en, x, y - 10, { size: 7, color: MUTED });
  let cursor = y - 26;
  for (const line of lines.filter(Boolean)) {
    text(pen, line, x, cursor, { size: 9.5 });
    cursor -= 13;
  }
  return cursor;
}

export async function renderInvoicePdf(inv: Invoice, caseRef?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${inv.series === "RECT" ? "Factura rectificativa" : "Factura"} ${inv.number}`);
  doc.setAuthor(inv.issuer.name);
  doc.setCreator("BCN Student Concierge");

  const page = doc.addPage([595.28, 841.89]);
  const { regular, bold } = await embedUnicodeFonts(doc);
  const pen: Pen = { page, regular, bold };
  const left = 56;
  const right = 539;
  const rect = inv.series === "RECT";

  // ── Title ──
  text(pen, rect ? "FACTURA RECTIFICATIVA" : "FACTURA", left, 770, { size: 20, bold: true, color: OLIVE });
  text(pen, rect ? "Corrective invoice" : "Invoice", left, 752, { size: 10, color: MUTED });

  text(pen, "Nº / No.", 380, 772, { size: 7.5, color: MUTED });
  text(pen, inv.number, 380, 758, { size: 11, bold: true });
  text(pen, "Fecha de expedición / Date of issue", 380, 740, { size: 7.5, color: MUTED });
  text(pen, DATE.format(new Date(inv.issuedAt)), 380, 727, { size: 10 });

  page.drawLine({ start: { x: left, y: 710 }, end: { x: right, y: 710 }, thickness: 0.8, color: RULE });

  // ── Parties ──
  block(pen, left, 690, "Emisor", "Issued by", [
    inv.issuer.name,
    `NIF: ${inv.issuer.taxId}`,
    inv.issuer.address,
  ]);
  const a = inv.billing.address;
  block(pen, 310, 690, "Destinatario", "Billed to", [
    inv.billing.name,
    inv.billing.taxId ? `${inv.billing.taxId.value} (${inv.billing.taxId.type.toUpperCase()})` : "",
    a?.line1 ?? "",
    a?.line2 ?? "",
    [a?.postalCode, a?.city].filter(Boolean).join(" "),
    [a?.state, a?.country].filter(Boolean).join(", "),
  ]);

  let y = 575;
  if (rect) {
    page.drawRectangle({ x: left, y: y - 30, width: right - left, height: 40, color: rgb(0.96, 0.95, 0.92) });
    text(pen, `Rectifica la factura nº ${inv.rectifiesNumber ?? "—"} · Corrects invoice no. ${inv.rectifiesNumber ?? "—"}`, left + 10, y - 6, { size: 9.5, bold: true });
    text(pen, `Motivo / Reason: ${inv.reason ?? "—"}`, left + 10, y - 21, { size: 9 });
    y -= 55;
  }

  // ── Line table ──
  const cols = { concept: left, base: 380, total: right };
  text(pen, "CONCEPTO / DESCRIPTION", cols.concept, y, { size: 7.5, bold: true, color: MUTED });
  text(pen, "BASE", 0, y, { size: 7.5, bold: true, color: MUTED, right: cols.base + 60 });
  text(pen, "IMPORTE / AMOUNT", 0, y, { size: 7.5, bold: true, color: MUTED, right: cols.total });
  page.drawLine({ start: { x: left, y: y - 7 }, end: { x: right, y: y - 7 }, thickness: 0.6, color: RULE });

  y -= 24;
  // Wrap the description to the column width.
  const maxWidth = cols.base - left - 30;
  const words = inv.description.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (regular.widthOfTextAtSize(next, 9.5) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => text(pen, l, cols.concept, y - i * 13, { size: 9.5 }));
  text(pen, eur(inv.baseCents), 0, y, { size: 9.5, right: cols.base + 60 });
  text(pen, eur(inv.baseCents), 0, y, { size: 9.5, right: cols.total });
  y -= Math.max(1, lines.length) * 13 + 14;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: RULE });

  // ── Totals ──
  y -= 22;
  const rate = (inv.ivaRateBp / 100).toLocaleString("es-ES", { minimumFractionDigits: 0 });
  text(pen, "Base imponible / Taxable base", 330, y, { size: 9.5 });
  text(pen, eur(inv.baseCents), 0, y, { size: 9.5, right });
  y -= 18;
  text(pen, `IVA ${rate} % / VAT ${rate} %`, 330, y, { size: 9.5 });
  text(pen, eur(inv.ivaCents), 0, y, { size: 9.5, right });
  y -= 22;
  // The total's label is stacked (Spanish bold, English gloss beneath) so a
  // long label like "Total rectificado" can never run into the amount.
  text(pen, rect ? "Total rectificado" : "Total", 330, y, { size: 11, bold: true });
  text(pen, eur(inv.totalCents), 0, y, { size: 11, bold: true, right });
  if (rect) text(pen, "Total corrected", 330, y - 12, { size: 7.5, color: MUTED });

  // ── Footer ──
  const status = rect
    ? "Importe devuelto al medio de pago original. / Amount refunded to the original payment method."
    : "Pagada mediante tarjeta a través de Stripe. / Paid by card via Stripe.";
  text(pen, status, left, 150, { size: 8.5, color: MUTED });
  if (caseRef) text(pen, `Referencia de expediente / File reference: ${caseRef}`, left, 136, { size: 8.5, color: MUTED });
  page.drawLine({ start: { x: left, y: 120 }, end: { x: right, y: 120 }, thickness: 0.6, color: RULE });
  text(pen, `${inv.issuer.name} · NIF ${inv.issuer.taxId} · bcnstudent.com`, left, 104, { size: 7.5, color: MUTED });

  return doc.save();
}
